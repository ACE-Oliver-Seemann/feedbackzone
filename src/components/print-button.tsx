"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/texts.sk";

/** Opens the browser's print dialog, from which the report can be saved as PDF (IT-08). */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      {t.report.print}
    </Button>
  );
}
