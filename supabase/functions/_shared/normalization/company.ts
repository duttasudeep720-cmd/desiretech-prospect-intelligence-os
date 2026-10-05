import type { CompanyCandidate } from "../providers/types.ts";

export function normalizeDomain(domain?: string): string | undefined {
  if (!domain) {
    return undefined;
  }

  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0];
}

export function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=_`~()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCandidate(
  candidate: CompanyCandidate
): CompanyCandidate {
  return {
    ...candidate,
    name: candidate.name.trim(),
    domain: normalizeDomain(candidate.domain),
    websiteUrl: candidate.websiteUrl?.trim(),
    industry: candidate.industry?.trim(),
    description: candidate.description?.trim(),
    location: candidate.location
      ? {
          city: candidate.location.city?.trim(),
          state: candidate.location.state?.trim(),
          country: candidate.location.country?.trim(),
        }
      : undefined,
    confidence: Math.min(Math.max(candidate.confidence, 0), 1),
  };
}

export function companyEntityKey(candidate: CompanyCandidate): string {
  const normalized = normalizeCandidate(candidate);

  return (
    normalized.domain ??
    normalizeCompanyName(normalized.name)
  );
}
