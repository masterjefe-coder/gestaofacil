import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  addChargeFollowUpAction,
  createChargeAction,
  deleteChargeAction,
  markChargeAsDueTodayAction,
  markChargeAsPaidAction,
  postponeChargeAction,
} from "@/app/dashboard/billing/actions";
import { buildChargeFollowUpActions, summarizeChargeFollowUp } from "@/lib/charge-follow-up";
import { getChargeUrgency, getChargeUrgencyLabel, sortChargesByPriority } from "@/lib/charge-priority";
import { billingMoments } from "@/lib/site-data";
import { listCharges } from "@/lib/charge-repository";
import { listQuotes } from "@/lib/quote-repository";

function formatFollowUpDate(value: string) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default async function BillingPage() {
  const quotes = await listQuotes();
  const charges = sortChargesByPriority(await listCharges());
  const approvedQuotes = quotes.filter((quote) => quote.status === "Aprovado");
  const followUpActions = buildChargeFollowUpActions(charges);
  const followUpSummary = summarizeChargeFollowUp(followUpActions);
  const highlightedFollowUps = followUpActions.slice(0, 4);
  const unscheduledCount = followUpActions.filter((action) => action.bucket === "unmapped").length;
  const chargesById = new Map(charges.map((charge) => [charge.id, charge]));

  return (
    <DashboardShell
      eyebrow="Cobranças"
      title="Receber no prazo precisa ser tão simples quanto criar a venda."
      description="A cobrança entra como parte do fluxo comercial para reduzir esquecimento, acelerar recebimento e preparar a emissão fiscal."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <a href="#nova-cobranca" className="primary-link">
            Nova cobrança
          </a>
        </>
      }
    >
      <section id="nova-cobranca" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Nova cobrança</span>
            <h2>Cobrar a partir de uma venda aprovada ou criar manualmente</h2>
          </div>
        </div>

        <form action={createChargeAction} className="inline-form">
          <label className="form-span-2">
            <span>Gerar de orçamento aprovado</span>
            <select name="quoteId" defaultValue="">
              <option value="">Criar cobrança manual</option>
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
            <input name="customer" type="text" placeholder="Usar se não vier de orçamento" />
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
            <input name="source" type="text" placeholder="Ex.: cobrança criada após visita técnica" />
          </label>
          <button type="submit" className="primary-link form-submit">
            Salvar cobrança
          </button>
        </form>
      </section>

      {approvedQuotes.length > 0 ? (
        <section className="data-panel">
          <div className="card-header">
            <div>
              <span className="section-label">Pronto para cobrar</span>
              <h2>Orçamentos aprovados que podem virar recebimento</h2>
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
          <span>SLA vencido</span>
          <strong>{followUpSummary.slaOverdueCount}</strong>
          <p>{followUpSummary.headline}</p>
        </article>
        <article className="stat-card">
          <span>Ação hoje</span>
          <strong>{followUpSummary.slaTodayCount}</strong>
          <p>{followUpSummary.slaTodayCount > 0 ? "Cobranças que já pedem contato hoje pela cadência automática." : "Nenhum follow-up automático cai hoje."}</p>
        </article>
        <article className="stat-card">
          <span>Aguardando retorno</span>
          <strong>{followUpSummary.waitingCount}</strong>
          <p>{followUpSummary.helper}</p>
        </article>
        <article className="stat-card">
          <span>Sem data real</span>
          <strong>{unscheduledCount}</strong>
          <p>
            {unscheduledCount > 0
              ? "Cobranças sem vencimento exato ainda prejudicam a previsibilidade do caixa."
              : "Toda cobrança aberta já tem ou não precisa de data operacional."}
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Fila de follow-up</span>
            <h2>Cobranças que pedem ação prática agora</h2>
          </div>
        </div>

        {highlightedFollowUps.length > 0 ? (
          <div className="cards-grid quote-grid">
            {highlightedFollowUps.map((action) => (
              (() => {
                const linkedCharge = chargesById.get(action.id);
                const latestFollowUp = linkedCharge?.followUps[0];

                return (
                  <article key={action.id} className="dashboard-card">
                    <span className="dashboard-kicker">{action.urgencyLabel}</span>
                    <h3>{action.customer}</h3>
                    <strong className="quote-amount">{action.amount}</strong>
                    <p>{action.summary}</p>
                    <small className="muted-text">{action.slaLabel}</small>
                    <small className="muted-text">{action.nextFollowUpLabel}</small>
                    <small className="muted-text">{action.recommendedAction}</small>
                    <small className="muted-text">{action.suggestedMessage}</small>
                    {latestFollowUp ? (
                      <small className="muted-text">
                        Ultimo contato: {action.lastContactLabel}.
                      </small>
                    ) : null}
                    <div className="auth-hint">
                      <strong>Próxima ação</strong>
                      <span>A fila já foi ordenada pelo próximo contato sugerido e pelo SLA financeiro.</span>
                    </div>
                    <div className="dashboard-actions">
                      {action.urgency !== "today" ? (
                        <form action={markChargeAsDueTodayAction} className="card-action">
                          <input type="hidden" name="id" value={action.id} />
                          <button type="submit" className="secondary-link">
                            Puxar para hoje
                          </button>
                        </form>
                      ) : null}
                      <form action={postponeChargeAction} className="card-action">
                        <input type="hidden" name="id" value={action.id} />
                        <button type="submit" className="secondary-link">
                          Reagendar +3d
                        </button>
                      </form>
                      <form action={markChargeAsPaidAction} className="card-action">
                        <input type="hidden" name="id" value={action.id} />
                        <button type="submit" className="primary-link">
                          Marcar pago
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })()
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Fila limpa</strong>
            <span>Nenhuma cobrança aberta exige follow-up financeiro imediato agora.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Recebimentos</span>
            <h2>Status de cobranças do dia</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          {charges.map((charge) => (
            (() => {
              const automaticAction = followUpActions.find((action) => action.id === charge.id);

              return (
                <article key={charge.id} className="dashboard-card">
                  <span className="dashboard-kicker">{getChargeUrgencyLabel(charge)}</span>
                  <h3>{charge.customer}</h3>
                  <strong className="quote-amount">{charge.amount}</strong>
                  <p>{charge.source}</p>
                  <small className="muted-text">{charge.dueLabel}</small>
                  {charge.dueDate ? <small className="muted-text">Data real: {charge.dueDate}</small> : null}
                  <small className="muted-text">Status operacional: {charge.status}</small>
                  {automaticAction ? (
                    <>
                      <small className="muted-text">{automaticAction.slaLabel}</small>
                      <small className="muted-text">{automaticAction.nextFollowUpLabel}</small>
                    </>
                  ) : null}
                  <small className="muted-text">
                    {charge.followUps.length > 0
                      ? `${charge.followUps.length} follow-up(s) financeiro(s) registrados`
                      : "Nenhum follow-up financeiro registrado ainda"}
                  </small>
                  {charge.status !== "Pago" ? (
                    <div className="dashboard-actions">
                      {getChargeUrgency(charge) !== "today" ? (
                        <form action={markChargeAsDueTodayAction} className="card-action">
                          <input type="hidden" name="id" value={charge.id} />
                          <button type="submit" className="secondary-link">
                            Hoje
                          </button>
                        </form>
                      ) : null}
                      <form action={postponeChargeAction} className="card-action">
                        <input type="hidden" name="id" value={charge.id} />
                        <button type="submit" className="secondary-link">
                          +3d
                        </button>
                      </form>
                      <form action={markChargeAsPaidAction} className="card-action">
                        <input type="hidden" name="id" value={charge.id} />
                        <button type="submit" className="primary-link">
                          Pago
                        </button>
                      </form>
                    </div>
                  ) : null}
                  <div className="follow-up-block">
                    <strong>Registrar follow-up</strong>
                    <form action={addChargeFollowUpAction} className="follow-up-form">
                      <input type="hidden" name="id" value={charge.id} />
                      <label>
                        <span>Canal</span>
                        <select name="channel" defaultValue="WhatsApp">
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Ligacao">Ligação</option>
                          <option value="Email">Email</option>
                          <option value="Pix reenviado">Pix reenviado</option>
                        </select>
                      </label>
                      <label>
                        <span>Retorno</span>
                        <select name="outcome" defaultValue="Sem resposta">
                          <option value="Sem resposta">Sem resposta</option>
                          <option value="Prometeu pagar">Prometeu pagar</option>
                          <option value="Pago em analise">Pago em análise</option>
                          <option value="Reagendado">Reagendado</option>
                          <option value="Contestou">Contestou</option>
                        </select>
                      </label>
                      <label className="form-span-2">
                        <span>Observação</span>
                        <textarea
                          name="note"
                          rows={3}
                          placeholder="Ex.: Cliente pediu reenvio do Pix e prometeu pagar até sexta."
                        />
                      </label>
                      <button type="submit" className="secondary-link">
                        Registrar contato
                      </button>
                    </form>
                    {charge.followUps.length > 0 ? (
                      <div className="follow-up-list">
                        {charge.followUps.slice(0, 3).map((entry) => (
                          <article key={entry.id} className="follow-up-entry">
                            <strong>
                              {entry.channel} · {entry.outcome}
                            </strong>
                            <span>{formatFollowUpDate(entry.createdAt)}</span>
                            <small>{entry.note}</small>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <form action={deleteChargeAction} className="card-action">
                    <input type="hidden" name="id" value={charge.id} />
                    <button type="submit" className="ghost-button">
                      Remover
                    </button>
                  </form>
                </article>
              );
            })()
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
