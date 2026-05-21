"use client";

import { useEffect, useRef } from "react";

type WorkspaceOption = {
  id: string;
  name: string;
  tradeName?: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

type WorkspaceSwitcherProps = {
  currentWorkspaceId: string;
  options: WorkspaceOption[];
  action: (formData: FormData) => void | Promise<void>;
  returnTo: string;
};

export function WorkspaceSwitcher({
  currentWorkspaceId,
  options,
  action,
  returnTo,
}: WorkspaceSwitcherProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const select = form.elements.namedItem("workspaceId");

    if (!(select instanceof HTMLSelectElement)) {
      return;
    }

    const handleChange = () => {
      form.requestSubmit();
    };

    select.addEventListener("change", handleChange);
    return () => select.removeEventListener("change", handleChange);
  }, []);

  return (
    <form ref={formRef} action={action} className="workspace-switcher">
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="workspace-switcher-label">
        <span>Empresa ativa</span>
        <select name="workspaceId" defaultValue={currentWorkspaceId}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {(option.tradeName || option.name)} · {option.role}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
