import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { createCustomerAction, deleteCustomerAction } from "@/app/dashboard/customers/actions";
import { buildCustomerEngagementInsights } from "@/lib/customer-engagement-insights";
import { listCustomerWhatsappActivity } from "@/lib/customer-whatsapp-activity";
import { listCustomers } from "@/lib/customer-repository";
import { customerMoments } from "@/lib/site-data";

export default async function CustomersPage() {
  const [customers, whatsappActivity] = await Promise.all([
    listCustomers(),
    listCustomerWhatsappActivity().catch(() => []),
  ]);
  const whatsappActivityByCustomerId = new Map(whatsappActivity.map((entry) => [entry.customerId, entry]));
  const customersWithWhatsappHistory = whatsappActivity.filter((entry) => entry.eventCount > 0).length;
  const engagement = buildCustomerEngagementInsights(customers, whatsappActivity);

  return (
    <DashboardShell
      eyebrow="Clientes"
      title="O cliente precisa carregar contexto comercial, financeiro e fiscal."
      description="Esta área mostra como o Gestão Fácil deve tratar cada cliente como centro do histórico de vendas e não como cadastro morto."
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
              ? `${customersWithWhatsappHistory} cliente(s) já têm atividade real recebida pelo webhook da Evolution.`
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
                    <small>{activity?.lastEventSummary || "Webhook ainda não associou mensagens a este cliente."}</small>
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
            <h2>Quem merece ação primeiro na base de clientes</h2>
          </div>
        </div>

        {engagement.items.length > 0 ? (
          <div className="cards-grid quote-grid">
            {engagement.items.slice(0, 4).map((item) => (
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

      <section className="section-grid">
        <div>
          <span className="section-label">O que essa tela precisa resolver</span>
          <h2>Menos busca manual, mais contexto no mesmo lugar.</h2>
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
