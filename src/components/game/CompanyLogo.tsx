"use client";

import { useState } from "react";
import type { Company } from "@/types/company";

const LOGO_DEV_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;

/** Tried in order: local file from the pipeline, logo.dev, Google's favicon service. */
function logoSources(company: Pick<Company, "id" | "logo" | "domain">): string[] {
  const sources = [company.logo, `/logos/${company.id}.png`];
  if (company.domain && LOGO_DEV_TOKEN) {
    sources.push(`https://img.logo.dev/${company.domain}?token=${LOGO_DEV_TOKEN}&size=256&format=png`);
  }
  if (company.domain) {
    sources.push(`https://www.google.com/s2/favicons?domain=${company.domain}&sz=256`);
  }
  return [...new Set(sources.filter((s): s is string => Boolean(s)))];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type Props = {
  company: Pick<Company, "id" | "name" | "logo" | "domain" | "brandColor">;
  className?: string;
};

/** Company logo on a white tile, falling through sources until one loads, then initials. */
export function CompanyLogo({ company, className = "h-16 w-16" }: Props) {
  const sources = logoSources(company);
  const [attempt, setAttempt] = useState(0);
  const src = sources[attempt];

  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-xl ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- mixed local/remote logos of unknown size
        <img
          key={src}
          src={src}
          alt={`${company.name} logo`}
          className="max-h-full max-w-full object-contain"
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <span className="text-xl font-black" style={{ color: company.brandColor }}>
          {initials(company.name)}
        </span>
      )}
    </div>
  );
}
