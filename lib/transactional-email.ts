type TransactionalEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function isTransactionalEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendTransactionalEmail(input: TransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new Error("Configure RESEND_API_KEY e EMAIL_FROM para envio transacional.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null) as {
    id?: string;
    message?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    throw new Error(body?.error?.message || body?.message || `Falha no envio transacional (${response.status}).`);
  }

  return {
    id: body?.id || null,
  };
}
