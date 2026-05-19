import { isLocalDataMode } from "@/lib/data-mode";
import { ensureDemoCommerceSeeded } from "@/lib/demo-workspace-bootstrap";
import { verifyPassword } from "@/lib/password-auth";
import { prisma } from "@/lib/prisma";
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
      async authorize(credentials) {
        const email = String(credentials?.email || "").trim();
        const password = String(credentials?.password || "").trim();

        if (email === getDemoEmail() && password === getDemoPassword()) {
          if (!isLocalDataMode()) {
            const { user, workspace } = await ensureDemoCommerceSeeded();

            return {
              id: user.id,
              name: email.split("@")[0] || "Operador",
              email,
              workspaceId: workspace.id,
              workspaceRole: "OWNER",
            };
          }

          return {
            id: "demo-user",
            name: email.split("@")[0] || "Operador",
            email,
            workspaceId: "demo-workspace",
            workspaceRole: "OWNER",
          };
        }

        if (!isLocalDataMode()) {
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
            return {
              id: user.id,
              name: user.name || email.split("@")[0] || "Operador",
              email: user.email,
              workspaceId: primaryMembership.workspaceId,
              workspaceRole: primaryMembership.role,
            };
          }
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
