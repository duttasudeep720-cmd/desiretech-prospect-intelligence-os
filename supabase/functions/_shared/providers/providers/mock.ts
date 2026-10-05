import type {
  DiscoveryInput,
  DiscoveryProvider,
  ProviderContext,
  ProviderResult,
} from "../types.ts";

export class MockDiscoveryProvider implements DiscoveryProvider {
  id = "mock";
  name = "Mock Discovery Provider";
  priority = 1;

  capabilities = new Set([
    "company_discovery",
  ] as const);

  async discover(
    input: DiscoveryInput,
    _context: ProviderContext
  ): Promise<ProviderResult> {
    const startedAt = Date.now();

    const candidates = [
      {
        name: "Acme Technologies",
        domain: "acmetech.example",
        websiteUrl: "https://acmetech.example",
        industry: input.industry ?? "Technology",
        location: {
          country: input.location ?? "India",
        },
        employeeCount: 120,
        description: "Example technology company.",
        source: {
          providerId: this.id,
          sourceUrl: "https://acmetech.example",
          externalId: "mock-acme",
        },
        confidence: 0.92,
      },
      {
        name: "Global Solutions",
        domain: "globalsolutions.example",
        websiteUrl: "https://globalsolutions.example",
        industry: input.industry ?? "Technology",
        location: {
          country: input.location ?? "India",
        },
        employeeCount: 75,
        description: "Example business solutions company.",
        source: {
          providerId: this.id,
          sourceUrl: "https://globalsolutions.example",
          externalId: "mock-global",
        },
        confidence: 0.81,
      },
    ];

    return {
      candidates: candidates.slice(0, input.limit),
      providerId: this.id,
      latencyMs: Date.now() - startedAt,
      estimatedCost: 0,
    };
  }
}
