import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleQueueFilters } from "@/components/module-queue-filters";
import { createQuoteAction, deleteQuoteAction, sendQuoteWhatsappAction, advanceQuoteCadenceAction } from "@/app/dashboard/quotes/actions";
import { generateDashboardChargeFromQuoteAction } from "@/app/dashboard/actions";
import { buildQuoteFollowUpTemplate } from "@/lib/customer-outreach";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { readDashboardQueuePreference } from "@/lib/dashboard-queue-preferences";
import { listCustomers } from "@/lib/customer-repository";
import { buildQuoteInsights } from "@/lib/quote-insights";
import { listQuotes } from "@/lib/quote-repository";
import { quoteGoals } from "@/lib/site-data";

type QuotesPageProps = {
  searchParams?: Promise<{
    focus?: string;
    view?: string;
  }>;
};

type QuotesQueueView = "all" | "hot" | "followup" | "approved" | "waiting";

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const [customers, quotes, whatsappActivity] = await Promise.all([
    listCustomers(),
    listQuotes(),
    listCustomerWhatsappActivity().catch(() => []),
  ]);
  const quoteInsights = buildQuoteInsights(quotes, customers, whatsappActivity);
  const params = await searchParams;
  const savedPreference = await readDashboardQueuePreference("quotes");
  const focus = params?.focus || savedPreference.focus || "";
  const requestedView = params?.view || savedPreference.view || "";
  const viewFromFocus: Partial<Record<string, QuotesQueueView>> = {
    hot: "hot",
    followup: "followup",
    approved: "approved",
  };
  const queueView = (requestedView || viewFromFocus[focus] || "all") as QuotesQueueView;
  const filteredQuoteInsights = quoteInsights.items.filter((item) => queueView === "all" || item.priority === queueView);
  const focusMessage = focus === "hot"
    ? "O dashboard trouxe você direto para propostas com cliente quente no canal e mais chance de avanço agora."
    : focus === "followup"
      ? "O dashboard destacou a fila de follow-up comercial para evitar que propostas esfriem no pipeline."
      : "";

  return (
    <DashboardShell
      currentPath="/dashboard/quotes"
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
      {focusMessage ? (
        <div className="auth-hint">
          <strong>Foco de proposta</strong>
          <span>{focusMessage}</span>
        </div>
      ) : null}
      <ModuleQueueFilters
        module="quotes"
        path="/dashboard/quotes"
        currentView={queueView}
        title="Fixar a fila comercial mais útil"
        helper="O módulo volta no mesmo recorte de proposta que você estava usando."
        options={[
          { value: "all", label: "Tudo", count: quoteInsights.items.length },
          { value: "hot", label: "Quentes", count: quoteInsights.summary.hotCount },
          { value: "followup", label: "Follow-up", count: quoteInsights.summary.followUpCount },
          { value: "approved", label: "Aprovados", count: quoteInsights.summary.approvedCount },
          { value: "waiting", label: "Aguardando", count: quoteInsights.summary.waitingCount },
        ]}
      />
      <section className="dashboard-overview-hero module-overview-hero">
        <article className="dashboard-spotlight-card fade-in-up">
          <div className="dashboard-spotlight-header">
            <div>
              <span className="section-label">Leitura comercial</span>
              <h2>
                {filteredQuoteInsights[0]?.customer
                  ? `${filteredQuoteInsights[0].customer} é a melhor proposta para agir agora.`
                  : "A fila comercial está pronta para ganhar novas propostas."}
              </h2>
            </div>
            <span className="dashboard-priority-badge priority-high">Pipeline ativo</span>
          </div>
          <p>
            {filteredQuoteInsights[0]?.helper ||
              "Quando a fila aquecer, o melhor próximo passo comercial aparece aqui com contexto e cadência."}
          </p>

          <div className="dashboard-top-metrics">
            <article className="dashboard-metric-tile">
              <span>Quentes</span>
              <strong>{quoteInsights.summary.hotCount}</strong>
              <small>Propostas com cliente ativo e melhor janela de resposta.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Follow-up</span>
              <strong>{quoteInsights.summary.followUpCount}</strong>
              <small>Itens que já pedem retomada explícita no pipeline.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Aprovados</span>
              <strong>{quoteInsights.summary.approvedCount}</strong>
              <small>Prontos para virar cobrança ou próxima etapa operacional.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Aguardando</span>
              <strong>{quoteInsights.summary.waitingCount}</strong>
              <small>Propostas enviadas que merecem nova cadência ou leitura.</small>
            </article>
          </div>
        </article>

        <aside className="dashboard-overview-stack">
          <article className="dashboard-mini-panel fade-in-up fade-delay-1">
            <span className="section-label">Objetivo do módulo</span>
            <div className="dashboard-mini-list">
              <article>
                <strong>Fechar mais rápido</strong>
                <p>Dar contexto suficiente para a equipe agir sem caçar histórico.</p>
              </article>
              <article>
                <strong>Evitar proposta fria</strong>
                <p>O follow-up entra como rotina visível e não como memória do operador.</p>
              </article>
            </div>
          </article>

          <article className="dashboard-mini-panel fade-in-up fade-delay-2">
            <span className="section-label">Atalhos rápidos</span>
            <div className="dashboard-shortcuts-grid">
              <a href="#novo-orcamento" className="dashboard-shortcut-card">
                <strong>Novo orçamento</strong>
                <span>Montar proposta</span>
              </a>
              <Link href="/dashboard/customers" className="dashboard-shortcut-card">
                <strong>Clientes</strong>
                <span>Buscar contexto</span>
              </Link>
              <Link href="/dashboard/billing" className="dashboard-shortcut-card">
                <strong>Cobranças</strong>
                <span>Converter aprovados</span>
              </Link>
              <Link href="/dashboard" className="dashboard-shortcut-card">
                <strong>Dashboard</strong>
                <span>Voltar ao comando</span>
              </Link>
            </div>
          </article>
        </aside>
      </section>
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
            <span className="section-label">Cadência comercial</span>
            <h2>Estados explícitos de execução da proposta</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          <article className="dashboard-card">
            <span className="dashboard-kicker">Responder agora</span>
            <h3>{quoteInsights.summary.hotCount} proposta(s)</h3>
            <p>Cliente respondeu no canal e vale aproveitar esse calor antes de esfriar.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Nova tentativa</span>
            <h3>{quoteInsights.summary.followUpCount} proposta(s)</h3>
            <p>Já estão em follow-up e pedem retomada com mensagem curta e próxima ação clara.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Converter agora</span>
            <h3>{quoteInsights.summary.approvedCount} proposta(s)</h3>
            <p>A aprovação já existe e o próximo estado do fluxo deve ser cobrança ou operação.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">Monitorar</span>
            <h3>{quoteInsights.summary.waitingCount} proposta(s)</h3>
            <p>Continuam aguardando leitura ou resposta do cliente antes do próximo toque comercial.</p>
          </article>
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Fila comercial</span>
            <h2>Quais propostas merecem ação primeiro</h2>
          </div>
        </div>

        {filteredQuoteInsights.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredQuoteInsights.slice(0, 4).map((item) => (
              <article key={item.quoteId} className="dashboard-card">
                <span className="dashboard-kicker">{item.priorityLabel}</span>
                <h3>{item.customer}</h3>
                <strong className="quote-amount">{item.amount}</strong>
                <p>{item.title}</p>
                <small className="muted-text">{item.helper}</small>
                <small className="muted-text">{item.cadenceLabel}</small>
                <small className="muted-text">Execução: {item.executionLabel}</small>
                <small className="muted-text">Etapa concluída: {item.completedStepLabel}</small>
                <small className="muted-text">Próxima etapa: {item.nextStepLabel}</small>
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
                <div className="dashboard-actions">
                  {item.status !== "Follow-up" && item.status !== "Aprovado" ? (
                    <form action={advanceQuoteCadenceAction} className="card-action">
                      <input type="hidden" name="id" value={item.quoteId} />
                      <input type="hidden" name="status" value="Follow-up" />
                      <input type="hidden" name="dueLabel" value="Follow-up comercial em andamento" />
                      <input type="hidden" name="summary" value="Proposta puxada para cadência ativa no painel." />
                      <button type="submit" className="secondary-link">
                        Entrar em follow-up
                      </button>
                    </form>
                  ) : null}
                  {item.status !== "Aprovado" ? (
                    <form action={advanceQuoteCadenceAction} className="card-action">
                      <input type="hidden" name="id" value={item.quoteId} />
                      <input type="hidden" name="status" value="Aprovado" />
                      <input type="hidden" name="dueLabel" value="Aprovado e pronto para cobrança" />
                      <input type="hidden" name="summary" value="Aprovação registrada direto na fila comercial." />
                      <button type="submit" className="primary-link">
                        Marcar aprovado
                      </button>
                    </form>
                  ) : (
                    <form action={generateDashboardChargeFromQuoteAction} className="card-action">
                      <input type="hidden" name="id" value={item.quoteId} />
                      <button type="submit" className="primary-link">
                        Gerar cobrança
                      </button>
                    </form>
                  )}
                </div>
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

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Cadência assistida</span>
            <h2>Mensagens prontas para destravar propostas sem sair do fluxo</h2>
          </div>
        </div>

        {filteredQuoteInsights.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredQuoteInsights
              .filter((item) => item.customerPhone && item.status !== "Aprovado")
              .slice(0, 4)
              .map((item) => {
                const template = buildQuoteFollowUpTemplate({
                  quote: {
                    id: item.quoteId,
                    customer: item.customer,
                    title: item.title,
                    amount: item.amount,
                    status: item.status,
                    dueLabel: item.dueLabel,
                    summary: item.summary,
                  },
                });

                return (
                  <article key={`cadence-${item.quoteId}`} className="dashboard-card">
                    <span className="dashboard-kicker">{item.priorityLabel}</span>
                    <h3>{item.customer}</h3>
                    <p>{template.title}</p>
                    <small className="muted-text">{item.cadenceLabel}</small>
                    <small className="muted-text">Execução: {item.executionLabel}</small>
                    <small className="muted-text">Etapa concluída: {item.completedStepLabel}</small>
                    <small className="muted-text">Próxima etapa: {item.nextStepLabel}</small>
                    <small className="muted-text">{template.message}</small>
                    <div className="dashboard-actions">
                      <a
                        href={`https://wa.me/${item.customerPhone?.replace(/\D/g, "")}?text=${encodeURIComponent(template.message)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-link"
                      >
                        Abrir WhatsApp
                      </a>
                      <form action={sendQuoteWhatsappAction} className="card-action">
                        <input type="hidden" name="id" value={item.quoteId} />
                        <button type="submit" className="primary-link">
                          Enviar via API
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Cadência ainda vazia</strong>
            <span>Quando houver propostas com telefone cadastrado, esta área prepara o follow-up comercial para envio rápido.</span>
          </div>
        )}
      </section>

      <section className="cards-grid quote-grid">
        {filteredQuoteInsights.map((quote) => (
          <article key={quote.quoteId} className="dashboard-card">
            <span className="dashboard-kicker">{quote.priorityLabel}</span>
            <h3>{quote.title}</h3>
            <p>{quote.customer}</p>
            <strong className="quote-amount">{quote.amount}</strong>
            <p>{quote.summary}</p>
            <small className="muted-text">{quote.cadenceLabel}</small>
            <small className="muted-text">Execução: {quote.executionLabel}</small>
            <small className="muted-text">Etapa concluída: {quote.completedStepLabel}</small>
            <small className="muted-text">Próxima etapa: {quote.nextStepLabel}</small>
            <small className="muted-text">{quote.dueLabel}</small>
            <small className="muted-text">{quote.helper}</small>
            {quote.customerStatus ? (
              <small className="muted-text">Cliente: {quote.customerStatus}{quote.customerOpenAmount ? ` · Em aberto ${quote.customerOpenAmount}` : ""}</small>
            ) : null}
            <div className="dashboard-actions">
              {quote.status !== "Follow-up" && quote.status !== "Aprovado" ? (
                <form action={advanceQuoteCadenceAction} className="card-action">
                  <input type="hidden" name="id" value={quote.quoteId} />
                  <input type="hidden" name="status" value="Follow-up" />
                  <input type="hidden" name="dueLabel" value="Follow-up comercial em andamento" />
                  <input type="hidden" name="summary" value="Proposta puxada para cadência ativa no painel." />
                  <button type="submit" className="secondary-link">
                    Follow-up
                  </button>
                </form>
              ) : null}
              {quote.status !== "Aprovado" ? (
                <form action={advanceQuoteCadenceAction} className="card-action">
                  <input type="hidden" name="id" value={quote.quoteId} />
                  <input type="hidden" name="status" value="Aprovado" />
                  <input type="hidden" name="dueLabel" value="Aprovado e pronto para cobrança" />
                  <input type="hidden" name="summary" value="Aprovação registrada direto na fila comercial." />
                  <button type="submit" className="primary-link">
                    Aprovar
                  </button>
                </form>
              ) : (
                <form action={generateDashboardChargeFromQuoteAction} className="card-action">
                  <input type="hidden" name="id" value={quote.quoteId} />
                  <button type="submit" className="primary-link">
                    Cobrança
                  </button>
                </form>
              )}
            </div>
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
