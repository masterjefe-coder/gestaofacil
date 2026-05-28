import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { sendManualWhatsappMessageAction } from "@/app/dashboard/whatsapp/actions";
import { listWhatsappConversations } from "@/lib/whatsapp-conversations";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";

type WhatsappPageProps = {
  searchParams?: Promise<{
    customerId?: string;
  }>;
};

function getDirectionLabel(direction: "inbound" | "outbound" | "failed" | "system") {
  switch (direction) {
    case "inbound":
      return "Cliente respondeu";
    case "outbound":
      return "Mensagem enviada";
    case "failed":
      return "Falha no envio";
    default:
      return "Evento do canal";
  }
}

export default async function WhatsappPage({ searchParams }: WhatsappPageProps) {
  const [conversations, setup] = await Promise.all([
    listWhatsappConversations(),
    getWorkspaceSetup(),
  ]);
  const params = await searchParams;
  const focusedCustomerId = params?.customerId || "";
  const filteredConversations = focusedCustomerId
    ? conversations.filter((conversation) => conversation.customerId === focusedCustomerId)
    : conversations;
  const pendingReplyCount = conversations.filter((conversation) => conversation.pendingReply).length;
  const outboundCount = conversations.reduce((total, conversation) => total + conversation.outboundCount, 0);
  const inboundCount = conversations.reduce((total, conversation) => total + conversation.inboundCount, 0);

  return (
    <DashboardShell
      currentPath="/dashboard/whatsapp"
      eyebrow="WhatsApp"
      title="Conversas reais do canal no mesmo fluxo do negocio."
      description="A equipe consegue ver contexto recente, responder manualmente e seguir cliente, orcamento e cobranca sem sair do app."
      actions={
        <>
          <Link href="/dashboard/customers" className="secondary-link">
            Clientes
          </Link>
          <Link href="/dashboard/setup#integrations-section" className="secondary-link">
            Configuracao
          </Link>
        </>
      }
    >
      <section className="stats-row">
        <article className="stat-card">
          <span>Conversas ativas</span>
          <strong>{conversations.length}</strong>
          <p>Contatos com historico real registrado no canal e prontos para leitura operacional.</p>
        </article>
        <article className="stat-card">
          <span>Pedem resposta</span>
          <strong>{pendingReplyCount}</strong>
          <p>Conversas cuja ultima mensagem veio do cliente e merecem retorno humano no app.</p>
        </article>
        <article className="stat-card">
          <span>Entradas recentes</span>
          <strong>{inboundCount}</strong>
          <p>Mensagens recebidas do cliente e associadas ao workspace pelo webhook da Evolution.</p>
        </article>
        <article className="stat-card">
          <span>Saidas registradas</span>
          <strong>{outboundCount}</strong>
          <p>Mensagens disparadas pelo app para cobranca, follow-up, reativacao ou resposta manual.</p>
        </article>
      </section>

      {focusedCustomerId ? (
        <div className="auth-hint">
          <strong>Filtro aplicado</strong>
          <span>A central foi aberta focando o cliente selecionado nas outras areas do sistema.</span>
        </div>
      ) : null}

      <div className="auth-hint">
        <strong>Instância principal da empresa</strong>
        <span>{setup.evolutionInstanceName || "Ainda não definida"}</span>
      </div>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Central do canal</span>
            <h2>Responder e ler sinais sem sair do fluxo</h2>
          </div>
        </div>

        {filteredConversations.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredConversations.map((conversation) => (
              <article key={conversation.phone} className="dashboard-card">
                <span className="dashboard-kicker">
                  {conversation.pendingReply ? "Aguardando resposta" : "Canal em acompanhamento"}
                </span>
                <h3>{conversation.customerName}</h3>
                <p>{conversation.lastSummary}</p>
                <small className="muted-text">
                  Ultimo evento em {conversation.lastEventAt} · {conversation.phone}
                </small>

                <div className="dashboard-top-metrics">
                  <article className="dashboard-metric-tile">
                    <span>Recebidas</span>
                    <strong>{conversation.inboundCount}</strong>
                    <small>Mensagens que chegaram do cliente.</small>
                  </article>
                  <article className="dashboard-metric-tile">
                    <span>Enviadas</span>
                    <strong>{conversation.outboundCount}</strong>
                    <small>Mensagens disparadas pelo app.</small>
                  </article>
                  <article className="dashboard-metric-tile">
                    <span>Falhas</span>
                    <strong>{conversation.failedCount}</strong>
                    <small>Envios que nao concluíram e merecem revisao.</small>
                  </article>
                </div>

                <div className="follow-up-list">
                  {conversation.messages.map((message) => (
                    <article key={message.id} className="follow-up-entry">
                      <strong>{message.createdAt} · {getDirectionLabel(message.direction)}</strong>
                      <span>{message.preview}</span>
                      <small>{message.summary}</small>
                    </article>
                  ))}
                </div>

                <form action={sendManualWhatsappMessageAction} className="follow-up-form">
                  <input type="hidden" name="customerId" value={conversation.customerId || ""} />
                  <input type="hidden" name="phone" value={conversation.phone} />
                  <label className="form-span-2">
                    <span>Responder pelo app</span>
                    <textarea
                      name="message"
                      rows={3}
                      placeholder={`Ex.: Oi, ${conversation.customerName}. Vi sua mensagem e ja vou seguir com voce por aqui.`}
                      required
                    />
                  </label>
                  <button type="submit" className="primary-link">
                    Enviar resposta
                  </button>
                </form>

                <div className="dashboard-actions">
                  <Link href={`/dashboard/customers${conversation.customerId ? `?focus=hot&view=all` : ""}`} className="secondary-link">
                    Abrir clientes
                  </Link>
                  <Link href={conversation.relatedHref} className="secondary-link">
                    Abrir origem
                  </Link>
                  <a
                    href={`https://wa.me/${conversation.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ghost-button"
                  >
                    Abrir WhatsApp
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Sem conversa real ainda</strong>
            <span>Quando o canal receber ou enviar mensagens associadas aos clientes do workspace, a central passa a mostrar a fila aqui.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Como usar</span>
            <h2>Fluxo sugerido para a equipe</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          <article className="dashboard-card">
            <span className="dashboard-kicker">1</span>
            <h3>Ler quem respondeu</h3>
            <p>Comece pelas conversas em aguardando resposta para nao perder timing comercial ou financeiro.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">2</span>
            <h3>Responder no proprio app</h3>
            <p>Use o campo de resposta manual para manter o historico operacional junto do cliente.</p>
          </article>
          <article className="dashboard-card">
            <span className="dashboard-kicker">3</span>
            <h3>Voltar ao modulo certo</h3>
            <p>Depois do retorno, siga para clientes, orcamentos ou financeiro conforme o contexto daquela conversa.</p>
          </article>
        </div>
      </section>
    </DashboardShell>
  );
}
