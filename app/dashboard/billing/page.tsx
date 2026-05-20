import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleQueueFilters } from "@/components/module-queue-filters";
import {
  addChargeFollowUpAction,
  advanceChargeCadenceAction,
  applyWhatsappSignalFollowUpAction,
  createChargeAction,
  deleteChargeAction,
  markChargeAsDueTodayAction,
  markChargeAsPaidAction,
  postponeChargeAction,
  runChargeReminderAction,
  sendChargeReminderWhatsappAction,
} from "@/app/dashboard/billing/actions";
import { createNfseDraftAction } from "@/app/dashboard/fiscal/actions";
import { buildBillingWhatsappInsights } from "@/lib/billing-whatsapp-insights";
import { buildChargeFollowUpActions, buildChargeReminderQueue, summarizeChargeFollowUp } from "@/lib/charge-follow-up";
import { listChargeWhatsappHistory, type ChargeWhatsappHistoryEntry } from "@/lib/charge-whatsapp-history";
import { getChargeUrgency, getChargeUrgencyLabel, sortChargesByPriority } from "@/lib/charge-priority";
import { listChargeWhatsappSignals } from "@/lib/charge-whatsapp-signals";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { listNfseDocuments } from "@/lib/nfse-repository";
import { billingMoments } from "@/lib/site-data";
import { listCharges } from "@/lib/charge-repository";
import { listCustomers } from "@/lib/customer-repository";
import { getEvolutionIntegrationStatus } from "@/lib/evolution-api";
import { readDashboardQueuePreference } from "@/lib/dashboard-queue-preferences";
import { listQuotes } from "@/lib/quote-repository";
import type { ChargeWhatsappSignal } from "@/lib/charge-whatsapp-signals";
import type { Charge } from "@/lib/types";

type BillingPageProps = {
  searchParams?: Promise<{
    focus?: string;
    view?: string;
  }>;
};

type BillingQueueView = "all" | "overdue" | "today" | "waiting" | "unscheduled" | "triage";

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

function getHumanTriageLabel(signal: { suggestedOutcome?: string; inboundReplyDetected: boolean }) {
  switch (signal.suggestedOutcome) {
    case "Contestou":
      return "Precisa tratar objeção antes de cobrar de novo.";
    case "Pago em analise":
      return "Vale conferir comprovante ou conciliação antes do próximo toque.";
    case "Reagendado":
      return "Cliente respondeu com novo prazo e pede ajuste da cadência.";
    case "Prometeu pagar":
      return "Cliente sinalizou intenção de pagar e merece acompanhamento manual.";
    default:
      return signal.inboundReplyDetected
        ? "Cliente respondeu no canal, mas a leitura ainda depende de avaliação humana."
        : "Sem triagem pendente.";
  }
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const [quotes, loadedCharges, nfseDocuments, customers, customerWhatsappActivity, chargeWhatsappSignals] = await Promise.all([
    listQuotes(),
    listCharges(),
    listNfseDocuments(),
    listCustomers(),
    listCustomerWhatsappActivity().catch(() => []),
    listChargeWhatsappSignals().catch(() => []),
  ]);
  const charges = sortChargesByPriority(loadedCharges);
  const chargeWhatsappHistory = await listChargeWhatsappHistory(charges).catch(() => new Map());
  const customersByName = new Map(customers.map((customer) => [customer.name, customer]));
  const whatsappActivityByCustomerName = new Map(customerWhatsappActivity.map((entry) => [entry.customerName, entry]));
  const whatsappSignalsByCustomerName = new Map(chargeWhatsappSignals.map((entry) => [entry.customerName, entry]));
  const evolution = getEvolutionIntegrationStatus();
  const approvedQuotes = quotes.filter((quote) => quote.status === "Aprovado");
  const followUpActions = buildChargeFollowUpActions(charges);
  const reminderQueue = buildChargeReminderQueue(charges);
  const followUpSummary = summarizeChargeFollowUp(followUpActions);
  const unscheduledCount = followUpActions.filter((action) => action.bucket === "unmapped").length;
  const whatsappReplyCount = chargeWhatsappSignals.filter((entry) => entry.inboundReplyDetected).length;
  const whatsappSuggestedCount = chargeWhatsappSignals.filter((entry) => entry.suggestedOutcome).length;
  const whatsappInsights = buildBillingWhatsappInsights(charges, chargeWhatsappSignals as ChargeWhatsappSignal[]);
  const chargesById = new Map(charges.map((charge) => [charge.id, charge]));
  const chargesNeedingHumanTriage = whatsappInsights.items
    .filter((item) => item.requiresHumanAction)
    .slice(0, 4)
    .map((item) => chargesById.get(item.chargeId))
    .filter((item): item is Charge => Boolean(item));
  const nfseByCustomerAndAmount = new Map(
    nfseDocuments.map((document) => [`${document.customer}:::${document.serviceAmount}`, document]),
  );
  const params = await searchParams;
  const savedPreference = await readDashboardQueuePreference("billing");
  const focus = params?.focus || savedPreference.focus || "";
  const requestedView = params?.view || savedPreference.view || "";
  const triageChargeIds = new Set(chargesNeedingHumanTriage.map((item) => item.id));
  const viewFromFocus: Partial<Record<string, BillingQueueView>> = {
    contestations: "triage",
    triage: "triage",
    promises: "waiting",
  };
  const queueView = (requestedView || viewFromFocus[focus] || "all") as BillingQueueView;
  const filteredFollowUpActions = followUpActions.filter((action) => {
    switch (queueView) {
      case "overdue":
        return action.slaStatus === "overdue";
      case "today":
        return action.slaStatus === "today";
      case "waiting":
        return action.slaStatus === "waiting";
      case "unscheduled":
        return action.bucket === "unmapped";
      case "triage":
        return triageChargeIds.has(action.id);
      case "all":
        return true;
    }
  });
  const highlightedFollowUps = filteredFollowUpActions.slice(0, 4);
  const filteredFollowUpActionsById = new Map(filteredFollowUpActions.map((action) => [action.id, action]));
  const filteredReminderQueue = reminderQueue.filter((task) => filteredFollowUpActions.some((action) => action.id === task.chargeId));
  const focusMessage = focus === "contestations"
    ? "O dashboard te trouxe para tratar contestações e respostas financeiras antes de insistir em nova cobrança."
    : focus === "promises"
      ? "O dashboard destacou promessas de pagamento para você acompanhar o recebimento com menos atrito."
      : focus === "triage"
        ? "O dashboard identificou respostas no canal que ainda pedem leitura humana na cobrança."
        : "";

  return (
    <DashboardShell
      currentPath="/dashboard/billing"
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
      {focusMessage ? (
        <div className="auth-hint">
          <strong>Foco operacional</strong>
          <span>{focusMessage}</span>
        </div>
      ) : null}
      <ModuleQueueFilters
        module="billing"
        path="/dashboard/billing"
        currentView={queueView}
        title="Manter a fila financeira no recorte certo"
        helper="A visão escolhida fica salva para este módulo e volta no próximo acesso."
        options={[
          { value: "all", label: "Tudo", count: followUpActions.length },
          { value: "overdue", label: "SLA vencido", count: followUpSummary.slaOverdueCount },
          { value: "today", label: "Hoje", count: followUpSummary.slaTodayCount },
          { value: "waiting", label: "Aguardando", count: followUpSummary.waitingCount },
          { value: "unscheduled", label: "Sem data", count: unscheduledCount },
          { value: "triage", label: "Triagem", count: chargesNeedingHumanTriage.length },
        ]}
      />
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
        <article className="stat-card">
          <span>Respostas no canal</span>
          <strong>{whatsappReplyCount}</strong>
          <p>
            {whatsappSuggestedCount > 0
              ? `${whatsappSuggestedCount} retorno(s) já sugerem leitura operacional para follow-up.`
              : "Acompanhe aqui quem respondeu pelo WhatsApp antes de insistir na cobrança."}
          </p>
        </article>
        <article className="stat-card">
          <span>Triagem humana</span>
          <strong>{chargesNeedingHumanTriage.length}</strong>
          <p>
            {chargesNeedingHumanTriage.length > 0
              ? "Clientes em aberto responderam no canal e pedem leitura antes do próximo disparo."
              : "Nenhuma cobrança aberta com resposta pendente de triagem agora."}
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Cadência financeira</span>
            <h2>Estados explícitos de execução da cobrança</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          <article className="dashboard-card">
            <span className="dashboard-kicker">Cobrar agora</span>
            <h3>{followUpActions.filter((action) => action.slaStatus === "overdue").length} cobrança(s)</h3>
            <p>Entraram em atraso e já pedem ação operacional imediata.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Executar hoje</span>
            <h3>{followUpActions.filter((action) => action.slaStatus === "today").length} cobrança(s)</h3>
            <p>Estão no toque do dia e não deveriam escorregar para amanhã.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Aguardar confirmação</span>
            <h3>{followUpActions.filter((action) => action.slaStatus === "waiting").length} cobrança(s)</h3>
            <p>Receberam resposta do cliente e agora pedem leitura ou conferência, não insistência cega.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Organizar base</span>
            <h3>{followUpActions.filter((action) => action.bucket === "unmapped").length} cobrança(s)</h3>
            <p>Ainda não têm vencimento real e enfraquecem a previsibilidade do caixa.</p>
          </article>
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Leituras do canal</span>
            <h2>O que o WhatsApp já está dizendo sobre a fila de recebimentos</h2>
          </div>
        </div>

        <div className="stats-row">
          <article className="stat-card">
            <span>Promessas</span>
            <strong>{whatsappInsights.summary.promisedCount}</strong>
            <p>Clientes em aberto que responderam sinalizando intenção de pagar.</p>
          </article>
          <article className="stat-card">
            <span>Contestadas</span>
            <strong>{whatsappInsights.summary.contestedCount}</strong>
            <p>Cobranças que pedem tratamento humano antes de qualquer nova insistência.</p>
          </article>
          <article className="stat-card">
            <span>Pago em análise</span>
            <strong>{whatsappInsights.summary.paidInAnalysisCount}</strong>
            <p>Respostas que sugerem comprovante ou pagamento já feito, ainda sem conciliação final.</p>
          </article>
          <article className="stat-card">
            <span>Reagendadas</span>
            <strong>{whatsappInsights.summary.rescheduledCount}</strong>
            <p>Clientes que responderam com novo prazo e precisam de ajuste de cadência.</p>
          </article>
        </div>

        {whatsappInsights.items.length > 0 ? (
          <div className="cards-grid quote-grid">
            {whatsappInsights.items.slice(0, 4).map((item) => (
              <article key={item.chargeId} className="dashboard-card">
                <span className="dashboard-kicker">{item.suggestedOutcome || "Resposta recebida"}</span>
                <h3>{item.customer}</h3>
                <strong className="quote-amount">{item.amount}</strong>
                <p>{item.requiresHumanAction ? "Pede ação humana antes do próximo disparo." : "Já incorporado ao follow-up da cobrança."}</p>
                <small className="muted-text">{item.dueLabel}</small>
                {item.lastEventAt ? (
                  <small className="muted-text">Último retorno em {item.lastEventAt}</small>
                ) : null}
                {item.lastMessagePreview ? (
                  <div className="follow-up-entry">
                    <strong>Mensagem recebida</strong>
                    <small>{item.lastMessagePreview}</small>
                  </div>
                ) : null}
                <Link href="#recebimentos" className="secondary-link">
                  Abrir cobrança
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Canal ainda sem leitura pendente</strong>
            <span>Quando clientes responderem no WhatsApp, essa área passa a separar promessa, contestação e confirmação em análise.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Triagem de respostas</span>
            <h2>Clientes que responderam e merecem ação humana antes de nova cobrança</h2>
          </div>
        </div>

        {chargesNeedingHumanTriage.length > 0 ? (
          <div className="cards-grid quote-grid">
            {chargesNeedingHumanTriage.map((charge) => {
              const signal = whatsappSignalsByCustomerName.get(charge.customer);

              if (!signal) {
                return null;
              }

              return (
                <article key={charge.id} className="dashboard-card">
                  <span className="dashboard-kicker">Resposta recebida</span>
                  <h3>{charge.customer}</h3>
                  <strong className="quote-amount">{charge.amount}</strong>
                  <p>{getHumanTriageLabel(signal)}</p>
                  <small className="muted-text">{getChargeUrgencyLabel(charge)}</small>
                  {signal.lastEventAt ? (
                    <small className="muted-text">Último sinal em {signal.lastEventAt}</small>
                  ) : null}
                  {signal.lastMessagePreview ? (
                    <div className="follow-up-entry">
                      <strong>Mensagem recebida</strong>
                      <small>{signal.lastMessagePreview}</small>
                    </div>
                  ) : null}
                  {signal.suggestedOutcome && signal.suggestedNote ? (
                    <form action={applyWhatsappSignalFollowUpAction} className="card-action">
                      <input type="hidden" name="id" value={charge.id} />
                      <input type="hidden" name="outcome" value={signal.suggestedOutcome} />
                      <input type="hidden" name="note" value={signal.suggestedNote} />
                      <button type="submit" className="primary-link">
                        Registrar {signal.suggestedOutcome}
                      </button>
                    </form>
                  ) : null}
                  <Link href="#recebimentos" className="secondary-link">
                    Ver cobrança completa
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Sem triagem pendente</strong>
            <span>As respostas recentes do WhatsApp já foram incorporadas ao fluxo ou não há cobranças abertas aguardando leitura humana.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Automações do dia</span>
            <h2>Lembretes prontos para executar na fila financeira</h2>
          </div>
        </div>

        {filteredReminderQueue.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredReminderQueue.map((task) => (
              (() => {
                const customer = customersByName.get(task.customer);
                const whatsappActivity = whatsappActivityByCustomerName.get(task.customer);
                const queueAction = filteredFollowUpActionsById.get(task.chargeId);
                const canSendViaEvolution = evolution.enabled
                  && Boolean(customer?.phone)
                  && (task.channel === "WhatsApp" || task.channel === "Pix reenviado");

                return (
                  <article key={task.id} className="dashboard-card">
                    <span className="dashboard-kicker">{task.channel}</span>
                    <h3>{task.title}</h3>
                    <strong className="quote-amount">{task.amount}</strong>
                    <p>{task.reason}</p>
                    <small className="muted-text">{task.slaLabel}</small>
                    <small className="muted-text">{task.nextFollowUpLabel}</small>
                    {queueAction ? <small className="muted-text">{queueAction.cadenceLabel}</small> : null}
                    <small className="muted-text">Execução: {queueAction?.executionLabel || "Registrar contato"}</small>
                    <div className="follow-up-entry">
                      <strong>Mensagem pronta</strong>
                      <small>{task.message}</small>
                    </div>
                    {task.channel === "WhatsApp" || task.channel === "Pix reenviado" ? (
                      <small className="muted-text">
                        {customer?.phone
                          ? `Número cadastrado: ${customer.phone}`
                          : "Cliente ainda sem número cadastrado para envio automático."}
                      </small>
                    ) : null}
                    {whatsappActivity?.eventCount ? (
                      <small className="muted-text">
                        Último sinal no WhatsApp: {whatsappActivity.lastEventAt} · {whatsappActivity.lastEventSummary}
                      </small>
                    ) : null}
                    <div className="dashboard-actions">
                      {task.deliveryUrl && task.deliveryLabel ? (
                        <a href={task.deliveryUrl} target="_blank" rel="noreferrer" className="secondary-link">
                          {task.deliveryLabel}
                        </a>
                      ) : null}
                      {canSendViaEvolution ? (
                        <form action={sendChargeReminderWhatsappAction} className="card-action">
                          <input type="hidden" name="id" value={task.chargeId} />
                          <input type="hidden" name="customer" value={task.customer} />
                          <input type="hidden" name="phone" value={customer?.phone || ""} />
                          <input type="hidden" name="channel" value={task.channel} />
                          <input type="hidden" name="message" value={task.message} />
                          <button type="submit" className="primary-link">
                            Enviar via API
                          </button>
                        </form>
                      ) : null}
                      <form action={runChargeReminderAction} className="card-action">
                        <input type="hidden" name="id" value={task.chargeId} />
                        <input type="hidden" name="channel" value={task.channel} />
                        <input type="hidden" name="outcome" value={task.suggestedOutcome} />
                        <input type="hidden" name="reason" value={task.reason} />
                        <input type="hidden" name="message" value={task.message} />
                        <button type="submit" className="primary-link">
                          Registrar envio
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
            <strong>Sem lembretes pendentes</strong>
            <span>A fila automática não encontrou nenhum lembrete operacional novo agora.</span>
          </div>
        )}
      </section>

      <section id="recebimentos" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Fila de follow-up</span>
            <h2>Cobranças que pedem ação prática agora</h2>
          </div>
          <div className="queue-filter-summary">
            <strong>{highlightedFollowUps.length}</strong>
            <small>item(ns) no recorte atual</small>
          </div>
        </div>

        {highlightedFollowUps.length > 0 ? (
          <div className="cards-grid quote-grid">
            {highlightedFollowUps.map((action) => (
              (() => {
                const linkedCharge = chargesById.get(action.id);
                const latestFollowUp = linkedCharge?.followUps[0];
                const whatsappSignal = whatsappSignalsByCustomerName.get(action.customer);

                return (
                  <article key={action.id} className="dashboard-card">
                    <span className="dashboard-kicker">{action.urgencyLabel}</span>
                    <h3>{action.customer}</h3>
                    <strong className="quote-amount">{action.amount}</strong>
                    <p>{action.summary}</p>
                    <small className="muted-text">{action.slaLabel}</small>
                    <small className="muted-text">{action.nextFollowUpLabel}</small>
                    <small className="muted-text">{action.cadenceLabel}</small>
                    <small className="muted-text">Execução: {action.executionLabel}</small>
                    <small className="muted-text">Etapa concluída: {action.completedStepLabel}</small>
                    <small className="muted-text">Próxima etapa: {action.nextStepLabel}</small>
                    <small className="muted-text">{action.recommendedAction}</small>
                    <small className="muted-text">{action.suggestedMessage}</small>
                    {latestFollowUp ? (
                      <small className="muted-text">
                        Ultimo contato: {action.lastContactLabel}.
                      </small>
                    ) : null}
                    {whatsappSignal?.suggestedOutcome ? (
                      <div className="auth-hint">
                        <strong>Retorno recente no WhatsApp</strong>
                        <span>
                          Cliente respondeu no canal e o texto sugere: {whatsappSignal.suggestedOutcome}.
                        </span>
                      </div>
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
                      <form action={advanceChargeCadenceAction} className="card-action">
                        <input type="hidden" name="id" value={action.id} />
                        <input type="hidden" name="outcome" value="Prometeu pagar" />
                        <input type="hidden" name="note" value="Promessa de pagamento registrada direto na fila financeira." />
                        <input type="hidden" name="dueLabel" value="Cliente prometeu pagar" />
                        <button type="submit" className="ghost-button">
                          Prometeu pagar
                        </button>
                      </form>
                      <form action={advanceChargeCadenceAction} className="card-action">
                        <input type="hidden" name="id" value={action.id} />
                        <input type="hidden" name="outcome" value="Contestou" />
                        <input type="hidden" name="note" value="Contestação registrada direto na fila financeira." />
                        <button type="submit" className="ghost-button">
                          Contestou
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
              const relatedNfse = nfseByCustomerAndAmount.get(`${charge.customer}:::${charge.amount}`);
              const customer = customersByName.get(charge.customer);
              const whatsappActivity = whatsappActivityByCustomerName.get(charge.customer);
              const whatsappSignal = whatsappSignalsByCustomerName.get(charge.customer);
              const whatsappHistory = chargeWhatsappHistory.get(charge.id) || [];

              return (
                <article key={charge.id} className="dashboard-card">
                  <span className="dashboard-kicker">{getChargeUrgencyLabel(charge)}</span>
                  <h3>{charge.customer}</h3>
                  <strong className="quote-amount">{charge.amount}</strong>
                  <p>{charge.source}</p>
                  <small className="muted-text">{charge.dueLabel}</small>
                  {charge.dueDate ? <small className="muted-text">Data real: {charge.dueDate}</small> : null}
                  <small className="muted-text">Status operacional: {charge.status}</small>
                  {charge.externalBilling ? (
                    <small className="muted-text">
                      {charge.externalBilling.provider} {charge.externalBilling.environment === "production" ? "produção" : "sandbox"} · {charge.externalBilling.billingType || "cobrança externa"}
                    </small>
                  ) : null}
                  {automaticAction ? (
                    <>
                      <small className="muted-text">{automaticAction.slaLabel}</small>
                      <small className="muted-text">{automaticAction.nextFollowUpLabel}</small>
                      <small className="muted-text">{automaticAction.cadenceLabel}</small>
                      <small className="muted-text">Execução: {automaticAction.executionLabel}</small>
                      <small className="muted-text">Etapa concluída: {automaticAction.completedStepLabel}</small>
                      <small className="muted-text">Próxima etapa: {automaticAction.nextStepLabel}</small>
                    </>
                  ) : null}
                  <small className="muted-text">
                    {charge.followUps.length > 0
                      ? `${charge.followUps.length} follow-up(s) financeiro(s) registrados`
                      : "Nenhum follow-up financeiro registrado ainda"}
                  </small>
                  {whatsappActivity?.eventCount ? (
                    <div className="auth-hint">
                      <strong>Cliente ativo no WhatsApp</strong>
                      <span>
                        Último evento em {whatsappActivity.lastEventAt}. {whatsappActivity.lastEventSummary}
                      </span>
                      <small className="muted-text">
                        {whatsappActivity.eventCount} evento(s) recente(s) associados a este cliente pelo número cadastrado.
                      </small>
                    </div>
                  ) : customer?.phone ? (
                    <div className="auth-hint">
                      <strong>Sem retorno recente no canal</strong>
                      <span>O cliente tem número cadastrado, mas ainda não houve evento recente associado pelo webhook.</span>
                    </div>
                  ) : null}
                  {whatsappSignal?.suggestedOutcome && whatsappSignal.suggestedNote ? (
                    <div className="auth-hint">
                      <strong>Leitura sugerida do retorno</strong>
                      <span>
                        A última mensagem recebida sugere: {whatsappSignal.suggestedOutcome}.
                      </span>
                      {whatsappSignal.lastMessagePreview ? (
                        <small className="muted-text">&quot;{whatsappSignal.lastMessagePreview}&quot;</small>
                      ) : null}
                      <form action={applyWhatsappSignalFollowUpAction} className="card-action">
                        <input type="hidden" name="id" value={charge.id} />
                        <input type="hidden" name="outcome" value={whatsappSignal.suggestedOutcome} />
                        <input type="hidden" name="note" value={whatsappSignal.suggestedNote} />
                        <button type="submit" className="secondary-link">
                          Registrar retorno sugerido
                        </button>
                      </form>
                    </div>
                  ) : whatsappSignal?.inboundReplyDetected ? (
                    <div className="auth-hint">
                      <strong>Cliente respondeu no canal</strong>
                      <span>
                        Houve mensagem recebida recentemente, mas ainda sem leitura automática confiável para classificar o retorno.
                      </span>
                    </div>
                  ) : null}
                  {whatsappHistory.length > 0 ? (
                    <div className="follow-up-block">
                      <strong>Histórico do WhatsApp desta cobrança</strong>
                      <div className="follow-up-list">
                        {whatsappHistory.map((entry: ChargeWhatsappHistoryEntry) => (
                          <article key={entry.id} className="follow-up-entry">
                            <strong>{entry.createdAt}</strong>
                            <span>{entry.summary}</span>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {charge.externalBilling?.pixCopyPaste ? (
                    <div className="auth-hint">
                      <strong>Pix copia e cola pronto</strong>
                      <span>{charge.externalBilling.pixCopyPaste}</span>
                      {charge.externalBilling.pixExpirationDate ? (
                        <small className="muted-text">Expira em {charge.externalBilling.pixExpirationDate}</small>
                      ) : null}
                    </div>
                  ) : null}
                  {charge.paymentLink ? (
                    <div className="dashboard-actions">
                      <a href={charge.paymentLink} target="_blank" rel="noreferrer" className="secondary-link">
                        Abrir cobrança externa
                      </a>
                    </div>
                  ) : null}
                  {charge.status === "Pago" ? (
                    relatedNfse ? (
                      <div className="auth-hint">
                        <strong>Fiscal em andamento</strong>
                        <span>NFS-e em status {relatedNfse.status.toLowerCase()} para este recebimento.</span>
                      </div>
                    ) : (
                      <div className="auth-hint">
                        <strong>Pronta para nota</strong>
                        <span>Recebimento confirmado e sem rascunho fiscal criado ainda.</span>
                      </div>
                    )
                  ) : null}
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
                  {charge.status === "Pago" && !relatedNfse ? (
                    <form action={createNfseDraftAction} className="card-action">
                      <input type="hidden" name="chargeId" value={charge.id} />
                      <button type="submit" className="primary-link">
                        Criar rascunho fiscal
                      </button>
                    </form>
                  ) : null}
                  {charge.status === "Pago" && relatedNfse ? (
                    <Link href="/dashboard/fiscal" className="secondary-link">
                      Abrir fila fiscal
                    </Link>
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
