import type {
  CompanyCandidate,
  DiscoveryInput,
  ProviderContext,
  ProviderResult,
} from "./types.ts";
import { ProviderRegistry } from "./registry.ts";

export interface WaterfallPolicy {
  minResults: number;
  maxProviders?: number;
  maxCost?: number;
  minConfidence?: number;
}

export interface WaterfallResult {
  candidates: CompanyCandidate[];
  providersUsed: string[];
  totalCost: number;
  totalLatencyMs: number;
  providerResults: ProviderResult[];
}

export class ProviderWaterfall {
  constructor(private readonly registry: ProviderRegistry) {}

  async discover(
    input: DiscoveryInput,
    policy: WaterfallPolicy,
    requestId: string
  ): Promise<WaterfallResult> {
    const candidates = new Map<string, CompanyCandidate>();
    const providersUsed: string[] = [];
    const providerResults: ProviderResult[] = [];

    let totalCost = 0;
    let totalLatencyMs = 0;

    const providers = this.registry.list();

    for (const provider of providers) {
      if (
        policy.maxProviders !== undefined &&
        providersUsed.length >= policy.maxProviders
      ) {
        break;
      }

      if (
        policy.maxCost !== undefined &&
        totalCost >= policy.maxCost
      ) {
        break;
      }

      const context: ProviderContext = {
        requestId,
        remainingBudget:
          policy.maxCost !== undefined
            ? Math.max(policy.maxCost - totalCost, 0)
            : Number.POSITIVE_INFINITY,
      };

      try {
        const result = await provider.discover(input, context);

        providersUsed.push(provider.id);
        providerResults.push(result);

        totalCost += result.estimatedCost;
        totalLatencyMs += result.latencyMs;

        for (const candidate of result.candidates) {
          if (
            policy.minConfidence !== undefined &&
            candidate.confidence < policy.minConfidence
          ) {
            continue;
          }

          const key = this.entityKey(candidate);
          const existing = candidates.get(key);

          if (!existing || candidate.confidence > existing.confidence) {
            candidates.set(key, candidate);
          }
        }

        if (candidates.size >= policy.minResults) {
          break;
        }
      } catch {
        providersUsed.push(provider.id);
      }
    }

    return {
      candidates: [...candidates.values()].slice(0, input.limit),
      providersUsed,
      totalCost,
      totalLatencyMs,
      providerResults,
    };
  }

  private entityKey(candidate: CompanyCandidate): string {
    if (candidate.domain) {
      return candidate.domain
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0];
    }

    return candidate.name.trim().toLowerCase();
  }
}
