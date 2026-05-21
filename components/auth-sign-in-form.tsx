"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

type AuthSignInFormProps = {
  callbackUrl?: string;
  showDemoHints?: boolean;
};

export function AuthSignInForm({ callbackUrl = "/dashboard", showDemoHints = false }: AuthSignInFormProps) {
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createdEmail = searchParams.get("email") || "";
  const created = searchParams.get("created") === "1";

  const hasError =
    searchParams.get("error") === "CredentialsSignin" ||
    searchParams.get("error") === "invalid_credentials";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "").trim();

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setIsPending(false);

    if (!result || result.error) {
      setErrorMessage("Email ou senha inválidos.");
      return;
    }

    window.location.href = result.url || "/dashboard";
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-form-section">
          <div className="auth-form-section-header">
            <strong>Entrar no workspace</strong>
            <span>Use seu email de acesso e a senha definida no onboarding.</span>
          </div>
          <label>
            <span>Email</span>
            <input
              name="email"
              type="email"
              placeholder={showDemoHints ? "demo@gestaofacil.local" : "voce@empresa.com.br"}
              defaultValue={createdEmail}
              required
            />
          </label>
          <label>
            <span>Senha</span>
            <input name="password" type="password" placeholder={showDemoHints ? "gestao123" : "Sua senha"} required />
          </label>
        </div>
        <button type="submit" className="primary-link form-submit" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {hasError || errorMessage ? (
        <p className="auth-error">{errorMessage || "Email ou senha inválidos."}</p>
      ) : null}

      {created ? (
        <div className="auth-hint">
          <strong>Conta criada</strong>
          <span>Seu workspace inicial foi criado. Entre com o email e a senha definidos no onboarding.</span>
        </div>
      ) : null}

      <div className="auth-hint">
        <strong>Ainda não tem acesso?</strong>
        <Link href={callbackUrl !== "/dashboard" ? `/onboarding?next=${encodeURIComponent(callbackUrl)}` : "/onboarding"}>
          Criar conta e workspace real
        </Link>
      </div>
    </>
  );
}
