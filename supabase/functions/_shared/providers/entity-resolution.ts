import type { CompanyCandidate } from "./types.ts";
import {
  companyEntityKey,
  normalizeCandidate,
  normalizeCompanyName,
  normalizeDomain,
} from "../normalization/company.ts";

export interface ResolvedCompanyCandidate
  extends CompanyCandidate {
  source: CompanyCandidate["source"] & {
    sources?: CompanyCandidate["source"][];
  };
}

function mergeText(
  primary?: string,
  secondary?: string
): string | undefined {
  if (primary && primary.trim()) {
    return primary.trim();
  }

  if (secondary && secondary.trim()) {
    return secondary.trim();
  }

  return undefined;
}

function mergeLocation(
  primary?: CompanyCandidate["location"],
  secondary?: CompanyCandidate["location"]
): CompanyCandidate["location"] {
  if (!primary && !secondary) {
    return undefined;
  }

  return {
    city: mergeText(
      primary?.city,
      secondary?.city
    ),
    state: mergeText(
      primary?.state,
      secondary?.state
    ),
    country: mergeText(
      primary?.country,
      secondary?.country
    ),
  };
}

function mergeCandidate(
  existing: ResolvedCompanyCandidate,
  incoming: CompanyCandidate
): ResolvedCompanyCandidate {
  const primary =
    incoming.confidence >=
    existing.confidence
      ? incoming
      : existing;

  const secondary =
    primary === incoming
      ? existing
      : incoming;

  const sourceList = [
    existing.source,
    incoming.source,
    ...(existing.source.sources ?? []),
    ...(incoming.source.sources ?? []),
  ];

  const uniqueSources = new Map<
    string,
    CompanyCandidate["source"]
  >();

  for (const source of sourceList) {
    const key = JSON.stringify({
      providerId: source.providerId,
      sourceUrl: source.sourceUrl,
      externalId: source.externalId,
    });

    uniqueSources.set(key, source);
  }

  return {
    ...primary,

    name:
      primary.name.length >=
      secondary.name.length
        ? primary.name
        : secondary.name,

    domain:
      normalizeDomain(
        primary.domain ??
          secondary.domain
      ),

    websiteUrl:
      mergeText(
        primary.websiteUrl,
        secondary.websiteUrl
      ),

    industry:
      mergeText(
        primary.industry,
        secondary.industry
      ),

    description:
      mergeText(
        primary.description,
        secondary.description
      ),

    employeeCount:
      primary.employeeCount ??
      secondary.employeeCount,

    location:
      mergeLocation(
        primary.location,
        secondary.location
      ),

    confidence: Math.max(
      primary.confidence,
      secondary.confidence
    ),

    source: {
      ...primary.source,
      sources: [
        ...uniqueSources.values(),
      ],
    },
  };
}

export function resolveCompanyCandidates(
  candidates: CompanyCandidate[]
): ResolvedCompanyCandidate[] {
  const resolved = new Map<
    string,
    ResolvedCompanyCandidate
  >();

  for (const rawCandidate of candidates) {
    const candidate =
      normalizeCandidate(
        rawCandidate
      );

    const key =
      companyEntityKey(candidate);

    const existing =
      resolved.get(key);

    if (!existing) {
      resolved.set(key, {
        ...candidate,
        name: candidate.name.trim(),
      });

      continue;
    }

    resolved.set(
      key,
      mergeCandidate(
        existing,
        candidate
      )
    );
  }

  return [
    ...resolved.values(),
  ].sort(
    (a, b) =>
      b.confidence -
      a.confidence
  );
}

export function isSameCompany(
  a: CompanyCandidate,
  b: CompanyCandidate
): boolean {
  const domainA =
    normalizeDomain(a.domain);

  const domainB =
    normalizeDomain(b.domain);

  if (
    domainA &&
    domainB
  ) {
    return domainA === domainB;
  }

  return (
    normalizeCompanyName(a.name) ===
    normalizeCompanyName(b.name)
  );
}