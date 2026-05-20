import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ModuleQueueFilters } from "@/components/module-queue-filters";
import {
  createNfseDraftAction,
  createQuickNfseDraftAction,
  inspectNfseNationalCertificateAction,
  issueNfseNationalAction,
  markNfseErrorAction,
  markNfseIssuedAction,
  markNfseReadyAction,
  testNfseNationalConnectivityAction,
} from "@/app/dashboard/fiscal/actions";
import {
  getFiscalSetupReadiness,
  getNfseNationalIssuePreview,
  listNfseDocuments,
  listNfseReadyQueue,
} from "@/lib/nfse-repository";
import { buildFiscalInsights } from "@/lib/fiscal-insights";
import { readDashboardQueuePreference } from "@/lib/dashboard-queue-preferences";
import { getWorkspaceSetup } from "@/lib/workspace-settings-repository";
import { getNfseNationalMunicipalityStatus } from "@/lib/nfse-national-municipal-status";
import {
  getNfseEmissionModeSummary,
  getNfseNationalIntegrationStatus,
  getNfseNationalPortalUrls,
} from "@/lib/nfse-national-provider";

type FiscalPageProps = {
  searchParams?: Promise<{
    integrationMessage?: string;
    integrationOk?: string;
    certificateMessage?: string;
    certificateOk?: string;
    focus?: string;
    view?: string;
  }>;
};

type FiscalQueueView = "all" | "blocked" | "ready" | "review" | "issued";

export default async function FiscalPage({ searchParams }: FiscalPageProps) {
  const [documents, readyQueue, readiness, setup] = await Promise.all([
    listNfseDocuments(),
    listNfseReadyQueue(),
    getFiscalSetupReadiness(),
    getWorkspaceSetup(),
  ]);
  const municipalityStatus = await getNfseNationalMunicipalityStatus(setup.city || "", setup.state || "");
  const issuePreviews = await Promise.all(
    documents.map(async (document) => [document.id, await getNfseNationalIssuePreview(document.id)] as const),
  );
  const issuePreviewMap = new Map(issuePreviews);
  const params = await searchParams;
  const integrationStatus = getNfseNationalIntegrationStatus();
  const emissionModes = getNfseEmissionModeSummary();
  const portalUrls = getNfseNationalPortalUrls();
  const fiscalInsights = buildFiscalInsights(documents, issuePreviewMap);
  const draftCount = documents.filter((document) => document.status === "Rascunho").length;
  const readyCount = documents.filter((document) => document.status === "Pronta").length;
  const issuedCount = documents.filter((document) => document.status === "Emitida").length;
  const errorCount = documents.filter((document) => document.status === "Erro").length;
  const savedPreference = await readDashboardQueuePreference("fiscal");
  const focus = params?.focus || savedPreference.focus || "";
  const requestedView = params?.view || savedPreference.view || "";
  const viewFromFocus: Partial<Record<string, FiscalQueueView>> = {
    blocked: "blocked",
    ready: "ready",
  };
  const queueView = (requestedView || viewFromFocus[focus] || "all") as FiscalQueueView;
  const filteredFiscalItems = fiscalInsights.items.filter((item) => queueView === "all" || item.priority === queueView);
  const focusMessage = focus === "blocked"
    ? "O dashboard te trouxe para destravar documentos fiscais com pendência estrutural antes de acumular emissão."
    : focus === "ready"
      ? "O dashboard destacou documentos prontos para seguir emissão sem novo retrabalho operacional."
      : "";

  return (
    <DashboardShell
      currentPath="/dashboard/fiscal"
      eyebrow="Fiscal"
      title="A NFS-e precisa nascer do que já foi vendido e recebido."
      description="O bloco fiscal entra como continuação do fluxo comercial e financeiro, sem redigitar dados nem depender de memória."
      actions={
        <>
          <Link href="/dashboard" className="secondary-link">
            Voltar ao dashboard
          </Link>
          <Link href="/dashboard/billing" className="primary-link">
            Revisar cobranças
          </Link>
        </>
      }
    >
      {focusMessage ? (
        <div className="auth-hint">
          <strong>Foco fiscal</strong>
          <span>{focusMessage}</span>
        </div>
      ) : null}
      <ModuleQueueFilters
        module="fiscal"
        path="/dashboard/fiscal"
        currentView={queueView}
        title="Persistir a leitura da fila fiscal"
        helper="Bloqueadas, prontas e revisão passam a abrir no último foco usado pela equipe."
        options={[
          { value: "all", label: "Tudo", count: fiscalInsights.items.length },
          { value: "blocked", label: "Bloqueadas", count: fiscalInsights.summary.blockedCount },
          { value: "ready", label: "Prontas", count: fiscalInsights.summary.readyCount },
          { value: "review", label: "Revisão", count: fiscalInsights.summary.reviewCount },
          { value: "issued", label: "Emitidas", count: fiscalInsights.summary.issuedCount },
        ]}
      />
      <section className="stats-row">
        <article className="stat-card">
          <span>Prontas para rascunho</span>
          <strong>{readyQueue.length}</strong>
          <p>Recebimentos confirmados que já podem virar documento fiscal.</p>
        </article>
        <article className="stat-card">
          <span>Em preparação</span>
          <strong>{draftCount + readyCount}</strong>
          <p>Rascunhos e notas prontas na fila operacional do dia.</p>
        </article>
        <article className="stat-card">
          <span>Emitidas</span>
          <strong>{issuedCount}</strong>
          <p>Documentos já concluídos no fluxo fiscal.</p>
        </article>
        <article className="stat-card">
          <span>Com erro</span>
          <strong>{errorCount}</strong>
          <p>{errorCount > 0 ? "Existe documento pedindo revisão antes da emissão." : "Sem bloqueios fiscais críticos agora."}</p>
        </article>
        <article className="stat-card">
          <span>Bloqueadas</span>
          <strong>{fiscalInsights.summary.blockedCount}</strong>
          <p>
            {fiscalInsights.summary.blockedCount > 0
              ? "Há documentos travados por pendência de setup, município ou dados do tomador."
              : "Nenhum documento está travado por bloqueio estrutural agora."}
          </p>
        </article>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Leitura da fila</span>
            <h2>Onde o fiscal deve agir primeiro</h2>
          </div>
        </div>

        <div className="stats-row">
          <article className="stat-card">
            <span>Prontas</span>
            <strong>{fiscalInsights.summary.readyCount}</strong>
            <p>Documentos já aptos para seguir o fluxo de emissão sem bloqueio estrutural.</p>
          </article>
          <article className="stat-card">
            <span>Revisão</span>
            <strong>{fiscalInsights.summary.reviewCount}</strong>
            <p>Itens com erro operacional que pedem revisão humana antes de nova tentativa.</p>
          </article>
          <article className="stat-card">
            <span>Emitidas</span>
            <strong>{fiscalInsights.summary.issuedCount}</strong>
            <p>Documentos já concluídos e fora da fila do dia.</p>
          </article>
        </div>

        {filteredFiscalItems.length > 0 ? (
          <div className="cards-grid quote-grid">
            {filteredFiscalItems.slice(0, 4).map((item) => (
              <article key={item.documentId} className="dashboard-card">
                <span className="dashboard-kicker">{item.priorityLabel}</span>
                <h3>{item.customer}</h3>
                <strong className="quote-amount">{item.amount}</strong>
                <p>{item.serviceDescription}</p>
                <small className="muted-text">{item.helper}</small>
                {item.issuedAt ? <small className="muted-text">Emitida em {item.issuedAt}</small> : null}
                {item.missingFields.length > 0 ? (
                  <small className="muted-text">Pendências: {item.missingFields.join(", ")}</small>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Sem documentos na fila</strong>
            <span>Quando a operação gerar rascunhos, esta leitura passa a separar prontas, bloqueadas e itens em revisão.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Modelos de emissão</span>
            <h2>O cliente pode emitir com ou sem certificado</h2>
          </div>
        </div>

        <div className="cards-grid quote-grid">
          <article className="dashboard-card">
            <span className="dashboard-kicker">Emissão assistida</span>
            <h3>Portal oficial da NFS-e</h3>
            <p>{emissionModes.assisted.helper}</p>
            <div className="dashboard-actions">
              <Link href={portalUrls.loginUrl} className="secondary-link" target="_blank" rel="noreferrer">
                Abrir login oficial
              </Link>
              <Link href={portalUrls.issueUrl} className="ghost-button" target="_blank" rel="noreferrer">
                Abrir emissor web
              </Link>
            </div>
          </article>

          <article className="dashboard-card">
            <span className="dashboard-kicker">Emissão automática</span>
            <h3>API oficial com certificado</h3>
            <p>{emissionModes.automatic.helper}</p>
            <small className="muted-text">
              {integrationStatus.hasCertificate
                ? `Certificado detectado via ${integrationStatus.certificateSource === "path" ? "caminho local" : "base64"}.`
                : "Nenhum certificado configurado ainda."}
            </small>
            <small className="muted-text">
              Município IBGE: {setup.municipalCode || "aguardando cidade/UF"}.
              {` Serviço padrão: ${setup.defaultFiscalServiceCode || "definir na empresa ou na emissão"}.`}
            </small>
          </article>
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Integração oficial</span>
            <h2>Ambiente da NFS-e Nacional no projeto</h2>
          </div>
        </div>

        {params?.integrationMessage ? (
          <div className={params.integrationOk === "1" ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>{params.integrationOk === "1" ? "Teste concluído" : "Teste com falha"}</strong>
            <span>{params.integrationMessage}</span>
          </div>
        ) : null}
        {params?.certificateMessage ? (
          <div className={params.certificateOk === "1" ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>{params.certificateOk === "1" ? "Certificado verificado" : "Certificado com falha"}</strong>
            <span>{params.certificateMessage}</span>
          </div>
        ) : null}

        <div className={integrationStatus.ready ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{integrationStatus.ready ? "Ambiente configurado" : "Ambiente ainda incompleto"}</strong>
          <span>{integrationStatus.helper}</span>
          <small className="muted-text">
            Ambiente: {integrationStatus.environment === "production" ? "produção" : "produção restrita"}.
            {setup.municipalCode ? ` Município configurado: ${setup.municipalCode}.` : " Município ainda não configurado."}
          </small>
          {integrationStatus.certificateSource ? (
            <small className="muted-text">
              Certificado carregado via {integrationStatus.certificateSource === "path" ? "arquivo local" : "base64"}.
            </small>
          ) : null}
          <small className="muted-text">
            {integrationStatus.ready
              ? "A emissão agora usa DPS assinada e envio direto ao endpoint oficial /nfse."
              : "Além do certificado, defina código de serviço e série para montar a DPS oficial."}
          </small>
          {!integrationStatus.ready ? (
            <small className="muted-text">Pendências: {integrationStatus.missing.join(", ")}</small>
          ) : null}
        </div>

        {municipalityStatus ? (
          <div className={municipalityStatus.aderenteEmissorNacional ? "auth-hint" : "auth-hint fiscal-warning"}>
            <strong>
              {municipalityStatus.aderenteEmissorNacional
                ? "Município habilitado para emissor/API nacional"
                : "Seu município de estabelecimento ainda não possui convênio ativo para emissão pública no Emissor Nacional"}
            </strong>
            <span>
              {municipalityStatus.city}/{municipalityStatus.state}: convênio {municipalityStatus.statusConvenio.toLowerCase()}.
              {` Ambiente nacional: ${municipalityStatus.aderenteAmbienteNacional ? "sim" : "não"}.`}
              {` Emissor nacional: ${municipalityStatus.aderenteEmissorNacional ? "sim" : "não"}.`}
            </span>
            <small className="muted-text">
              Base oficial consultada em tempo de execução.
              {municipalityStatus.publication ? ` Publicação: ${municipalityStatus.publication}.` : ""}
              {municipalityStatus.startDate ? ` Vigência: ${municipalityStatus.startDate}.` : ""}
            </small>
            <small className="muted-text">
              Fonte oficial:{" "}
              <Link href={municipalityStatus.sourceUrl} target="_blank" rel="noreferrer">
                planilha pública de municípios aderentes
              </Link>
            </small>
          </div>
        ) : setup.city && setup.state ? (
          <div className="auth-hint fiscal-warning">
            <strong>Município sem correspondência na base pública</strong>
            <span>Não encontrei {setup.city}/{setup.state} na planilha oficial atual de municípios aderentes.</span>
          </div>
        ) : null}

        <div className="dashboard-actions">
          <form action={inspectNfseNationalCertificateAction} className="card-action">
            <button type="submit" className="ghost-button">
              Validar certificado
            </button>
          </form>
          <form action={testNfseNationalConnectivityAction} className="card-action">
            <button type="submit" className="secondary-link">
              Testar conectividade oficial
            </button>
          </form>
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Prontidão fiscal</span>
            <h2>A empresa já tem base suficiente para emissão no fluxo?</h2>
          </div>
        </div>

        <div className={readiness.ready ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{readiness.ready ? "Base fiscal pronta" : "Setup fiscal incompleto"}</strong>
          <span>{readiness.helper}</span>
          {!readiness.ready ? (
            <Link href="/dashboard/setup" className="secondary-link">
              Ajustar setup da empresa
            </Link>
          ) : null}
        </div>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Emissão rápida</span>
            <h2>Emitir com nome, CPF/CNPJ e valor para cliente já cadastrado</h2>
          </div>
        </div>

        <form action={createQuickNfseDraftAction} className="inline-form">
          <label>
            <span>Nome ou CPF/CNPJ</span>
            <input name="lookup" type="text" placeholder="Ex.: Casa Nobre ou 084.512.990-40" required />
          </label>
          <label>
            <span>Valor</span>
            <input name="amount" type="text" placeholder="Ex.: R$ 350" required />
          </label>
          <label className="form-span-2">
            <span>Descrição do serviço</span>
            <input
              name="serviceDescription"
              type="text"
              placeholder="Ex.: Manutenção mensal recorrente"
              required
            />
          </label>
          <button type="submit" className="primary-link form-submit">
            Criar rascunho rápido
          </button>
        </form>
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Fila fiscal</span>
            <h2>Recebimentos já prontos para virar rascunho de NFS-e</h2>
          </div>
        </div>

        {readyQueue.length > 0 ? (
          <div className="cards-grid quote-grid">
            {readyQueue.map((item) => (
              <article key={item.chargeId} className="dashboard-card">
                <span className="dashboard-kicker">Pagamento confirmado</span>
                <h3>{item.customer}</h3>
                <strong className="quote-amount">{item.amount}</strong>
                <p>{item.helper}</p>
                <form action={createNfseDraftAction} className="card-action">
                  <input type="hidden" name="chargeId" value={item.chargeId} />
                  <button type="submit" className="primary-link">
                    Criar rascunho fiscal
                  </button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Fila fiscal limpa</strong>
            <span>Nenhum recebimento novo está aguardando rascunho fiscal neste momento.</span>
          </div>
        )}
      </section>

      <section className="data-panel">
        <div className="card-header">
          <div>
            <span className="section-label">Documentos fiscais</span>
            <h2>Rascunhos, prontas, emitidas e itens com revisão</h2>
          </div>
        </div>

        {documents.length > 0 ? (
          <div className="cards-grid quote-grid">
            {documents.map((document) => (
              <article key={document.id} className="dashboard-card">
                <span className="dashboard-kicker">{document.status}</span>
                <h3>{document.customer}</h3>
                <strong className="quote-amount">{document.serviceAmount}</strong>
                <p>{document.serviceDescription}</p>
                <small className="muted-text">Pedido base: {document.orderId}</small>
                {document.issuedAt ? <small className="muted-text">Emitida em: {document.issuedAt}</small> : null}
                {document.verificationCode ? <small className="muted-text">Código: {document.verificationCode}</small> : null}
                {document.externalId ? <small className="muted-text">Número externo: {document.externalId}</small> : null}
                {document.errorMessage ? <small className="muted-text">Erro: {document.errorMessage}</small> : null}
                {issuePreviewMap.get(document.id)?.dpsId ? (
                  <small className="muted-text">DPS: {issuePreviewMap.get(document.id)?.dpsId}</small>
                ) : null}
                {issuePreviewMap.get(document.id)?.digest ? (
                  <small className="muted-text">Hash: {issuePreviewMap.get(document.id)?.digest?.slice(0, 16)}</small>
                ) : null}
                <small className="muted-text">
                  Código de serviço sugerido: {document.serviceCode || setup.defaultFiscalServiceCode || "informar antes da emissão"}.
                </small>
                <div className="dashboard-actions">
                  <Link href={portalUrls.issueUrl} className="ghost-button" target="_blank" rel="noreferrer">
                    Emitir via portal oficial
                  </Link>
                  {document.status !== "Pronta" && document.status !== "Emitida" ? (
                    <form action={markNfseReadyAction} className="card-action">
                      <input type="hidden" name="id" value={document.id} />
                      <button type="submit" className="secondary-link">
                        Marcar pronta
                      </button>
                    </form>
                  ) : null}
                  {document.status !== "Emitida" && !integrationStatus.ready && readiness.ready ? (
                    <form action={markNfseIssuedAction} className="card-action">
                      <input type="hidden" name="id" value={document.id} />
                      <button type="submit" className="primary-link">
                        Marcar emitida manualmente
                      </button>
                    </form>
                  ) : null}
                </div>
                {!readiness.ready ? (
                  <div className="auth-hint fiscal-warning">
                    <strong>Emissão bloqueada</strong>
                    <span>Complete o setup fiscal da empresa antes de marcar a NFS-e como emitida.</span>
                  </div>
                ) : null}
                {issuePreviewMap.get(document.id) && !issuePreviewMap.get(document.id)?.ready ? (
                  <div className="auth-hint fiscal-warning">
                    <strong>DPS ainda incompleta</strong>
                    <span>{issuePreviewMap.get(document.id)?.helper}</span>
                  </div>
                ) : null}
                {document.status !== "Emitida" && integrationStatus.ready && municipalityStatus?.aderenteEmissorNacional ? (
                  <form action={issueNfseNationalAction} className="follow-up-form">
                    <input type="hidden" name="id" value={document.id} />
                    <label className="form-span-2">
                      <span>Código do serviço para esta emissão</span>
                      <input
                        name="serviceCode"
                        type="text"
                        defaultValue={document.serviceCode || setup.defaultFiscalServiceCode || ""}
                        placeholder="Ex.: 17.02"
                        required
                      />
                    </label>
                    <button type="submit" className="primary-link">
                      Emitir na NFS-e Nacional
                    </button>
                  </form>
                ) : null}
                {document.status !== "Emitida" && integrationStatus.ready && municipalityStatus && !municipalityStatus.aderenteEmissorNacional ? (
                  <div className="auth-hint fiscal-warning">
                    <strong>Emissão automática indisponível</strong>
                    <span>Seu município de estabelecimento ainda não possui convênio ativo para emissão pública no Emissor Nacional.</span>
                  </div>
                ) : null}
                {document.status !== "Erro" ? (
                  <form action={markNfseErrorAction} className="follow-up-form">
                    <input type="hidden" name="id" value={document.id} />
                    <label className="form-span-2">
                      <span>Motivo do bloqueio fiscal</span>
                      <input name="errorMessage" type="text" placeholder="Ex.: revisar descrição de serviço ou alíquota." />
                    </label>
                    <button type="submit" className="ghost-button">
                      Marcar erro
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="auth-hint">
            <strong>Sem documentos ainda</strong>
            <span>Crie o primeiro rascunho fiscal a partir de um recebimento confirmado.</span>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
