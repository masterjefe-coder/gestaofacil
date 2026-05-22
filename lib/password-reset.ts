import { createHash, randomBytes } from "node:crypto";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { assertPasswordResetAllowed, AuthRateLimitError, registerPasswordResetAttempt } from "@/lib/auth-security";
import { recordPasswordResetCompleted, recordPasswordResetRequested } from "@/lib/auth-event-log";
import { isLocalDataMode } from "@/lib/data-mode";
import { hashPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { isTransactionalEmailConfigured, sendTransactionalEmail } from "@/lib/transactional-email";

const PASSWORD_RESET_TTL_HOURS = 2;

export class PasswordResetError extends Error {}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildPasswordResetUrl(token: string) {
  const path = `/redefinir-senha?token=${encodeURIComponent(token)}`;
  const baseUrl = resolveAppBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

function buildPasswordResetEmail(input: {
  name?: string | null;
  resetUrl: string;
  expiresAt: Date;
}) {
  const greeting = input.name?.trim() ? `Olá, ${input.name.trim()}!` : "Olá!";
  const expiry = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(input.expiresAt);

  return {
    subject: "Redefinir senha no Gestão Fácil",
    text: [
      greeting,
      "Recebemos um pedido para redefinir sua senha no Gestão Fácil.",
      `Use este link: ${input.resetUrl}`,
      `Esse link expira em ${expiry}.`,
      "Se você não pediu essa redefinição, pode ignorar este email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#14213d">
        <h2 style="margin-bottom:8px;">${greeting}</h2>
        <p>Recebemos um pedido para redefinir sua senha no Gestão Fácil.</p>
        <p>
          <a href="${input.resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#0d63ff;color:#fff;text-decoration:none;font-weight:700;">
            Redefinir senha
          </a>
        </p>
        <p>Se preferir, use este link direto:<br /><a href="${input.resetUrl}">${input.resetUrl}</a></p>
        <p>Esse link expira em ${expiry}.</p>
        <p>Se você não pediu essa redefinição, pode ignorar este email.</p>
      </div>
    `.trim(),
  };
}

export async function requestPasswordReset(emailInput: string) {
  if (isLocalDataMode()) {
    throw new PasswordResetError("Defina DATABASE_URL para recuperar senha em contas reais.");
  }

  const email = emailInput.trim().toLowerCase();

  if (!email) {
    throw new PasswordResetError("Informe o email da conta para recuperar a senha.");
  }

  try {
    await assertPasswordResetAllowed(email);
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      throw new PasswordResetError(`Muitas tentativas de recuperação. Aguarde ${error.retryAfterSeconds}s antes de tentar novamente.`);
    }

    throw error;
  }

  await registerPasswordResetAttempt(email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user) {
    return {
      accepted: true,
      delivery: {
        sent: false,
        skipped: true,
        error: null,
      },
    };
  }

  const token = randomBytes(24).toString("hex");
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_HOURS * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        email: user.email,
        tokenHash,
        expiresAt,
      },
    });
  });

  await recordPasswordResetRequested(user.email);

  if (!isTransactionalEmailConfigured()) {
    return {
      accepted: true,
      delivery: {
        sent: false,
        skipped: true,
        error: "Envio transacional não configurado.",
      },
    };
  }

  const resetUrl = buildPasswordResetUrl(token);
  const emailPayload = buildPasswordResetEmail({
    name: user.name,
    resetUrl,
    expiresAt,
  });

  try {
    await sendTransactionalEmail({
      to: user.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
    });

    return {
      accepted: true,
      delivery: {
        sent: true,
        skipped: false,
        error: null,
      },
    };
  } catch (error) {
    return {
      accepted: true,
      delivery: {
        sent: false,
        skipped: false,
        error: error instanceof Error ? error.message : "Falha ao enviar email de redefinição.",
      },
    };
  }
}

export async function validatePasswordResetToken(tokenInput: string) {
  if (!tokenInput.trim()) {
    return null;
  }

  const tokenHash = hashPasswordResetToken(tokenInput.trim());
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  if (!resetToken) {
    return null;
  }

  const expired = resetToken.expiresAt.getTime() < Date.now();

  return {
    id: resetToken.id,
    token: tokenInput,
    email: resetToken.user.email,
    name: resetToken.user.name || undefined,
    expired,
    consumed: Boolean(resetToken.consumedAt),
    expiresAt: resetToken.expiresAt,
  };
}

export async function completePasswordReset(input: {
  token: string;
  password: string;
}) {
  if (isLocalDataMode()) {
    throw new PasswordResetError("Defina DATABASE_URL para redefinir senhas reais.");
  }

  const token = input.token.trim();
  const password = input.password.trim();

  if (!token) {
    throw new PasswordResetError("Link de redefinição inválido.");
  }

  if (password.length < 8) {
    throw new PasswordResetError("A nova senha precisa ter pelo menos 8 caracteres.");
  }

  const tokenHash = hashPasswordResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: true,
    },
  });

  if (!resetToken) {
    throw new PasswordResetError("Esse link de redefinição não é mais válido.");
  }

  if (resetToken.consumedAt) {
    throw new PasswordResetError("Esse link já foi usado.");
  }

  if (resetToken.expiresAt.getTime() < Date.now()) {
    throw new PasswordResetError("Esse link expirou. Solicite uma nova redefinição.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: resetToken.userId },
      data: {
        passwordHash: hashPassword(password),
      },
    });

    await tx.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        consumedAt: new Date(),
      },
    });
  });

  await recordPasswordResetCompleted(resetToken.user.email, resetToken.user.id);

  return {
    email: resetToken.user.email,
  };
}
