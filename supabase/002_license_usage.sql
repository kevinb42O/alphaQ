begin;

alter table public.aqx_licenses
  add column if not exists archived_at timestamptz,
  add column if not exists previous_seen_at timestamptz,
  add column if not exists successful_checks bigint not null default 0;

create table if not exists public.aqx_license_checks (
  id bigint generated always as identity primary key,
  license_id uuid not null references public.aqx_licenses(id) on delete cascade,
  checked_at timestamptz not null
);

create index if not exists aqx_license_checks_recent
  on public.aqx_license_checks (license_id, id desc);

alter table public.aqx_license_checks enable row level security;
revoke all on public.aqx_license_checks from public, anon, authenticated;
grant select, insert, delete on public.aqx_license_checks to service_role;
revoke all on sequence public.aqx_license_checks_id_seq from public, anon, authenticated;
grant usage on sequence public.aqx_license_checks_id_seq to service_role;

create or replace function public.aqx_record_license_check()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.last_seen_at is null then
    return new;
  end if;

  new.previous_seen_at := old.last_seen_at;
  new.successful_checks := old.successful_checks + 1;
  insert into public.aqx_license_checks (license_id, checked_at)
    values (new.id, new.last_seen_at);

  -- Keep the latest 50 events even for heavily used permanent keys.
  delete from public.aqx_license_checks
    where license_id = new.id and id <= (
      select id from public.aqx_license_checks
      where license_id = new.id order by id desc offset 50 limit 1
    );
  return new;
end;
$$;

revoke all on function public.aqx_record_license_check() from public, anon, authenticated;
grant execute on function public.aqx_record_license_check() to service_role;

create or replace view public.aqx_visible_audit with (security_invoker = true) as
select audit.id, audit.created_at, audit.license_id, audit.action
from public.aqx_audit as audit
left join public.aqx_licenses as license on license.id = audit.license_id
where license.archived_at is null;

revoke all on public.aqx_visible_audit from public, anon, authenticated;
grant select on public.aqx_visible_audit to service_role;

drop trigger if exists aqx_record_license_check on public.aqx_licenses;
create trigger aqx_record_license_check
  before update of last_seen_at on public.aqx_licenses
  for each row execute function public.aqx_record_license_check();

create or replace function public.aqx_verify(p_key_hash text, p_device_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  license public.aqx_licenses%rowtype;
  checked_at timestamptz;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' or p_device_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Invalid key or device.');
  end if;

  select * into license from public.aqx_licenses where key_hash = p_key_hash for update;
  checked_at := clock_timestamp();
  if not found or license.archived_at is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Invalid license key. Check your key and retry.');
  end if;
  if license.revoked then
    return jsonb_build_object('ok', false, 'code', 'revoked', 'message', 'This license has been revoked. Contact support on Discord.');
  end if;
  if license.expires_at is not null and license.expires_at <= checked_at then
    return jsonb_build_object('ok', false, 'code', 'expired', 'message', 'This license has expired. Enter a new key.');
  end if;
  if license.device_hash is not null and license.device_hash <> p_device_hash then
    return jsonb_build_object('ok', false, 'code', 'device', 'message', 'This license is bound to another PC. Ask support for a device reset.');
  end if;

  if license.activated_at is null then
    update public.aqx_licenses set
      activated_at = checked_at,
      expires_at = case when duration_days = 0 then null else checked_at + make_interval(days => duration_days) end,
      device_hash = p_device_hash,
      last_seen_at = checked_at
    where id = license.id returning * into license;
    insert into public.aqx_audit (license_id, action) values (license.id, 'activate');
  else
    update public.aqx_licenses set device_hash = p_device_hash, last_seen_at = checked_at
    where id = license.id;
  end if;

  return jsonb_build_object(
    'ok', true, 'code', 'active', 'license_id', license.id, 'days', license.duration_days,
    'expires_at', license.expires_at,
    'expires_unix', case when license.expires_at is null then 0 else floor(extract(epoch from license.expires_at))::bigint end,
    'server_time', checked_at,
    'message', case when license.duration_days = 0 then 'Owner license active - valid forever.'
      else 'License active. Expires: ' || to_char(license.expires_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC' end
  );
end;
$$;

commit;
