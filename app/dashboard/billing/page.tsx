import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { createChargeAction, deleteChargeAction } from "@/app/dashboard/billing/actions";
import { getChargeUrgency, getChargeUrgencyLabel, sortChargesByPriority } from "@/lib/charge-priority";
import { billingMoments } from "@/lib/site-data";
import { listCharges } from "@/lib/charge-repository";
import { listQuotes } from "@/lib/quote-repository";

export default async function BillingPage() {
  const quotes = await listQuotes();
  const charges = sortChargesByPriority(await listCharges());
  const approvedQuotes = quotes.filter((quote) => quote.status === "Aprovado");
  const overdueCharges = charges.filter((charge) => getChargeUrgency(charge) === "overdue");
  const dueTodayCharges = charges.filter((charge) => getChargeUrgency(charge) === "today");
  const upcomingCharges = charges.filter((charge) => getChargeUrgency(charge) === "upcoming");

  return (
    <DashboardShell
      eyebrow="Cobrancas"
      title="Receber no prazo precisa ser tao simples quanto criar a venda."
      description="A cobranca entra como parte do fluxo comercial para reduzir esquecimento, acelerar recebimento e preparar a emissao fiscal."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <a href="#nova-cobranca" className="primary-link">
            Nova cobranca
          </a>
        </>
      }
    >
      <section id="nova-cobranca" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Nova cobranca</span>
            <h2>Cobrar a partir de uma venda aprovada ou criar manualmente</h2>
          </div>
        </div>

        <form action={createChargeAction} className="inline-form">
          <label className="form-span-2">
            <span>Gerar de orcamento aprovado</span>
            <select name="quoteId" defaultValue="">
              <option value="">Criar cobranca manual</option>
              {approvedQuotes.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {quote.customer} - {quote.title} - {quote.amount}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Meio</span>
            <select name="paymentMethod" defaultValue="Pix">
              <option value="Pix">Pix</option>
              <option value="Link de pagamento">Link de pagamento</option>
              <option value="Boleto">Boleto</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue="Pendente">
              <option value="Pendente">Pendente</option>
              <option value="Hoje">Hoje</option>
              <option value="Pago">Pago</option>
            </select>
          </label>
          <label>
            <span>Cliente manual</span>
            <input name="customer" type="text" placeholder="Usar se nao vier de orcamento" />
          </label>
          <label>
            <span>Valor manual</span>
            <input name="amount" type="text" placeholder="Ex.: R$ 950" />
          </label>
          <label className="form-span-2">
            <span>Prazo ou status operacional</span>
            <input name="dueLabel" type="text" placeholder="Ex.: vence sexta-feira" />
          </label>
          <label>
            <span>Data real de vencimento</span>
            <input name="dueDate" type="date" />
          </label>
          <label className="form-span-2">
            <span>Origem manual</span>
            <input name="source" type="text" placeholder="Ex.: cobranca criada apos visita tecnica" />
          </label>
          <button type="submit" className="primary-link form-submit">
            Salvar cobranca
          </button>
        </form>
      </section>

      {approvedQuotes.length > 0 ? (
        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Pronto para cobrar</span>
              <h2>Orcamentos aprovados que podem virar recebimento</h2>
            </div>
          </div>

          <div className="cards-grid quote-grid">
            {approvedQuotes.map((quote) => (
              <article key={quote.id} className="dashboard-card">
                <span className="dashboard-kicker">Aprovado</span>
                <h3>{quote.customer}</h3>
                <strong className="quote-amount">{quote.amount}</strong>
                <p>{quote.title}</p>
                <small className="muted-text">{quote.summary}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="stats-row">
        <article className="stat-card">
          <span>Cobrancas atrasadas</span>
          <strong>{overdueCharges.length}</strong>
          <p>Essas cobrancas devem subir para o topo da fila operacional.</p>
        </article>
        <article className="stat-card">
          <span>Vencem hoje</span>
          <strong>{dueTodayCharges.length}</strong>
          <p>Recebimentos do dia que pedem lembrete ou confirmacao rapida.</p>
        </article>
        <article className="stat-card">
          <span>Proximas com data</span>
          <strong>{upcomingCharges.length}</strong>
          <p>Base previsivel para caixa sem depender so de texto solto.</p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Recebimentos</span>
            <h2>Status de cobrancas do dia</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          {charges.map((charge) => (
            <article key={charge.id} className="dashboard-card">
              <span className="dashboard-kicker">{getChargeUrgencyLabel(charge)}</span>
              <h3>{charge.customer}</h3>
              <strong className="quote-amount">{charge.amount}</strong>
              <p>{charge.source}</p>
              <small className="muted-text">{charge.dueLabel}</small>
              {charge.dueDate ? <small className="muted-text">Data real: {charge.dueDate}</small> : null}
              <small className="muted-text">Status operacional: {charge.status}</small>
              <form action={deleteChargeAction} className="card-action">
                <input type="hidden" name="id" value={charge.id} />
                <button type="submit" className="ghost-button">
                  Remover
                </button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="section-split">
        {billingMoments.map((item) => (
          <article key={item.title} className="split-panel success">
            <span className="section-label">{item.kicker}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </article>
        ))}
      </section>
    </DashboardShell>
  );
}
