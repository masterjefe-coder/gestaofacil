"use client";

import { useEffect } from "react";

type ReportPrintButtonProps = {
  autoPrint?: boolean;
};

export function ReportPrintButton({ autoPrint = false }: ReportPrintButtonProps) {
  useEffect(() => {
    if (autoPrint) {
      window.print();
    }
  }, [autoPrint]);

  return (
    <button type="button" className="primary-link" onClick={() => window.print()}>
      Imprimir / salvar em PDF
    </button>
  );
}
