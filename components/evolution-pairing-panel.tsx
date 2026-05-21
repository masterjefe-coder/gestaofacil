"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type EvolutionPairingPanelProps = {
  instanceName: string;
};

type PairingPayload = {
  ok: boolean;
  instanceName?: string;
  message?: string;
  pairingCode?: string | null;
  qrCode?: string | null;
  rawCode?: string | null;
  error?: string;
};

type ConnectionStatusPayload = {
  ok: boolean;
  state?: string;
  connected?: boolean;
  error?: string;
};

function getStatusLabel(state: string | null) {
  if (state === "open") {
    return "conectado";
  }

  if (state === "connecting") {
    return "aguardando leitura";
  }

  if (state === "close") {
    return "desconectado";
  }

  return state || "aguardando";
}

export function EvolutionPairingPanel({ instanceName }: EvolutionPairingPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payload, setPayload] = useState<PairingPayload | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  useEffect(() => {
    if (!payload?.ok) {
      return;
    }

    let cancelled = false;
    let attempts = 0;

    async function checkConnection() {
      if (cancelled) {
        return;
      }

      setIsCheckingConnection(true);

      try {
        const response = await fetch(`/api/evolution/status?instance=${encodeURIComponent(instanceName)}`, {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as ConnectionStatusPayload | null;

        if (cancelled || !body?.ok) {
          return;
        }

        setConnectionState(body.state || null);

        if (body.connected) {
          setPayload((current) => current ? ({
            ...current,
            message: "WhatsApp conectado com sucesso. A tela já atualizou o status da empresa.",
          }) : current);
          router.refresh();
          return;
        }

        attempts += 1;
        if (attempts < 18) {
          window.setTimeout(checkConnection, 3000);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingConnection(false);
        }
      }
    }

    void checkConnection();

    return () => {
      cancelled = true;
    };
  }, [instanceName, payload?.ok, router]);

  function requestPairing() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/evolution/pairing?instance=${encodeURIComponent(instanceName)}`, {
          method: "GET",
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as PairingPayload | null;

        if (!response.ok || !body?.ok) {
          setPayload({
            ok: false,
            error: body?.error || "Não foi possível preparar a conexão agora.",
          });
          return;
        }

        setPayload(body);
      } catch (error) {
        setPayload({
          ok: false,
          error: error instanceof Error ? error.message : "Não foi possível preparar a conexão agora.",
        });
      }
    });
  }

  if (!instanceName) {
    return null;
  }

  return (
    <div className="cards-grid">
      <button type="button" className="secondary-link" onClick={requestPairing} disabled={isPending}>
        {isPending ? "Preparando QR..." : "Mostrar QR para conectar"}
      </button>

      {payload ? (
        <div className={payload.ok ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{payload.ok ? "Conexão pronta" : "Não foi possível conectar agora"}</strong>
          <span>{payload.ok ? payload.message : payload.error}</span>
          {payload.ok ? (
            <small className="muted-text">
              Status atual: {getStatusLabel(connectionState)}{isCheckingConnection ? " · conferindo atualização..." : ""}
            </small>
          ) : null}
          {payload.pairingCode ? (
            <small className="muted-text">Código para conectar pelo celular: {payload.pairingCode}</small>
          ) : null}
          {payload.rawCode && !payload.qrCode ? (
            <small className="muted-text">O sistema recebeu o código da conexão, mas não conseguiu montar a imagem do QR nesta tentativa.</small>
          ) : null}
        </div>
      ) : null}

      {payload?.ok && payload.qrCode ? (
        <div className="auth-hint">
          <strong>QR para conectar o WhatsApp</strong>
          <span>Escaneie este QR com o aparelho que vai atender os clientes.</span>
          <Image
            src={payload.qrCode}
            alt="QR para conectar o WhatsApp"
            width={280}
            height={280}
            unoptimized
            style={{ width: "100%", maxWidth: 280, height: "auto" }}
          />
        </div>
      ) : null}
    </div>
  );
}
