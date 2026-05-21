import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleQueueFilters } from "@/components/module-queue-filters";
import {
  generateDashboardChargeFromQuoteAction,
  markDashboardChargeTodayAction,
  markDashboardCustomerStatusAction,
} from "@/app/dashboard/actions";
import { createCustomerAction, deleteCustomerAction, sendCustomerReactivationWhatsappAction } from "@/app/dashboard/customers/actions";
import { sendQuoteWhatsappAction } from "@/app/dashboard/quotes/actions";
import { buildChargeFollowUpActions } from "@/lib/charge-follow-up";
import { buildCustomerReactivationTemplate } from "@/lib/customer-outreach";
import { buildCustomerEngagementInsights } from "@/lib/customer-engagement-insights";
import { readDashboardQueuePreference } from "@/lib/dashboard-queue-preferences";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { listCustomerUnifiedTimeline, type CustomerTimelineEntry } from "@/lib/customer-unified-timeline";
import { listCharges } from "@/lib/charge-repository";
import { listCustomers } from "@/lib/customer-repository";
import { buildQuoteInsights } from "@/lib/quote-insights";
import { listQuotes } from "@/lib/quote-repository";
import { customerMoments } from "@/lib/site-data";

type CustomersPageProps = {
  searchParams?: Promise<{
    focus?: string;
    view?: string;
  }>;
};

type CustomersQueueView = "all" | "hot" | "followup" | "reactivation" | "stable";

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const [customers, whatsappActivity, quotes, charges] = await Promise.all([
    listCustomers(),
    listCustomerWhatsappActivity().catch(() => []),
    listQuotes(),
    listCharges(),
  ]);
  const unifiedTimeline = await listCustomerUnifiedTimeline().catch(() => new Map());
  const whatsappActivityByCustomerId = new Map(whatsappActivity.map((entry) => [entry.customerId, entry]));
  const customersWithWhatsappHistory = whatsappActivity.filter((entry) => entry.eventCount > 0).length;
  const engagement = buildCustomerEngagementInsights(customers, whatsappActivity);
  const quoteInsights = buildQuoteInsights(quotes, customers, whatsappActivity);
  const chargeFollowUpActions = buildChargeFollowUpActions(charges);
  const quoteByCustomerName = new Map<string, (typeof quoteInsights.items)[number]>();
  const chargeByCustomerName = new Map<string, (typeof chargeFollowUpActions)[number]>();

  for (const quote of quoteInsights.items) {
    if (!quoteByCustomerName.has(quote.customer)) {
      quoteByCustomerName.set(quote.customer, quote);
    }
  }

  for (const action of chargeFollowUpActions) {
    if (!chargeByCustomerName.has(action.customer)) {
      chargeByCustomerName.set(action.customer, action);
    }
  }

  const params = await searchParams;
  const savedPreference = await readDashboardQueuePreference("customers");
  const focus = params?.focus || savedPreference.focus || "";
  const requestedView = params?.view || savedPreference.view || "";
  const viewFromFocus: Partial<Record<string, CustomersQueueView>> = {
    hot: "hot",
    reactivation: "reactivation",
  };
  const queueView = (requestedView || viewFromFocus[focus] || "all") as CustomersQueueView;
  const filteredEngagementItems = engagement.items.filter((item) => queueView === "all" || item.priority === queueView);
  const focusMessage = focus === "hot"
    ? "O dashboard te trouxe para responder clientes quentes enquanto o canal ainda está favorável."
    : focus === "reactivation"
      ? "O dashboard destacou clientes bons para reativação, com espaço claro para retomar a conversa."
      : "";

  return (
    <DashboardShell
      currentPath="/dashboard/customers"
      eyebrow="Clientes"
      title="Cada cliente precisa ter histórico, contexto e próximo passo claro."
      description="Aqui você acompanha relacionamento, oportunidades, cobranças e retomadas sem tratar cliente como cadastro parado."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <a href="#novo-cliente" className="primary-link">
            Novo cliente
          </a>
        </>
      }
    >
      {focusMessage ? (
        <div className="auth-hint">
          <strong>Foco comercial</strong>
          <span>{focusMessage}</span>
        </div>
      ) : null}
      <ModuleQueueFilters
        module="customers"
        path="/dashboard/customers"
        currentView={queueView}
        title="Abrir a base no recorte certo"
        helper="A tela lembra o último filtro usado pela equipe."
        options={[
          { value: "all", label: "Tudo", count: engagement.items.length },
          { value: "hot", label: "Quentes", count: engagement.summary.hotCount },
          { value: "followup", label: "Follow-up", count: engagement.summary.followUpCount },
          { value: "reactivation", label: "Reativação", count: engagement.summary.reactivationCount },
          { value: "stable", label: "Estáveis", count: engagement.summary.stableCount },
        ]}
      />
      <section className="dashboard-overview-hero module-overview-hero">
        <article className="dashboard-spotlight-card fade-in-up">
          <div className="dashboard-spotlight-header">
            <div>
              <span className="section-label">Leitura de relacionamento</span>
              <h2>
                {filteredEngagementItems[0]?.customerName
                  ? `${filteredEngagementItems[0].customerName} é o cliente com melhor próximo passo agora.`
                  : "A base de clientes está organizada e pronta para ganhar mais contexto."}
              </h2>
            </div>
            <span className="dashboard-priority-badge priority-normal">Base ativa</span>
          </div>
          <p>
            {filteredEngagementItems[0]?.helper ||
              "Quando clientes acumularem sinais de conversa, proposta e cobrança, o módulo prioriza isso aqui no topo."}
          </p>

          <div className="dashboard-top-metrics">
            <article className="dashboard-metric-tile">
              <span>Quentes</span>
              <strong>{engagement.summary.hotCount}</strong>
              <small>Clientes com sinal forte no canal e boa janela para avançar conversa.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Follow-up</span>
              <strong>{engagement.summary.followUpCount}</strong>
              <small>Relacionamentos que já justificam próximo toque comercial.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Reativação</span>
              <strong>{engagement.summary.reactivationCount}</strong>
              <small>Base com espaço claro para retomar contato e receita.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Histórico real</span>
              <strong>{customersWithWhatsappHistory}</strong>
              <small>Clientes já conectados a eventos reais do WhatsApp.</small>
            </article>
          </div>
        </article>

        <aside className="dashboard-overview-stack">
          <article className="dashboard-mini-panel fade-in-up fade-delay-1">
            <span className="section-label">Objetivo do módulo</span>
            <div className="dashboard-mini-list">
              <article>
                <strong>Parar de tratar cliente como cadastro parado</strong>
                <p>Histórico de conversa, proposta e cobrança precisa viver no mesmo lugar.</p>
              </article>
              <article>
                <strong>Agir com contexto</strong>
                <p>Follow-up e retomada entram com base em sinais reais, não na memória do time.</p>
              </article>
            </div>
          </article>

          <article className="dashboard-mini-panel fade-in-up fade-delay-2">
            <span className="section-label">Atalhos rápidos</span>
            <div className="dashboard-shortcuts-grid">
              <a href="#novo-cliente" className="dashboard-shortcut-card">
                <strong>Novo cliente</strong>
                <span>Cadastrar rápido</span>
              </a>
              <Link href="/dashboard/quotes" className="dashboard-shortcut-card">
                <strong>Orçamentos</strong>
                <span>Ver pipeline</span>
              </Link>
              <Link href="/dashboard/billing" className="dashboard-shortcut-card">
                <strong>Cobranças</strong>
                <span>Ler aberto</span>
              </Link>
              <Link href="/dashboard" className="dashboard-shortcut-card">
                <strong>Dashboard</strong>
                <span>Voltar ao comando</span>
              </Link>
            </div>
          </article>
        </aside>
      </section>
      <section id="novo-cliente" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Cadastro rápido</span>
            <h2>Adicionar cliente sem sair do fluxo</h2>
          </div>
        </div>

        <form action={createCustomerAction} className="inline-form">
          <label>
            <span>Nome</span>
            <input name="name" type="text" placeholder="Ex.: Oficina Centro Sul" required />
          </label>
          <label>
            <span>WhatsApp</span>
            <input name="phone" type="text" placeholder="Ex.: 5511999998888" />
          </label>
          <label>
            <span>CPF/CNPJ</span>
            <input name="document" type="text" placeholder="Opcional para emissão rápida" />
          </label>
          <label>
            <span>Segmento</span>
            <input name="segment" type="text" placeholder="Ex.: Assistência técnica" required />
          </label>
          <label>
            <span>Cidade</span>
            <input name="city" type="text" placeholder="Ex.: Belo Horizonte" required />
          </label>
          <label>
            <span>Status</span>
            <select name="status" defaultValue="Ativo">
              <option value="Ativo">Ativo</option>
              <option value="Aguardando retorno">Aguardando retorno</option>
              <option value="Recorrente">Recorrente</option>
            </select>
          </label>
          <label className="form-span-2">
            <span>Observação</span>
            <input
              name="note"
              type="text"
              placeholder="Ex.: Quer proposta recorrente e prefere contato por WhatsApp."
            />
          </label>
          <button type="submit" className="primary-link form-submit">
            Salvar cliente
          </button>
        </form>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Base ativa</span>
            <h2>Clientes com contexto para vender melhor</h2>
          </div>
        </div>

        <div className="auth-hint">
            <strong>WhatsApp com sinal real</strong>
            <span>
            {customersWithWhatsappHistory > 0
              ? `${customersWithWhatsappHistory} cliente(s) já têm atividade real registrada no WhatsApp.`
              : "Ainda não há atividade real de WhatsApp associada aos clientes cadastrados."}
            </span>
          </div>

        <section className="stats-row">
          <article className="stat-card">
            <span>Quentes no canal</span>
            <strong>{engagement.summary.hotCount}</strong>
            <p>Clientes com retorno real no WhatsApp e contexto pronto para abordagem comercial.</p>
          </article>
          <article className="stat-card">
            <span>Pedem follow-up</span>
            <strong>{engagement.summary.followUpCount}</strong>
            <p>Relacionamentos que já justificam próxima ação, sem depender de busca manual.</p>
          </article>
          <article className="stat-card">
            <span>Reativação</span>
            <strong>{engagement.summary.reactivationCount}</strong>
            <p>Clientes sem sinal recente e com espaço claro para retomar a conversa.</p>
          </article>
          <article className="stat-card">
            <span>Base estável</span>
            <strong>{engagement.summary.stableCount}</strong>
            <p>Clientes sem urgência imediata, úteis para previsibilidade e rotina recorrente.</p>
          </article>
        </section>

        <div className="data-table">
          <div className="data-table-head">
            <span>Cliente</span>
            <span>WhatsApp</span>
            <span>Atividade recente</span>
            <span>Segmento</span>
            <span>Última venda</span>
            <span>Em aberto</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {customers.map((customer) => (
            (() => {
              const activity = whatsappActivityByCustomerId.get(customer.id);

              return (
                <article key={customer.id} className="data-table-row">
                  <div>
                    <strong>{customer.name}</strong>
                    <small>{customer.document ? `${customer.city} · ${customer.document}` : customer.city}</small>
                  </div>
                  <span>{customer.phone || "Sem número"}</span>
                  <div>
                    <strong>{activity?.lastEventAt || "Sem evento real"}</strong>
                    <small>{activity?.lastEventSummary || "Ainda não houve mensagem recente ligada a este cliente."}</small>
                  </div>
                  <span>{customer.segment}</span>
                  <span>{customer.lastSale}</span>
                  <span>{customer.openAmount}</span>
                  <div>
                    <strong>{customer.status}</strong>
                    <small>{customer.note}</small>
                  </div>
                  <form action={deleteCustomerAction} className="row-action">
                    <input type="hidden" name="id" value={customer.id} />
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

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Atenção comercial</span>
            <h2>Quem merece ação primeiro</h2>
          </div>
        </div>

        {filteredEngagementItems.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredEngagementItems.slice(0, 4).map((item) => (
              <article key={item.customerId} className="dashboard-card">
                <span className="dashboard-kicker">{item.priority === "hot" ? "Quente" : item.priority === "followup" ? "Follow-up" : item.priority === "reactivation" ? "Reativação" : "Estável"}</span>
                <h3>{item.customerName}</h3>
                <p>{item.headline}</p>
                <small className="muted-text">{item.helper}</small>
                {item.lastEventAt ? <small className="muted-text">Último sinal em {item.lastEventAt}</small> : null}
                <small className="muted-text">Em aberto: {item.openAmount} · Última venda: {item.lastSale}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Base ainda sem leitura operacional</strong>
            <span>Assim que clientes ganharem histórico e sinais no canal, esta área passa a ordenar follow-up, calor e reativação.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Reativação assistida</span>
            <h2>Mensagens prontas para retomar contato</h2>
          </div>
        </div>

        {filteredEngagementItems.some((item) => item.priority === "reactivation" && item.phone) ? (
          <div className="cards-grid quote-grid">
            {filteredEngagementItems
              .filter((item) => item.priority === "reactivation" && item.phone)
              .slice(0, 4)
              .map((item) => {
                const template = buildCustomerReactivationTemplate({
                  id: item.customerId,
                  name: item.customerName,
                  phone: item.phone,
                  document: undefined,
                  segment: "",
                  city: item.city,
                  status: item.status,
                  lastSale: item.lastSale,
                  openAmount: item.openAmount,
                  note: item.helper,
                });

                return (
                  <article key={`reactivation-${item.customerId}`} className="dashboard-card">
                    <span className="dashboard-kicker">Reativação</span>
                    <h3>{item.customerName}</h3>
                    <p>{template.title}</p>
                    <small className="muted-text">{template.message}</small>
                    <div className="dashboard-actions">
                      <a
                        href={`https://wa.me/${item.phone?.replace(/\D/g, "")}?text=${encodeURIComponent(template.message)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="secondary-link"
                      >
                        Abrir WhatsApp
                      </a>
                      <form action={sendCustomerReactivationWhatsappAction} className="card-action">
                        <input type="hidden" name="id" value={item.customerId} />
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
            <strong>Sem reativação pronta</strong>
            <span>Quando houver clientes da base com pouco sinal recente e número cadastrado, a mensagem de retomada aparece aqui pronta para disparo.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Timeline unificada</span>
            <h2>Histórico completo no mesmo lugar</h2>
          </div>
        </div>

        {filteredEngagementItems.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredEngagementItems.slice(0, 4).map((item) => {
              const timeline = unifiedTimeline.get(item.customerId) || [];
              const suggestedQuote = quoteByCustomerName.get(item.customerName);
              const financialAction = chargeByCustomerName.get(item.customerName);

              return (
                <article key={item.customerId} className="dashboard-card">
                  <span className="dashboard-kicker">{item.customerName}</span>
                  <h3>{item.headline}</h3>
                  <p>{item.helper}</p>
                  <small className="muted-text">Status: {item.status} · Em aberto: {item.openAmount}</small>
                  {suggestedQuote ? (
                    <div className="follow-up-entry">
                      <strong>Próximo passo comercial</strong>
                      <small>{suggestedQuote.cadenceLabel}</small>
                      <small>{suggestedQuote.executionLabel}</small>
                    </div>
                  ) : null}
                  {financialAction ? (
                    <div className="follow-up-entry">
                      <strong>Próximo passo financeiro</strong>
                      <small>{financialAction.cadenceLabel}</small>
                      <small>{financialAction.executionLabel}</small>
                    </div>
                  ) : null}
                  {timeline.length > 0 ? (
                    <div className="follow-up-list">
                      {timeline.slice(0, 5).map((entry: CustomerTimelineEntry) => (
                        <article key={entry.id} className="follow-up-entry">
                          <strong>{entry.createdAt} · {entry.title}</strong>
                          <small>{entry.detail}</small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="auth-hint">
                      <strong>Sem histórico consolidado</strong>
                      <span>Esse cliente ainda não acumulou eventos suficientes para formar uma timeline operacional.</span>
                    </div>
                  )}
                  <div className="dashboard-actions">
                    {item.priority === "reactivation" && item.phone ? (
                      <form action={sendCustomerReactivationWhatsappAction} className="card-action">
                        <input type="hidden" name="id" value={item.customerId} />
                        <button type="submit" className="primary-link">
                          Reativar via API
                        </button>
                      </form>
                    ) : null}
                    {suggestedQuote?.customerPhone && suggestedQuote.status !== "Aprovado" ? (
                      <form action={sendQuoteWhatsappAction} className="card-action">
                        <input type="hidden" name="id" value={suggestedQuote.quoteId} />
                        <button type="submit" className="secondary-link">
                          Enviar follow-up
                        </button>
                      </form>
                    ) : null}
                    {suggestedQuote?.status === "Aprovado" ? (
                      <form action={generateDashboardChargeFromQuoteAction} className="card-action">
                        <input type="hidden" name="id" value={suggestedQuote.quoteId} />
                        <button type="submit" className="secondary-link">
                          Gerar cobrança
                        </button>
                      </form>
                    ) : null}
                    {financialAction && financialAction.urgency !== "today" ? (
                      <form action={markDashboardChargeTodayAction} className="card-action">
                        <input type="hidden" name="id" value={financialAction.id} />
                        <button type="submit" className="secondary-link">
                          Puxar cobrança
                        </button>
                      </form>
                    ) : null}
                    {item.status !== "Aguardando retorno" ? (
                      <form action={markDashboardCustomerStatusAction} className="card-action">
                        <input type="hidden" name="id" value={item.customerId} />
                        <input type="hidden" name="status" value="Aguardando retorno" />
                        <input type="hidden" name="note" value="Cliente colocado em acompanhamento 360 pela timeline." />
                        <button type="submit" className="ghost-button">
                          Marcar acompanhamento
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Timeline ainda vazia</strong>
            <span>Quando clientes acumularem propostas, cobranças, mensagens e fiscal, a visão 360 começa a aparecer aqui.</span>
            <span>Quando clientes acumularem propostas, cobranças, mensagens e notas, a visão completa começa a aparecer aqui.</span>
          </div>
        )}
      </section>

      <section className="section-grid">
        <div>
          <span className="section-label">O que essa tela precisa resolver</span>
          <h2>Menos busca manual, mais contexto na mesma tela.</h2>
        </div>
        <div className="cards-grid">
          {customerMoments.map((item) => (
            <article key={item.title} className="info-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
