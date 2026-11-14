begin;
create table if not exists public.agent_report_domains (
 hostname text primary key check (hostname = lower(hostname) and hostname !~ '[/:[:space:]]' and length(hostname)<=253),
 agent_id uuid not null references public.agents(id),
 status text not null default 'pending_dns' check(status in ('pending_dns','pending_ssl','live','disabled','error')),
 netlify_site_id text,
 ownership_verified_at timestamptz,
 ownership_method text check(ownership_method in ('admin_reviewed','managed_dns')),
 tls_verified_at timestamptz,
 test_only boolean not null default false,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (not test_only or (hostname='test-agent.agentsautomated.com' and expires_at is not null)),
 check (status<>'live' or (ownership_verified_at is not null and tls_verified_at is not null and netlify_site_id is not null))
);
create table if not exists public.agent_report_test_seats (
 hostname text not null references public.agent_report_domains(hostname) on delete cascade,
 agent_id uuid not null references public.agents(id),
 county_id uuid not null references public.counties(id),
 expires_at timestamptz not null,
 primary key(hostname,county_id),
 check(hostname='test-agent.agentsautomated.com')
);
alter table public.agent_report_domains enable row level security;
alter table public.agent_report_test_seats enable row level security;
revoke all on public.agent_report_domains,public.agent_report_test_seats from public,anon,authenticated;
grant select,insert,update,delete on public.agent_report_domains,public.agent_report_test_seats to service_role;
comment on table public.agent_report_domains is 'Operator-controlled verified hosting bindings. Agent-editable preferences never activate routing.';
comment on table public.agent_report_test_seats is 'Expiring isolated portal test seats only; never changes county ownership, billing or canonical seat attribution.';
commit;
