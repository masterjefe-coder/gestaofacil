"use client";

import { useState } from "react";

type InviteLinkFieldProps = {
  inviteUrl: string;
};

export function InviteLinkField({ inviteUrl }: InviteLinkFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="invite-link-field">
      <input type="text" value={inviteUrl} readOnly />
      <button type="button" className="ghost-button" onClick={handleCopy}>
        {copied ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}
