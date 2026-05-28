"use client";

import { signOut } from "next-auth/react";

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className = "ghost-button sidebar-logout" }: LogoutButtonProps) {
  async function handleLogout() {
    await fetch("/api/auth/logout-track", {
      method: "POST",
    }).catch(() => null);

    await signOut({ callbackUrl: "/login" });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleLogout()}
    >
      Sair
    </button>
  );
}
