import Link from "next/link";
import { getServerSession } from "next-auth";
import { AuthSignInForm } from "@/components/auth-sign-in-form";
import { authOptions } from "@/lib/auth-options";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getServerSession(authOptions);
  if (searchParams) {
    await searchParams;
  }

  if (session) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <span className="eyebrow">Sessao ativa</span>
          <h1>Voce ja entrou no Gestao Facil.</h1>
          <p>
            O dashboard ja esta disponivel para continuar a configuracao e operar o workspace.
          </p>
          <div className="hero-actions">
            <Link href="/dashboard" className="primary-link">
              Ir para o dashboard
            </Link>
            <Link href="/" className="secondary-link">
              Voltar para a landing
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">Acesso ao workspace</span>
        <h1>Entrar no Gestao Facil.</h1>
        <p>
          Esta primeira camada de autenticacao protege o dashboard e prepara o terreno para
          evoluirmos do acesso demo para contas reais por workspace.
        </p>

        <AuthSignInForm />

        <div className="auth-hint">
          <strong>Credenciais demo padrao</strong>
          <span>`demo@gestaofacil.local`</span>
          <span>`gestao123`</span>
        </div>
      </section>
    </main>
  );
}
