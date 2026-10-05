import { ProviderRegistry } from "../_shared/providers/registry.ts";
import { ProviderWaterfall } from "../_shared/providers/waterfall.ts";
import { SerperDiscoveryProvider } from "../_shared/providers/providers/serper.ts";

const registry = new ProviderRegistry();

// Production discovery provider.
registry.register(new SerperDiscoveryProvider());

const waterfall = new ProviderWaterfall(registry);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed" },
      405
    );
  }

  try {
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return jsonResponse(
        {
          error:
            "Request body must be a JSON object",
        },
        400
      );
    }

    if (
      typeof body.query !== "string" ||
      body.query.trim().length === 0
    ) {
      return jsonResponse(
        { error: "query is required" },
        400
      );
    }

    const requestedLimit =
      typeof body.limit === "number"
        ? body.limit
        : 10;

    const input = {
      query: body.query.trim(),

      location:
        typeof body.location === "string"
          ? body.location.trim()
          : undefined,

      industry:
        typeof body.industry === "string"
          ? body.industry.trim()
          : undefined,

      minEmployees:
        typeof body.minEmployees === "number"
          ? body.minEmployees
          : undefined,

      maxEmployees:
        typeof body.maxEmployees === "number"
          ? body.maxEmployees
          : undefined,

      limit: Math.min(
        Math.max(requestedLimit, 1),
        100
      ),
    };

    if (
      input.minEmployees !== undefined &&
      input.minEmployees < 0
    ) {
      return jsonResponse(
        {
          error:
            "minEmployees must be greater than or equal to 0",
        },
        400
      );
    }

    if (
      input.maxEmployees !== undefined &&
      input.maxEmployees < 0
    ) {
      return jsonResponse(
        {
          error:
            "maxEmployees must be greater than or equal to 0",
        },
        400
      );
    }

    if (
      input.minEmployees !== undefined &&
      input.maxEmployees !== undefined &&
      input.minEmployees > input.maxEmployees
    ) {
      return jsonResponse(
        {
          error:
            "minEmployees cannot be greater than maxEmployees",
        },
        400
      );
    }

    const result = await waterfall.discover(
      input,
      {
        minResults: input.limit,
        maxProviders: 1,
        maxCost: 1,
        minConfidence: 0.5,
      },
      crypto.randomUUID()
    );

    return jsonResponse(result);
  } catch (error) {
    console.error(
      "prospect-discover error:",
      error
    );

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      500
    );
  }
});