import { ProviderRegistry } from "../_shared/providers/registry.ts";
import { ProviderWaterfall } from "../_shared/providers/waterfall.ts";
import { MockDiscoveryProvider } from "../_shared/providers/providers/mock.ts";

const registry = new ProviderRegistry();
registry.register(new MockDiscoveryProvider());

const waterfall = new ProviderWaterfall(registry);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await request.json();

    if (!body.query || typeof body.query !== "string") {
      return new Response(
        JSON.stringify({ error: "query is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const input = {
      query: body.query,
      location: body.location,
      industry: body.industry,
      minEmployees: body.minEmployees,
      maxEmployees: body.maxEmployees,
      limit: Math.min(Math.max(body.limit ?? 10, 1), 100),
    };

    const result = await waterfall.discover(
      input,
      {
        minResults: input.limit,
        maxProviders: 3,
        maxCost: 1,
        minConfidence: 0.5,
      },
      crypto.randomUUID()
    );

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
