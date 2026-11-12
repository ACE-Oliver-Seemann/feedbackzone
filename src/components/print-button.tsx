"use client";

import { t } from "@/lib/texts.sk";

/** Opens the browser's print dialog, from which the report can be saved as PDF (IT-08). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-teal-700 px-4 py-3 text-sm font-medium text-white hover:bg-teal-800 print:hidden"
    >
      {t.report.print}
    </button>
  );
}
