import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { createCustomerAction, deleteCustomerAction } from "@/app/dashboard/customers/actions";
import { listCustomers } from "@/lib/customer-repository";
import { customerMoments } from "@/lib/site-data";

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <DashboardShell
      eyebrow="Clientes"
      title="O cliente precisa carregar contexto comercial, financeiro e fiscal."
      description="Esta area mostra como o Gestao Facil deve tratar cada cliente como centro do historico de vendas e nao como cadastro morto."
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
            <span className="section-label">Cadastro rapido</span>
            <h2>Adicionar cliente sem sair do fluxo</h2>
          </div>
        </div>

        <form action={createCustomerAction} className="inline-form">
          <label>
            <span>Nome</span>
            <input name="name" type="text" placeholder="Ex.: Oficina Centro Sul" required />
          </label>
          <label>
            <span>Segmento</span>
            <input name="segment" type="text" placeholder="Ex.: Assistencia tecnica" required />
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
            <span>Observacao</span>
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

        <div className="data-table">
          <div className="data-table-head">
            <span>Cliente</span>
            <span>Segmento</span>
            <span>Ultima venda</span>
            <span>Em aberto</span>
            <span>Status</span>
            <span>Acoes</span>
          </div>
          {customers.map((customer) => (
            <article key={customer.id} className="data-table-row">
              <div>
                <strong>{customer.name}</strong>
                <small>{customer.city}</small>
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
          ))}
        </div>
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
