# Shared agent report domains

Agents save `report_display_mode=subdomain` and a requested hostname in re-data,
then CNAME it to `reports.agentsautomated.com`. Saving a name or adding the generic
CNAME is **not** ownership approval. The first release uses the handoff's
operator-reviewed activation, not automatic approval from an editable profile.

The existing aa-blog Netlify site binds each approved alias and manages HTTPS.
Its edge router uses the actual request hostname, never forwarded-host headers.
Every request checks the service-only registry, current saved preference, current
active/past_due sellable county seats, and authoritative `zip_counties` mapping.
Unapproved, expired, cancelled, reassigned and wrong-county requests return 404.
Database/hosting failures return 503. Tenant responses are private/no-store.

## Operator workflow

Supply `SUPABASE_URL`, `AA_SUPABASE_SECRET_KEY`, `NETLIFY_AUTH_TOKEN` and
`NETLIFY_SITE_ID` through a secure operator environment. Never put them in static
files, client variables, command arguments or source control.

1. Independently review the requesting agent's control of the domain. A CNAME
   left behind by a previous owner is not sufficient evidence. Check the saved
   preference and current county seat before approval.
2. `node scripts/domains/manage.mjs approve HOST AGENT_UUID --ownership-reviewed`
   validates a registrable subdomain and exact CNAME target, records approval,
   binds the alias and requests managed HTTPS. Existing ownership by another
   agent is rejected rather than overwritten.
3. After certificate issuance, run
   `node scripts/domains/manage.mjs activate HOST`. It verifies DNS, hosting,
   actual HTTPS, current eligibility and the rendered agent identity. A failed
   identity check sets the binding to error; it does not silently mark it live.
4. Run `node scripts/domains/manage.mjs reconcile` after a domain/settings/seat
   change and as part of operator checks. It disables invalid bindings and removes
   their hosting aliases. Database lifecycle triggers revoke approval on domain/preference changes or loss of all eligible seats; reverting a preference does not restore old approval. Runtime eligibility checks block old portals immediately,
   even before operator reconciliation. No production schedule was added.
5. `node scripts/domains/manage.mjs disable HOST` first disables routing, then
   removes the alias. A failed alias removal is retryable; routing stays disabled.
   Reassignment requires fresh approval, never reuse of another agent's binding.

The canonical AA site and slug/UUID embeds remain available. Tenant homepages
are self-canonical; duplicate ZIP/monthly reports canonical to AA. Navigation and
signup choices stay within the currently owned counties. Only public narration
and charts are reused. Videos without explicit current-agent ownership metadata
are omitted rather than showing another agent's baked-in branding.

## Test-only seat

`test-agent.agentsautomated.com` has a separate, expiring registry mapping to the
approved test agent and Los Angeles county. It does not alter `counties`, Stripe,
subscriptions, paid availability, canonical agent attribution, or real agent
preferences (platform domains remain forbidden in normal onboarding). The portal
is noindex. A real county assignment or expiration immediately disables this test
scope. Test seats are never accepted on any other hostname.

To remove the pilot, disable its binding and delete its test-seat row. Keep the
shared `reports.agentsautomated.com` service hostname. Do not alter apex, MX,
nameserver or unrelated DNS records.

## Deployment and refresh

Deploy the shared edge router, public renderer assets and seat-directory function
from this repository using the existing Netlify site configuration. The SQL
migrations in `database/20261112160000_agent_report_domains.sql` and
`database/20261112161000_agent_domain_lifecycle.sql` create the service-only
registry and lifecycle revocation triggers.
The edge runtime uses Netlify Functions-scoped Supabase credentials. Agent/public
projections omit domain approval state, secrets and private profile data.

Profile and county changes are read per request; published report content comes
from the existing canonical site's JSON endpoints. There is no per-agent build
or fork. A canonical publication/build makes refreshed content available to all
approved hosts. Existing signup consent, honeypot and subscribe-zip lifecycle are
reused. Verification intercepts submissions so it sends no real emails.
