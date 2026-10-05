import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ProviderRegistry } from "../../supabase/functions/_shared/providers/registry.ts";
import { ProviderWaterfall } from "../../supabase/functions/_shared/providers/waterfall.ts";
import { MockDiscoveryProvider } from "../../supabase/functions/_shared/providers/providers/mock.ts";

Deno.test("waterfall discovers companies through registered provider", async () => {
  const registry = new ProviderRegistry();
  registry.register(new MockDiscoveryProvider());

  const waterfall = new ProviderWaterfall(registry);

  const result = await waterfall.discover(
    {
      query: "technology companies",
      location: "India",
      limit: 2,
    },
    {
      minResults: 2,
    },
    "test-request"
  );

  assertEquals(result.candidates.length, 2);
  assertEquals(result.providersUsed, ["mock"]);
  assertEquals(result.totalCost, 0);
});

Deno.test("waterfall keeps the highest-confidence duplicate", async () => {
  const registry = new ProviderRegistry();

  registry.register({
    id: "provider-a",
    name: "Provider A",
    priority: 1,
    capabilities: new Set(["company_discovery"]),
    async discover() {
      return {
        providerId: "provider-a",
        latencyMs: 10,
        estimatedCost: 0.01,
        candidates: [
          {
            name: "Acme Technologies",
            domain: "acme.com",
            source: {
              providerId: "provider-a",
            },
            confidence: 0.70,
          },
        ],
      };
    },
  });

  registry.register({
    id: "provider-b",
    name: "Provider B",
    priority: 2,
    capabilities: new Set(["company_discovery"]),
    async discover() {
      return {
        providerId: "provider-b",
        latencyMs: 20,
        estimatedCost: 0.02,
        candidates: [
          {
            name: "Acme Technologies",
            domain: "www.acme.com",
            source: {
              providerId: "provider-b",
            },
            confidence: 0.95,
          },
        ],
      };
    },
  });

  const waterfall = new ProviderWaterfall(registry);

  const result = await waterfall.discover(
    {
      query: "technology companies",
      limit: 10,
    },
    {
      minResults: 2,
    },
    "duplicate-test"
  );

  assertEquals(result.candidates.length, 1);
  assertEquals(result.candidates[0].confidence, 0.95);
});
