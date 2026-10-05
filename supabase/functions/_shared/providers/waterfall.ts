import type {
  CompanyCandidate,
  DiscoveryInput,
  ProviderContext,
  ProviderResult,
} from "./types.ts";
import { ProviderRegistry } from "./registry.ts";
import { resolveCompanyCandidates } from "./entity-resolution.ts";

export interface WaterfallPolicy {
  minResults: number;
  maxProviders?: number;
  maxCost?: number;
  minConfidence?: number;
}

export interface ProviderErrorResult {
  providerId: string;
  message: string;
  retryable: boolean;
}

export interface WaterfallResult {
  candidates: CompanyCandidate[];
  providersUsed: string[];
  providerErrors: ProviderErrorResult[];
  totalCost: number;
  totalLatencyMs: number;
  providerResults: ProviderResult[];
}

export class ProviderWaterfall {
  constructor(
    private readonly registry: ProviderRegistry
  ) {}

  async discover(
    input: DiscoveryInput,
    policy: WaterfallPolicy,
    requestId: string
  ): Promise<WaterfallResult> {
    const collectedCandidates: CompanyCandidate[] = [];

    const providersUsed: string[] = [];
    const providerErrors: ProviderErrorResult[] = [];
    const providerResults: ProviderResult[] = [];

    let totalCost = 0;
    let totalLatencyMs = 0;

    const providers =
      this.registry.list();

    for (const provider of providers) {
      if (
        policy.maxProviders !== undefined &&
        providersUsed.length >=
          policy.maxProviders
      ) {
        break;
      }

      if (
        policy.maxCost !== undefined &&
        totalCost >=
          policy.maxCost
      ) {
        break;
      }

      const remainingBudget =
        policy.maxCost !== undefined
          ? Math.max(
              policy.maxCost -
                totalCost,
              0
            )
          : Number.POSITIVE_INFINITY;

      if (
        remainingBudget <= 0
      ) {
        break;
      }

      const context: ProviderContext = {
        requestId,
        remainingBudget,
      };

      try {
        const result =
          await provider.discover(
            input,
            context
          );

        providersUsed.push(
          provider.id
        );

        providerResults.push(
          result
        );

        totalCost +=
          result.estimatedCost;

        totalLatencyMs +=
          result.latencyMs;

        for (
          const candidate of
            result.candidates
        ) {
          if (
            policy.minConfidence !==
              undefined &&
            candidate.confidence <
              policy.minConfidence
          ) {
            continue;
          }

          collectedCandidates.push(
            candidate
          );
        }

        const resolved =
          resolveCompanyCandidates(
            collectedCandidates
          );

        if (
          resolved.length >=
          policy.minResults
        ) {
          break;
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown provider error";

        providerErrors.push({
          providerId:
            provider.id,
          message,
          retryable: true,
        });
      }
    }

    const resolvedCandidates =
      resolveCompanyCandidates(
        collectedCandidates
      );

    return {
      candidates:
        resolvedCandidates.slice(
          0,
          input.limit
        ),

      providersUsed,

      providerErrors,

      totalCost,

      totalLatencyMs,

      providerResults,
    };
  }
}