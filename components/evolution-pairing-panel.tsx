"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

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

export function EvolutionPairingPanel({ instanceName }: EvolutionPairingPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [payload, setPayload] = useState<PairingPayload | null>(null);

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
            error: body?.error || "Não foi possível gerar o pareamento da instância.",
          });
          return;
        }

        setPayload(body);
      } catch (error) {
        setPayload({
          ok: false,
          error: error instanceof Error ? error.message : "Não foi possível gerar o pareamento da instância.",
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
        {isPending ? "Gerando pareamento..." : "Gerar pareamento"}
      </button>

      {payload ? (
        <div className={payload.ok ? "auth-hint" : "auth-hint fiscal-warning"}>
          <strong>{payload.ok ? "Pareamento pronto" : "Operação com falha"}</strong>
          <span>{payload.ok ? payload.message : payload.error}</span>
          {payload.pairingCode ? (
            <small className="muted-text">Código numérico: {payload.pairingCode}</small>
          ) : null}
          {payload.rawCode && !payload.qrCode ? (
            <small className="muted-text">A API retornou o código bruto de conexão, mas não devolveu a imagem do QR nesta tentativa.</small>
          ) : null}
        </div>
      ) : null}

      {payload?.ok && payload.qrCode ? (
        <div className="auth-hint">
          <strong>QR para conectar o WhatsApp</strong>
          <span>Escaneie este QR com o aparelho que será usado na operação.</span>
          <Image
            src={payload.qrCode}
            alt="QR code para pareamento da instância Evolution"
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
