"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AuthSignInForm() {
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
      callbackUrl: "/dashboard",
    });

    setIsPending(false);

    if (!result || result.error) {
      setErrorMessage("Email ou senha inválidos para o workspace demo.");
      return;
    }

    window.location.href = result.url || "/dashboard";
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="auth-form">
        <label>
          <span>Email</span>
          <input
            name="email"
            type="email"
            placeholder="demo@gestaofacil.local"
            defaultValue={createdEmail}
            required
          />
        </label>
        <label>
          <span>Senha</span>
          <input name="password" type="password" placeholder="gestao123" required />
        </label>
        <button type="submit" className="primary-link form-submit" disabled={isPending}>
          {isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {hasError || errorMessage ? (
        <p className="auth-error">{errorMessage || "Email ou senha inválidos para o workspace demo."}</p>
      ) : null}

      {created ? (
        <div className="auth-hint">
          <strong>Conta criada</strong>
          <span>Seu workspace inicial foi criado. Entre com o email e a senha definidos no onboarding.</span>
        </div>
      ) : null}

      <div className="auth-hint">
        <strong>Ainda não tem acesso?</strong>
        <Link href="/onboarding">Criar conta e workspace real</Link>
      </div>
    </>
  );
}
