begin;
create or replace function public.suspend_changed_agent_report_domains() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.agent_report_domains d set status='disabled',ownership_verified_at=null,tls_verified_at=null,updated_at=now()
 where d.agent_id=new.id and not d.test_only
 and (new.report_display_mode is distinct from 'subdomain' or new.report_subdomain is distinct from d.hostname)
 and d.status<>'disabled';
 return new;
end $$;
drop trigger if exists agents_suspend_changed_report_domains on public.agents;
create trigger agents_suspend_changed_report_domains after update of report_display_mode,report_subdomain on public.agents
for each row execute function public.suspend_changed_agent_report_domains();
create or replace function public.suspend_ineligible_agent_report_domains() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.seat_agent_id is not null then
  update public.agent_report_domains d set status='disabled',ownership_verified_at=null,tls_verified_at=null,updated_at=now()
  where d.agent_id=old.seat_agent_id and not d.test_only and d.status<>'disabled'
  and not exists(select 1 from public.counties c where c.seat_agent_id=old.seat_agent_id and c.is_sellable and c.subscription_status in ('active','past_due'));
 end if;
 if new.seat_agent_id is not null then
  update public.agent_report_domains d set status='disabled',updated_at=now()
  where d.test_only and exists(select 1 from public.agent_report_test_seats t where t.hostname=d.hostname and t.county_id=new.id);
 end if;
 return new;
end $$;
drop trigger if exists counties_suspend_ineligible_report_domains on public.counties;
create trigger counties_suspend_ineligible_report_domains after update of seat_agent_id,subscription_status,is_sellable on public.counties
for each row execute function public.suspend_ineligible_agent_report_domains();
revoke all on function public.suspend_changed_agent_report_domains(),public.suspend_ineligible_agent_report_domains() from public,anon,authenticated;
commit;
