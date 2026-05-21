"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout-track", {
      method: "POST",
    }).catch(() => null);

    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button
      type="button"
      className="ghost-button sidebar-logout"
      onClick={() => void handleLogout()}
    >
      Sair
    </button>
  );
}
