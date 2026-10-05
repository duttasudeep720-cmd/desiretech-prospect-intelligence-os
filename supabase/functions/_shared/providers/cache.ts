import type { CompanyCandidate, DiscoveryInput } from "./types.ts";

interface CacheEntry {
  candidates: CompanyCandidate[];
  expiresAt: number;
}

export class DiscoveryCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly defaultTtlMs = 15 * 60 * 1000) {}

  get(input: DiscoveryInput): CompanyCandidate[] | null {
    const key = this.key(input);
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    return entry.candidates;
  }

  set(
    input: DiscoveryInput,
    candidates: CompanyCandidate[],
    ttlMs = this.defaultTtlMs
  ): void {
    this.entries.set(this.key(input), {
      candidates,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.entries.clear();
  }

  private key(input: DiscoveryInput): string {
    return JSON.stringify({
      query: input.query.trim().toLowerCase(),
      location: input.location?.trim().toLowerCase(),
      industry: input.industry?.trim().toLowerCase(),
      minEmployees: input.minEmployees,
      maxEmployees: input.maxEmployees,
      limit: input.limit,
    });
  }
}
