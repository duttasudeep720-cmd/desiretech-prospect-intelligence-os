import type {
  CompanyCandidate,
  DiscoveryInput,
  DiscoveryProvider,
  ProviderContext,
  ProviderResult,
} from "../types.ts";
import { normalizeCandidate } from "../../normalization/company.ts";

interface SerperOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

const BLOCKED_DOMAINS = new Set([
  "google.com",
  "google.co.in",
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "youtube.com",
  "twitter.com",
  "x.com",
  "wikipedia.org",
  "builtin.com",
  "saasboomi.org",
  "ycombinator.com",
  "geekschip.com",
  "cutshort.io",
  "crunchbase.com",
  "clutch.co",
  "g2.com",
  "capterra.com",
  "glassdoor.com",
  "indeed.com",
  "ambitionbox.com",
  "tracxn.com",
  "wellfound.com",
  "salesleadsforever.com",
  "startupindia.gov.in",
  "economictimes.indiatimes.com",
  "yourstory.com",
  "inc42.com",
]);

const BLOCKED_HOST_PATTERNS = [
  /(^|\.)(directory|directories)\./i,
  /(^|\.)(list|lists)\./i,
  /(^|\.)(database|databases)\./i,
  /(^|\.)(lead|leads)\./i,
];

const NON_COMPANY_PATTERNS = [
  /\b\d+\s+(best|top)\b/i,
  /\btop\s+\d+\b/i,
  /\bbest\s+\d+\b/i,
  /\bcompanies?\s+in\b/i,
  /\bcompanies?\s+to\s+know\b/i,
  /\bcompany\s+list\b/i,
  /\blist\s+of\s+companies\b/i,
  /\bcomplete\s+list\b/i,
  /\blist\s+of\b/i,
  /\bdata\s+in\b/i,
  /\bdirectory\b/i,
  /\btracker\b/i,
  /\bstartup\s+directory\b/i,
  /\bstartups?\s+(in|funded|to\s+know)\b/i,
  /\bguide\b/i,
  /\bmarketplace\b/i,
  /\bjob\s+board\b/i,
  /\bcompanies?\s+to\s+work\s+for\b/i,

  // Agencies / service businesses.
  /\bdevelopment\s+company\b/i,
  /\bsoftware\s+development\b/i,
  /\bweb\s+development\b/i,
  /\bapp\s+development\b/i,
  /\bit\s+services?\b/i,
  /\btechnology\s+services?\b/i,
  /\bdigital\s+services?\b/i,
  /\bconsulting\b/i,
  /\bconsultancy\b/i,
  /\bagency\b/i,
  /\boutsource\b/i,
  /\boutsourcing\b/i,
  /\bservice\s+provider\b/i,
  /\bprofessional\s+services?\b/i,
];

const NON_COMPANY_SNIPPET_PATTERNS = [
  /\bwe provide\b/i,
  /\bwe offer\b/i,
  /\bour services\b/i,
  /\bservices include\b/i,
  /\bsoftware development company\b/i,
  /\bweb development company\b/i,
  /\bdigital marketing agency\b/i,
  /\bit consulting\b/i,
  /\btechnology consulting\b/i,
  /\btop\s+saas\s+startups?\b/i,
  /\bcompanies\s+list\b/i,
];

const BLOCKED_PATH_PATTERNS = [
  "/blog/",
  "/blogs/",
  "/articles/",
  "/article/",
  "/directory/",
  "/directories/",
  "/companies/",
  "/company-list/",
  "/companylist/",
  "/lists/",
  "/list/",
  "/rankings/",
  "/ranking/",
  "/guides/",
  "/guide/",
  "/jobs/",
  "/careers/",
  "/services/",
  "/service/",
  "/startups/",
  "/startup/",
  "/search",
  "/data/",
  "/database/",
  "/databases/",
  "/leads/",
  "/lead/",
];

function extractDomain(
  url: string
): string | undefined {
  try {
    const parsed = new URL(url);

    const hostname = parsed.hostname
      .toLowerCase()
      .replace(/^www\./, "");

    if (BLOCKED_DOMAINS.has(hostname)) {
      return undefined;
    }

    if (
      BLOCKED_HOST_PATTERNS.some(
        (pattern) => pattern.test(hostname)
      )
    ) {
      return undefined;
    }

    return hostname;
  } catch {
    return undefined;
  }
}

function isHomepage(url: string): boolean {
  try {
    const parsed = new URL(url);

    const normalizedPath =
      parsed.pathname
        .replace(/\/+$/, "")
        .toLowerCase();

    return (
      normalizedPath === "" ||
      normalizedPath === "/home" ||
      normalizedPath === "/index.html" ||
      normalizedPath === "/index.php"
    );
  } catch {
    return false;
  }
}

function isLikelyCompanyPage(
  result: SerperOrganicResult
): boolean {
  if (!result.title || !result.link) {
    return false;
  }

  const domain = extractDomain(result.link);

  if (!domain) {
    return false;
  }

  const title = result.title.trim();
  const snippet =
    result.snippet?.trim() ?? "";

  if (
    NON_COMPANY_PATTERNS.some(
      (pattern) => pattern.test(title)
    )
  ) {
    return false;
  }

  if (
    NON_COMPANY_SNIPPET_PATTERNS.some(
      (pattern) => pattern.test(snippet)
    )
  ) {
    return false;
  }

  try {
    const url = new URL(result.link);

    const path =
      url.pathname.toLowerCase();

    if (
      BLOCKED_PATH_PATTERNS.some(
        (pattern) => path.includes(pattern)
      )
    ) {
      return false;
    }
  } catch {
    return false;
  }

  // Discovery should primarily return company homepages.
  if (!isHomepage(result.link)) {
    return false;
  }

  return true;
}

function companyNameFromTitle(
  title: string,
  domain: string
): string {
  const cleaned = title
    .replace(/\s*[|–—-]\s*.*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    cleaned.length >= 2 &&
    !NON_COMPANY_PATTERNS.some(
      (pattern) => pattern.test(cleaned)
    )
  ) {
    return cleaned;
  }

  return domain
    .split(".")[0]
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function confidenceFromPosition(
  position: number | undefined
): number {
  const safePosition =
    position ?? 10;

  if (safePosition <= 1) return 0.90;
  if (safePosition <= 3) return 0.84;
  if (safePosition <= 5) return 0.78;
  if (safePosition <= 8) return 0.70;

  return 0.62;
}

export class SerperDiscoveryProvider
  implements DiscoveryProvider {
  id = "serper";
  name = "Serper Google Search";
  priority = 10;

  capabilities = new Set([
    "company_discovery",
  ] as const);

  async discover(
    input: DiscoveryInput,
    context: ProviderContext
  ): Promise<ProviderResult> {
    const startedAt = Date.now();

    const apiKey =
      Deno.env.get(
        "SERPER_API_KEY"
      );

    if (!apiKey) {
      throw new Error(
        "SERPER_API_KEY is not configured"
      );
    }

    if (
      context.remainingBudget <= 0
    ) {
      throw new Error(
        "Provider budget exhausted"
      );
    }

    const queryParts = [input.query];

    if (input.industry) {
      queryParts.push(
        input.industry
      );
    }

    if (input.location) {
      queryParts.push(
        input.location
      );
    }

    const query =
      queryParts.join(" ");

    const candidatesByDomain =
      new Map<
        string,
        CompanyCandidate
      >();

    const pagesToFetch =
      Math.min(
        Math.max(
          Math.ceil(input.limit / 5),
          1
        ),
        3
      );

    let successfulQueries = 0;

    for (
      let page = 1;
      page <= pagesToFetch;
      page++
    ) {
      if (
        context.remainingBudget <=
        successfulQueries
      ) {
        break;
      }

      const response = await fetch(
        "https://google.serper.dev/search",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            "X-API-KEY":
              apiKey,
          },
          body: JSON.stringify({
            q: query,
            num: 10,
            page,
            gl: "in",
            hl: "en",
          }),
        }
      );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          `Serper request failed (${response.status}): ${errorText.slice(
            0,
            500
          )}`
        );
      }

      successfulQueries++;

      const data =
        (await response.json()) as SerperResponse;

      for (
        const result of
          data.organic ?? []
      ) {
        if (
          !isLikelyCompanyPage(
            result
          )
        ) {
          continue;
        }

        const domain =
          extractDomain(
            result.link!
          );

        if (!domain) {
          continue;
        }

        const candidate =
          normalizeCandidate({
            name:
              companyNameFromTitle(
                result.title!,
                domain
              ),

            domain,

            websiteUrl:
              result.link,

            industry:
              input.industry,

            location:
              input.location
                ? {
                    country:
                      input.location,
                  }
                : undefined,

            description:
              result.snippet,

            source: {
              providerId:
                this.id,
              sourceUrl:
                result.link,
            },

            confidence:
              confidenceFromPosition(
                result.position
              ),
          });

        const existing =
          candidatesByDomain.get(
            domain
          );

        if (
          !existing ||
          candidate.confidence >
            existing.confidence
        ) {
          candidatesByDomain.set(
            domain,
            candidate
          );
        }
      }

      if (
        candidatesByDomain.size >=
        input.limit
      ) {
        break;
      }
    }

    const candidates =
      [
        ...candidatesByDomain.values(),
      ]
        .sort(
          (a, b) =>
            b.confidence -
            a.confidence
        )
        .slice(
          0,
          input.limit
        );

    return {
      candidates,

      providerId:
        this.id,

      latencyMs:
        Date.now() -
        startedAt,

      estimatedCost:
        successfulQueries * Number(
          Deno.env.get(
            "SERPER_ESTIMATED_COST"
          ) ?? "0.001"
        ),
    };
  }
}