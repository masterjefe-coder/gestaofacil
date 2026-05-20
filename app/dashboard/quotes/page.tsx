import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { createQuoteAction, deleteQuoteAction } from "@/app/dashboard/quotes/actions";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { listCustomers } from "@/lib/customer-repository";
import { buildQuoteInsights } from "@/lib/quote-insights";
import { listQuotes } from "@/lib/quote-repository";
import { quoteGoals } from "@/lib/site-data";

export default async function QuotesPage() {
  const [customers, quotes, whatsappActivity] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCustomerWhatsappActivity().catch(() => []),
  ]);
  const quoteInsights = buildQuoteInsights(quotes, customers, whatsappActivity);

  return (
    <DashboardShell
      eyebrow="Orçamentos"
      title="O orçamento precisa vender, não ser apenas um PDF burocrático."
      description="O MVP de orçamentos deve acelerar resposta, aumentar aprovação e diminuir retrabalho quando a venda andar."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <a href="#novo-orcamento" className="primary-link">
            Criar orçamento
          </a>
        </>
      }
    >
      <section id="novo-orcamento" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Novo orçamento</span>
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
            <span>Título</span>
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
            <span>Prazo ou próximo passo</span>
            <input
              name="dueLabel"
              type="text"
              placeholder="Ex.: Follow-up amanhã às 10h"
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
            Salvar orçamento
          </button>
        </form>
      </section>

      <section className="stats-row">
        <article className="stat-card">
          <span>Quentes no canal</span>
          <strong>{quoteInsights.summary.hotCount}</strong>
          <p>Propostas com cliente ativo no WhatsApp e mais chance de avanço rápido.</p>
        </article>
        <article className="stat-card">
          <span>Follow-up ativo</span>
          <strong>{quoteInsights.summary.followUpCount}</strong>
          <p>Orçamentos que já pedem retomada explícita para não esfriarem na fila.</p>
        </article>
        <article className="stat-card">
          <span>Aprovados</span>
          <strong>{quoteInsights.summary.approvedCount}</strong>
          <p>Propostas já prontas para virar operação, cobrança ou próximo passo concreto.</p>
        </article>
        <article className="stat-card">
          <span>Aguardando</span>
          <strong>{quoteInsights.summary.waitingCount}</strong>
          <p>Itens enviados sem sinal recente do cliente, bons candidatos para nova cadência.</p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Fila comercial</span>
            <h2>Quais propostas merecem ação primeiro</h2>
          </div>
        </div>

        {quoteInsights.items.length > 0 ? (
          <div className="cards-grid quote-grid">
            {quoteInsights.items.slice(0, 4).map((item) => (
              <article key={item.quoteId} className="dashboard-card">
                <span className="dashboard-kicker">{item.priorityLabel}</span>
                <h3>{item.customer}</h3>
                <strong className="quote-amount">{item.amount}</strong>
                <p>{item.title}</p>
                <small className="muted-text">{item.helper}</small>
                <small className="muted-text">{item.dueLabel}</small>
                {item.whatsappLastEventAt ? (
                  <small className="muted-text">Último sinal no canal: {item.whatsappLastEventAt}</small>
                ) : null}
                {item.whatsappLastEventSummary ? (
                  <div className="follow-up-entry">
                    <strong>Contexto recente</strong>
                    <small>{item.whatsappLastEventSummary}</small>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Sem propostas na fila</strong>
            <span>Quando os orçamentos começarem a rodar com mais contexto do canal, esta área ordena a fila comercial por calor e necessidade de follow-up.</span>
          </div>
        )}
      </section>

      <section className="cards-grid quote-grid">
        {quoteInsights.items.map((quote) => (
          <article key={quote.quoteId} className="dashboard-card">
            <span className="dashboard-kicker">{quote.priorityLabel}</span>
            <h3>{quote.title}</h3>
            <p>{quote.customer}</p>
            <strong className="quote-amount">{quote.amount}</strong>
            <p>{quote.summary}</p>
            <small className="muted-text">{quote.dueLabel}</small>
            <small className="muted-text">{quote.helper}</small>
            {quote.customerStatus ? (
              <small className="muted-text">Cliente: {quote.customerStatus}{quote.customerOpenAmount ? ` · Em aberto ${quote.customerOpenAmount}` : ""}</small>
            ) : null}
            <form action={deleteQuoteAction} className="card-action">
              <input type="hidden" name="id" value={quote.quoteId} />
              <button type="submit" className="ghost-button">
                Remover
              </button>
            </form>
          </article>
        ))}
      </section>

      <section className="section-grid tinted">
        <div>
          <span className="section-label">Objetivos do módulo</span>
          <h2>O cliente aprova mais rápido quando a proposta parece simples e pronta para agir.</h2>
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
