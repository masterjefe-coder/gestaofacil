import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { OnboardingForm } from "@/components/onboarding-form";
import { authOptions } from "@/lib/auth-options";
import { isLocalDataMode } from "@/lib/data-mode";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <BrandLogo className="auth-wordmark" priority />
        <span className="eyebrow">Primeiro workspace</span>
        <h1>Criar conta real no Gestao Facil.</h1>
        <p>
          Este fluxo abre um usuario real, cria o workspace principal e deixa a empresa pronta
          para continuar no dashboard.
        </p>

        {isLocalDataMode() ? (
          <div className="auth-hint">
            <strong>Modo local ativo</strong>
            <span>Defina `DATABASE_URL` para habilitar onboarding real com persistencia no banco.</span>
          </div>
        ) : (
          <OnboardingForm />
        )}

        <div className="hero-actions">
          <Link href="/login" className="secondary-link">
            Ja tenho acesso
          </Link>
          <Link href="/" className="secondary-link">
            Voltar para a landing
          </Link>
        </div>
      </section>
    </main>
  );
}
