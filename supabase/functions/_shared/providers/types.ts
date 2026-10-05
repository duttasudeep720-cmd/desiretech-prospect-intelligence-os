export type ProviderCapability =
  | "company_discovery"
  | "company_enrichment"
  | "contact_discovery"
  | "technology_detection"
  | "buying_signals";

export interface DiscoveryInput {
  query: string;
  location?: string;
  industry?: string;
  minEmployees?: number;
  maxEmployees?: number;
  limit: number;
}

export interface CompanyCandidate {
  name: string;
  domain?: string;
  websiteUrl?: string;
  industry?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  employeeCount?: number;
  description?: string;
  source: {
    providerId: string;
    sourceUrl?: string;
    externalId?: string;
  };
  confidence: number;
}

export interface ProviderResult {
  candidates: CompanyCandidate[];
  providerId: string;
  latencyMs: number;
  estimatedCost: number;
}

export interface ProviderContext {
  requestId: string;
  remainingBudget: number;
}

export interface DiscoveryProvider {
  id: string;
  name: string;
  priority: number;
  capabilities: Set<ProviderCapability>;

  discover(
    input: DiscoveryInput,
    context: ProviderContext
  ): Promise<ProviderResult>;
}
