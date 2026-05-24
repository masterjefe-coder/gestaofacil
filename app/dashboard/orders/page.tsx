import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleQueueFilters } from "@/components/module-queue-filters";
import { createOrderFromQuoteAction, updateOrderStatusAction } from "@/app/dashboard/orders/actions";
import { readDashboardQueuePreference } from "@/lib/dashboard-queue-preferences";
import { listOrders } from "@/lib/order-repository";
import { listQuotes } from "@/lib/quote-repository";

type OrdersPageProps = {
  searchParams?: Promise<{
    view?: string;
  }>;
};

type OrdersQueueView = "all" | "pending" | "scheduled" | "running" | "completed";

function getOrderPriorityLabel(status: string) {
  switch (status) {
    case "Agendado":
      return "Agendado";
    case "Em execucao":
      return "Em execução";
    case "Concluido":
      return "Concluído";
    default:
      return "Pendente";
  }
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const [orders, quotes] = await Promise.all([
    listOrders(),
    listQuotes(),
  ]);
  const approvedQuotes = quotes.filter((quote) => quote.status === "Aprovado");
  const params = await searchParams;
  const savedPreference = await readDashboardQueuePreference("orders");
  const queueView = ((params?.view || savedPreference.view || "all") as OrdersQueueView);
  const filteredOrders = orders.filter((order) => {
    switch (queueView) {
      case "pending":
        return order.status === "Pendente";
      case "scheduled":
        return order.status === "Agendado";
      case "running":
        return order.status === "Em execucao";
      case "completed":
        return order.status === "Concluido";
      default:
        return true;
    }
  });

  return (
    <DashboardShell
      currentPath="/dashboard/orders"
      eyebrow="Pedidos"
      title="Venda aprovada precisa virar execução visível e organizada."
      description="Pedidos conectam proposta, agenda, entrega e próximos passos sem depender da memória do time."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <a href="#novo-pedido" className="primary-link">
            Gerar pedido
          </a>
        </>
      }
    >
      <ModuleQueueFilters
        module="orders"
        path="/dashboard/orders"
        currentView={queueView}
        title="Fixar a fila operacional de pedidos"
        helper="O módulo volta no recorte operacional mais usado pela equipe."
        options={[
          { value: "all", label: "Tudo", count: orders.length },
          { value: "pending", label: "Pendentes", count: orders.filter((item) => item.status === "Pendente").length },
          { value: "scheduled", label: "Agendados", count: orders.filter((item) => item.status === "Agendado").length },
          { value: "running", label: "Execução", count: orders.filter((item) => item.status === "Em execucao").length },
          { value: "completed", label: "Concluídos", count: orders.filter((item) => item.status === "Concluido").length },
        ]}
      />
      <section className="dashboard-overview-hero module-overview-hero">
        <article className="dashboard-spotlight-card fade-in-up">
          <div className="dashboard-spotlight-header">
            <div>
              <span className="section-label">Leitura operacional</span>
              <h2>
                {filteredOrders[0]?.customer
                  ? `${filteredOrders[0].customer} lidera a execução que precisa de clareza agora.`
                  : "A fila operacional está pronta para receber novos pedidos aprovados."}
              </h2>
            </div>
            <span className="dashboard-priority-badge priority-high">Execução ativa</span>
          </div>
          <p>
            {filteredOrders[0]?.note ||
              "Quando orçamento aprovado virar serviço em andamento, o módulo puxa esse contexto para o topo da operação."}
          </p>

          <div className="dashboard-top-metrics">
            <article className="dashboard-metric-tile">
              <span>Pendentes</span>
              <strong>{orders.filter((item) => item.status === "Pendente").length}</strong>
              <small>Pedidos aprovados que ainda pedem agenda ou definição operacional.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Agendados</span>
              <strong>{orders.filter((item) => item.status === "Agendado").length}</strong>
              <small>Execuções combinadas e próximas da entrega real.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Em execução</span>
              <strong>{orders.filter((item) => item.status === "Em execucao").length}</strong>
              <small>Itens que pedem acompanhamento até conclusão.</small>
            </article>
            <article className="dashboard-metric-tile">
              <span>Concluídos</span>
              <strong>{orders.filter((item) => item.status === "Concluido").length}</strong>
              <small>Pedidos já prontos para próximos passos financeiros e fiscais.</small>
            </article>
          </div>
        </article>

        <aside className="dashboard-overview-stack">
          <article className="dashboard-mini-panel fade-in-up fade-delay-1">
            <span className="section-label">Objetivo do módulo</span>
            <div className="dashboard-mini-list">
              <article>
                <strong>Visualizar a operação</strong>
                <p>Pedido vira estado operacional explícito e visível no sistema.</p>
              </article>
              <article>
                <strong>Ligar venda e entrega</strong>
                <p>Aprovação comercial continua até conclusão e fiscal, sem buracos no fluxo.</p>
              </article>
            </div>
          </article>

          <article className="dashboard-mini-panel fade-in-up fade-delay-2">
            <span className="section-label">Atalhos rápidos</span>
            <div className="dashboard-shortcuts-grid">
              <a href="#novo-pedido" className="dashboard-shortcut-card">
                <strong>Gerar pedido</strong>
                <span>Converter aprovado</span>
              </a>
              <Link href="/dashboard/quotes" className="dashboard-shortcut-card">
                <strong>Orçamentos</strong>
                <span>Ver aprovados</span>
              </Link>
              <Link href="/dashboard/fiscal" className="dashboard-shortcut-card">
                <strong>Fiscal</strong>
                <span>Ir para emissão</span>
              </Link>
              <Link href="/dashboard" className="dashboard-shortcut-card">
                <strong>Dashboard</strong>
                <span>Voltar ao comando</span>
              </Link>
            </div>
          </article>
        </aside>
      </section>

      <section id="novo-pedido" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Gerar pedido</span>
            <h2>Puxar a execução a partir do aprovado</h2>
          </div>
        </div>

        <form action={createOrderFromQuoteAction} className="inline-form">
          <label className="form-span-2">
            <span>Orçamento aprovado</span>
            <select name="quoteId" defaultValue="">
              <option value="">Selecione um orçamento aprovado</option>
              {approvedQuotes.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {quote.customer} - {quote.title} - {quote.amount}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary-link form-submit">
            Gerar pedido
          </button>
        </form>
      </section>

      <section className="stats-row">
        <article className="stat-card">
          <span>Pendentes</span>
          <strong>{orders.filter((item) => item.status === "Pendente").length}</strong>
          <p>Pedidos aprovados que ainda precisam entrar na agenda operacional.</p>
        </article>
        <article className="stat-card">
          <span>Agendados</span>
          <strong>{orders.filter((item) => item.status === "Agendado").length}</strong>
          <p>Itens já combinados com o cliente e próximos da execução real.</p>
        </article>
        <article className="stat-card">
          <span>Em execução</span>
          <strong>{orders.filter((item) => item.status === "Em execucao").length}</strong>
          <p>Serviços em andamento que pedem acompanhamento até entrega final.</p>
        </article>
        <article className="stat-card">
          <span>Concluídos</span>
          <strong>{orders.filter((item) => item.status === "Concluido").length}</strong>
          <p>Pedidos finalizados e mais próximos de recebimento concluído e fiscal.</p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Fila operacional</span>
            <h2>Pedidos em andamento no workspace</h2>
          </div>
        </div>

        {filteredOrders.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredOrders.map((order) => (
              <article key={order.id} className="dashboard-card">
                <span className="dashboard-kicker">{getOrderPriorityLabel(order.status)}</span>
                <h3>{order.customer}</h3>
                <strong className="quote-amount">{order.amount}</strong>
                <p>{order.title}</p>
                <small className="muted-text">{order.note}</small>
                <details className="guided-flow-card">
                  <summary>
                    <div>
                      <span className="section-label">Detalhes</span>
                      <h3>Ver origem do pedido</h3>
                      <p>Abra só quando precisar rastrear a proposta que originou esta execução.</p>
                    </div>
                    <span className="guided-flow-badge">Opcional</span>
                  </summary>

                  <div className="guided-flow-body">
                    <div className="dashboard-mini-list">
                      <article>
                        <strong>Origem</strong>
                        <p>{order.sourceQuoteId}</p>
                      </article>
                    </div>
                  </div>
                </details>
                <div className="dashboard-actions">
                  {order.status !== "Agendado" ? (
                    <form action={updateOrderStatusAction} className="card-action">
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value="Agendado" />
                      <input type="hidden" name="note" value="Pedido puxado para agenda operacional." />
                      <button type="submit" className="secondary-link">
                        Agendar
                      </button>
                    </form>
                  ) : null}
                  {order.status !== "Em execucao" ? (
                    <form action={updateOrderStatusAction} className="card-action">
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value="Em execucao" />
                      <input type="hidden" name="note" value="Pedido entrou em execução." />
                      <button type="submit" className="secondary-link">
                        Executar
                      </button>
                    </form>
                  ) : null}
                  {order.status !== "Concluido" ? (
                    <form action={updateOrderStatusAction} className="card-action">
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value="Concluido" />
                      <input type="hidden" name="note" value="Pedido concluído e pronto para próximos passos do fluxo." />
                      <button type="submit" className="primary-link">
                        Concluir
                      </button>
                    </form>
                  ) : (
                    <Link href="/dashboard/fiscal" className="secondary-link">
                      Ver fiscal
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Sem pedidos no recorte atual</strong>
            <span>Quando um orçamento aprovado virar execução, esta fila passa a organizar o andamento operacional.</span>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
