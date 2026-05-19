import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { createQuoteAction, deleteQuoteAction } from "@/app/dashboard/quotes/actions";
import { listCustomers } from "@/lib/customer-repository";
import { listQuotes } from "@/lib/quote-repository";
import { quoteGoals } from "@/lib/site-data";

export default async function QuotesPage() {
  const customers = await listCustomers();
  const quotes = await listQuotes();

  return (
    <DashboardShell
      eyebrow="Orcamentos"
      title="O orcamento precisa vender, nao ser apenas um PDF burocratico."
      description="O MVP de orcamentos deve acelerar resposta, aumentar aprovacao e diminuir retrabalho quando a venda andar."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <a href="#novo-orcamento" className="primary-link">
            Criar orcamento
          </a>
        </>
      }
    >
      <section id="novo-orcamento" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Novo orcamento</span>
            <h2>Montar proposta sem sair do ritmo comercial</h2>
          </div>
        </div>

        <form action={createQuoteAction} className="inline-form">
          <label>
            <span>Cliente</span>
            <select name="customer" required defaultValue="">
              <option value="" disabled>
                Selecione um cliente
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.name}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Titulo</span>
            <input name="title" type="text" placeholder="Ex.: Suporte mensal" required />
          </label>
          <label>
            <span>Valor</span>
            <input name="amount" type="text" placeholder="Ex.: R$ 1.900" required />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue="Enviado">
              <option value="Enviado">Enviado</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Follow-up">Follow-up</option>
            </select>
          </label>
          <label className="form-span-2">
            <span>Prazo ou proximo passo</span>
            <input
              name="dueLabel"
              type="text"
              placeholder="Ex.: Follow-up amanha as 10h"
            />
          </label>
          <label className="form-span-2">
            <span>Resumo</span>
            <input
              name="summary"
              type="text"
              placeholder="Ex.: Proposta recorrente com setup inicial incluso."
            />
          </label>
          <button type="submit" className="primary-link form-submit">
            Salvar orcamento
          </button>
        </form>
      </section>

      <section className="cards-grid quote-grid">
        {quotes.map((quote) => (
          <article key={quote.id} className="dashboard-card">
            <span className="dashboard-kicker">{quote.status}</span>
            <h3>{quote.title}</h3>
            <p>{quote.customer}</p>
            <strong className="quote-amount">{quote.amount}</strong>
            <p>{quote.summary}</p>
            <small className="muted-text">{quote.dueLabel}</small>
            <form action={deleteQuoteAction} className="card-action">
              <input type="hidden" name="id" value={quote.id} />
              <button type="submit" className="ghost-button">
                Remover
              </button>
            </form>
          </article>
        ))}
      </section>

      <section className="section-grid tinted">
        <div>
          <span className="section-label">Objetivos do modulo</span>
          <h2>O cliente aprova mais rapido quando a proposta parece simples e pronta para agir.</h2>
        </div>
        <div className="cards-grid">
          {quoteGoals.map((item) => (
            <article key={item.title} className="info-card compact">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
