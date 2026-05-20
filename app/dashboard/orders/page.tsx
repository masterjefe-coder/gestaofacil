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
      title="A venda aprovada precisa virar execução clara, não memória da equipe."
      description="Pedidos entram como ponte entre orçamento aprovado, cobrança e emissão, deixando a operação explícita no produto."
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
        helper="O módulo volta no mesmo recorte de execução usado pela equipe."
        options={[
          { value: "all", label: "Tudo", count: orders.length },
          { value: "pending", label: "Pendentes", count: orders.filter((item) => item.status === "Pendente").length },
          { value: "scheduled", label: "Agendados", count: orders.filter((item) => item.status === "Agendado").length },
          { value: "running", label: "Execução", count: orders.filter((item) => item.status === "Em execucao").length },
          { value: "completed", label: "Concluídos", count: orders.filter((item) => item.status === "Concluido").length },
        ]}
      />

      <section id="novo-pedido" className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Gerar pedido</span>
            <h2>Puxar execução a partir de proposta aprovada</h2>
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
                <small className="muted-text">Origem: {order.sourceQuoteId}</small>
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
