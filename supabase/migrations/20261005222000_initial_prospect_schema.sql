-- ============================================================
-- DesireTech Prospect Intelligence OS
-- Initial database schema
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- WORKSPACES
-- ============================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ICP PROFILES
-- ============================================================

create table public.icp_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  target_industries text[] not null default '{}',
  target_locations text[] not null default '{}',
  min_employees integer,
  max_employees integer,
  target_titles text[] not null default '{}',
  keywords text[] not null default '{}',
  exclusions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint icp_employee_range_check
    check (
      min_employees is null
      or max_employees is null
      or min_employees <= max_employees
    ),

  constraint icp_min_employees_check
    check (min_employees is null or min_employees >= 0),

  constraint icp_max_employees_check
    check (max_employees is null or max_employees >= 0)
);

-- ============================================================
-- PROSPECT SEARCHES
-- ============================================================

create table public.prospect_searches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  icp_profile_id uuid references public.icp_profiles(id) on delete set null,
  query text not null,
  filters jsonb not null default '{}',
  status text not null default 'pending',
  requested_limit integer not null default 25,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  constraint prospect_searches_status_check
    check (
      status in (
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  constraint prospect_searches_limit_check
    check (requested_limit between 1 and 500)
);

-- ============================================================
-- COMPANIES
-- ============================================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  domain text,
  website_url text,
  description text,
  industry text,
  employee_count integer,
  location jsonb not null default '{}',
  founded_year integer,
  linkedin_url text,
  phone text,
  email text,
  data_confidence numeric(5,4) not null default 0,
  last_enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint companies_confidence_check
    check (data_confidence between 0 and 1),

  constraint companies_employee_count_check
    check (employee_count is null or employee_count >= 0)
);

-- ============================================================
-- COMPANY SOURCES
-- ============================================================

create table public.company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider_id text not null,
  external_id text,
  source_url text,
  source_type text,
  confidence numeric(5,4),
  raw_data jsonb not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint company_sources_confidence_check
    check (confidence is null or confidence between 0 and 1)
);

-- ============================================================
-- COMPANY SIGNALS
-- ============================================================

create table public.company_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  signal_type text not null,
  signal_strength numeric(5,4) not null default 0,
  title text,
  description text,
  source_url text,
  detected_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}',

  constraint company_signals_strength_check
    check (signal_strength between 0 and 1)
);

-- ============================================================
-- COMPANY TECHNOLOGIES
-- ============================================================

create table public.company_technologies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  technology_name text not null,
  category text,
  confidence numeric(5,4) not null default 0,
  detected_at timestamptz not null default now(),
  source_url text,
  metadata jsonb not null default '{}',

  constraint company_technologies_confidence_check
    check (confidence between 0 and 1)
);

-- ============================================================
-- CONTACTS
-- ============================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  first_name text,
  last_name text,
  full_name text not null,
  job_title text,
  seniority text,
  department text,
  email text,
  email_confidence numeric(5,4),
  phone text,
  linkedin_url text,
  location jsonb not null default '{}',
  data_confidence numeric(5,4) not null default 0,
  last_enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contacts_email_confidence_check
    check (email_confidence is null or email_confidence between 0 and 1),

  constraint contacts_data_confidence_check
    check (data_confidence between 0 and 1)
);

-- ============================================================
-- CONTACT SOURCES
-- ============================================================

create table public.contact_sources (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  provider_id text not null,
  external_id text,
  source_url text,
  source_type text,
  confidence numeric(5,4),
  raw_data jsonb not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint contact_sources_confidence_check
    check (confidence is null or confidence between 0 and 1)
);

-- ============================================================
-- PROSPECTS
-- ============================================================

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  search_id uuid references public.prospect_searches(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  primary_contact_id uuid references public.contacts(id) on delete set null,
  status text not null default 'new',
  current_score numeric(5,2) not null default 0,
  score_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint prospects_score_check
    check (current_score between 0 and 100),

  constraint prospects_status_check
    check (
      status in (
        'new',
        'saved',
        'qualified',
        'contacted',
        'replied',
        'meeting',
        'customer',
        'disqualified'
      )
    ),

  unique (workspace_id, company_id)
);

-- ============================================================
-- PROSPECT SCORES
-- ============================================================

create table public.prospect_scores (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  icp_fit numeric(5,2) not null default 0,
  problem_need numeric(5,2) not null default 0,
  buying_intent numeric(5,2) not null default 0,
  reachability numeric(5,2) not null default 0,
  timing numeric(5,2) not null default 0,
  data_confidence numeric(5,2) not null default 0,
  total_score numeric(5,2) not null default 0,
  scoring_version text not null default 'v1',
  calculated_at timestamptz not null default now(),

  constraint prospect_scores_components_check
    check (
      icp_fit between 0 and 30
      and problem_need between 0 and 20
      and buying_intent between 0 and 20
      and reachability between 0 and 15
      and timing between 0 and 10
      and data_confidence between 0 and 5
    ),

  constraint prospect_scores_total_check
    check (total_score between 0 and 100)
);

-- ============================================================
-- PROSPECT REASONS
-- ============================================================

create table public.prospect_reasons (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  reason_type text not null,
  title text not null,
  explanation text not null,
  evidence jsonb not null default '{}',
  priority integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SAVED PROSPECTS
-- ============================================================

create table public.saved_prospects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  created_at timestamptz not null default now(),

  unique (workspace_id, prospect_id)
);

-- ============================================================
-- PROSPECT NOTES
-- ============================================================

create table public.prospect_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  prospect_id uuid not null references public.prospects(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- PROVIDER USAGE
-- ============================================================

create table public.provider_usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  search_id uuid references public.prospect_searches(id) on delete set null,
  provider_id text not null,
  operation text not null,
  request_count integer not null default 1,
  result_count integer not null default 0,
  estimated_cost numeric(12,6) not null default 0,
  latency_ms integer,
  success boolean not null default true,
  error_message text,
  created_at timestamptz not null default now(),

  constraint provider_usage_request_count_check
    check (request_count >= 0),

  constraint provider_usage_result_count_check
    check (result_count >= 0),

  constraint provider_usage_cost_check
    check (estimated_cost >= 0),

  constraint provider_usage_latency_check
    check (latency_ms is null or latency_ms >= 0)
);

-- ============================================================
-- RESEARCH JOBS
-- ============================================================

create table public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  search_id uuid references public.prospect_searches(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending',
  priority integer not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  payload jsonb not null default '{}',
  result jsonb not null default '{}',
  error_message text,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint research_jobs_status_check
    check (
      status in (
        'pending',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  constraint research_jobs_attempts_check
    check (attempts >= 0 and max_attempts >= 1)
);

-- ============================================================
-- ACTIVITY LOG
-- ============================================================

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  prospect_id uuid references public.prospects(id) on delete cascade,
  activity_type text not null,
  description text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_icp_profiles_workspace
  on public.icp_profiles(workspace_id);

create index idx_prospect_searches_workspace
  on public.prospect_searches(workspace_id);

create index idx_prospect_searches_status
  on public.prospect_searches(status);

create index idx_companies_normalized_name
  on public.companies(normalized_name);

create index idx_companies_domain
  on public.companies(domain);

create index idx_company_sources_company
  on public.company_sources(company_id);

create index idx_company_sources_provider
  on public.company_sources(provider_id);

create index idx_company_signals_company
  on public.company_signals(company_id);

create index idx_company_signals_type
  on public.company_signals(signal_type);

create index idx_company_signals_detected
  on public.company_signals(detected_at desc);

create index idx_company_technologies_company
  on public.company_technologies(company_id);

create index idx_company_technologies_name
  on public.company_technologies(technology_name);

create index idx_contacts_company
  on public.contacts(company_id);

create index idx_contacts_email
  on public.contacts(email);

create index idx_contacts_linkedin
  on public.contacts(linkedin_url);

create index idx_contact_sources_contact
  on public.contact_sources(contact_id);

create index idx_prospects_workspace
  on public.prospects(workspace_id);

create index idx_prospects_search
  on public.prospects(search_id);

create index idx_prospects_company
  on public.prospects(company_id);

create index idx_prospects_score
  on public.prospects(current_score desc);

create index idx_prospect_scores_prospect
  on public.prospect_scores(prospect_id);

create index idx_prospect_scores_total
  on public.prospect_scores(total_score desc);

create index idx_prospect_reasons_prospect
  on public.prospect_reasons(prospect_id);

create index idx_saved_prospects_workspace
  on public.saved_prospects(workspace_id);

create index idx_prospect_notes_prospect
  on public.prospect_notes(prospect_id);

create index idx_provider_usage_workspace
  on public.provider_usage(workspace_id);

create index idx_provider_usage_search
  on public.provider_usage(search_id);

create index idx_provider_usage_provider
  on public.provider_usage(provider_id);

create index idx_research_jobs_status
  on public.research_jobs(status);

create index idx_research_jobs_scheduled
  on public.research_jobs(scheduled_at);

create index idx_research_jobs_priority
  on public.research_jobs(priority desc);

create index idx_activity_log_workspace
  on public.activity_log(workspace_id);

create index idx_activity_log_prospect
  on public.activity_log(prospect_id);

create index idx_activity_log_created
  on public.activity_log(created_at desc);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger icp_profiles_set_updated_at
before update on public.icp_profiles
for each row execute function public.set_updated_at();

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create trigger prospects_set_updated_at
before update on public.prospects
for each row execute function public.set_updated_at();

create trigger prospect_notes_set_updated_at
before update on public.prospect_notes
for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.workspaces enable row level security;
alter table public.icp_profiles enable row level security;
alter table public.prospect_searches enable row level security;
alter table public.companies enable row level security;
alter table public.company_sources enable row level security;
alter table public.company_signals enable row level security;
alter table public.company_technologies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_sources enable row level security;
alter table public.prospects enable row level security;
alter table public.prospect_scores enable row level security;
alter table public.prospect_reasons enable row level security;
alter table public.saved_prospects enable row level security;
alter table public.prospect_notes enable row level security;
alter table public.provider_usage enable row level security;
alter table public.research_jobs enable row level security;
alter table public.activity_log enable row level security;

-- ============================================================
-- NOTE
-- ============================================================
-- Authentication and workspace membership policies will be added
-- after the application authentication model is implemented.
-- Until then, the Edge Functions will use the Supabase service
-- role for server-side database operations.