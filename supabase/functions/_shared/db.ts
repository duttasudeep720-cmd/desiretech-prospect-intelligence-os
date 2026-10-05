import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2";

let adminClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY"
    );

  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL is not configured"
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured"
    );
  }

  adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return adminClient;
}

export async function getOrCreateCompany(
  input: {
    name: string;
    domain?: string;
    websiteUrl?: string;
    description?: string;
    industry?: string;
    employeeCount?: number;
    location?: Record<string, unknown>;
    dataConfidence?: number;
  }
) {
  const supabase =
    getAdminClient();

  const normalizedDomain =
    input.domain
      ?.trim()
      .toLowerCase()
      .replace(/^www\./, "");

  if (normalizedDomain) {
    const { data: existing, error } =
      await supabase
        .from("companies")
        .select("*")
        .eq("domain", normalizedDomain)
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (existing) {
      return existing;
    }
  }

  const normalizedName =
    input.name
      .trim()
      .toLowerCase()
      .replace(
        /[.,/#!$%^&*;:{}=_`~()]/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();

  const { data: existingByName, error:
    nameLookupError } =
    await supabase
      .from("companies")
      .select("*")
      .eq(
        "normalized_name",
        normalizedName
      )
      .maybeSingle();

  if (nameLookupError) {
    throw nameLookupError;
  }

  if (existingByName) {
    return existingByName;
  }

  const { data, error } =
    await supabase
      .from("companies")
      .insert({
        name: input.name.trim(),
        normalized_name:
          normalizedName,
        domain:
          normalizedDomain,
        website_url:
          input.websiteUrl,
        description:
          input.description,
        industry:
          input.industry,
        employee_count:
          input.employeeCount,
        location:
          input.location ?? {},
        data_confidence:
          input.dataConfidence ?? 0,
      })
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createCompanySource(
  input: {
    companyId: string;
    providerId: string;
    externalId?: string;
    sourceUrl?: string;
    sourceType?: string;
    confidence?: number;
    rawData?: Record<string, unknown>;
  }
) {
  const supabase =
    getAdminClient();

  const { data, error } =
    await supabase
      .from("company_sources")
      .insert({
        company_id:
          input.companyId,
        provider_id:
          input.providerId,
        external_id:
          input.externalId,
        source_url:
          input.sourceUrl,
        source_type:
          input.sourceType,
        confidence:
          input.confidence,
        raw_data:
          input.rawData ?? {},
      })
      .select("*")
      .single();

  if (error) {
    throw error;
  }

  return data;
}