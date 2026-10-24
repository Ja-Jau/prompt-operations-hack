"use client";

import { Icon } from "./Icon";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-line btn-sm print:hidden">
      <Icon name="arrowDown" /> Save as PDF
    </button>
  );
}
