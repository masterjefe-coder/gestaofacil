import { AuthRateLimitError, assertLoginAttemptAllowed, clearFailedLoginAttempts, registerFailedLoginAttempt } from "@/lib/auth-security";
import { recordAuthLoginFailed, recordAuthLoginLocked, recordAuthLoginSuccess } from "@/lib/auth-event-log";
import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { verifyPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
import { canUsePublicDemoCredentials } from "@/lib/runtime-safety";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

function getDemoEmail() {
  return process.env.AUTH_DEMO_EMAIL || "demo@gestaofacil.local";
}

function getDemoPassword() {
  return process.env.AUTH_DEMO_PASSWORD || "gestao123";
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciais demo",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email || "").trim();
        const password = String(credentials?.password || "").trim();
        const userAgent = request?.headers?.get?.("user-agent") || null;

        if (canUsePublicDemoCredentials() && email === getDemoEmail() && password === getDemoPassword()) {
          await ensureDemoCommerceSeeded();
          return {
            id: "demo-user",
            name: email.split("@")[0] || "Operador",
            email,
            workspaceId: "demo-workspace",
            workspaceRole: "OWNER",
          };
        }

        if (!isLocalDataMode()) {
          try {
            await assertLoginAttemptAllowed(email);
          } catch (error) {
            if (error instanceof AuthRateLimitError) {
              await recordAuthLoginLocked({
                email,
                retryAfterSeconds: error.retryAfterSeconds,
                userAgent,
              });
            }

            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
              id: true,
              name: true,
              email: true,
              passwordHash: true,
              memberships: {
                include: {
                  workspace: true,
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
          });

          const primaryMembership = user?.memberships[0];

          if (user?.passwordHash && primaryMembership && verifyPassword(password, user.passwordHash)) {
            await clearFailedLoginAttempts(email);
            await recordAuthLoginSuccess({
              email: user.email,
              userId: user.id,
              workspaceId: primaryMembership.workspaceId,
              userAgent,
            });

            return {
              id: user.id,
              name: user.name || email.split("@")[0] || "Operador",
              email: user.email,
              workspaceId: primaryMembership.workspaceId,
              workspaceRole: primaryMembership.role,
            };
          }

          await registerFailedLoginAttempt(email);
          await recordAuthLoginFailed({
            email,
            userAgent,
          });
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }

      if (user?.name) {
        token.name = user.name;
      }

      if (user?.email) {
        token.email = user.email;
      }

      if (user?.workspaceId) {
        token.workspaceId = user.workspaceId;
      }

      if (user?.workspaceRole) {
        token.workspaceRole = user.workspaceRole;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === "string" ? token.userId : session.user.id;
        session.user.name = typeof token.name === "string" ? token.name : session.user.name;
        session.user.email = typeof token.email === "string" ? token.email : session.user.email;
        session.user.workspaceId =
          typeof token.workspaceId === "string" ? token.workspaceId : session.user.workspaceId;
        session.user.workspaceRole =
          typeof token.workspaceRole === "string" ? token.workspaceRole : session.user.workspaceRole;
      }

      return session;
    },
  },
};
