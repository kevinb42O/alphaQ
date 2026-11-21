begin;
create table if not exists public.aqx_licenses (
 id uuid primary key default gen_random_uuid(),
 key_hash text unique not null check(key_hash ~ '^[a-f0-9]{64}$'),
 label text not null default '',
 duration_days integer not null check(duration_days in (0,1,3,7,30)),
 created_at timestamptz not null default now(),
 activated_at timestamptz,
 expires_at timestamptz,
 device_hash text check(device_hash is null or device_hash ~ '^[a-f0-9]{64}$'),
 revoked boolean not null default false,
 last_seen_at timestamptz,
 reset_count integer not null default 0
);
create table if not exists public.aqx_rate_limits (
 bucket text primary key, hits integer not null, expires_at timestamptz not null
);
create table if not exists public.aqx_audit (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 license_id uuid references public.aqx_licenses(id),
 action text not null,
 detail text not null default ''
);
alter table public.aqx_licenses enable row level security;
alter table public.aqx_rate_limits enable row level security;
alter table public.aqx_audit enable row level security;
revoke all on public.aqx_licenses,public.aqx_rate_limits,public.aqx_audit from public,anon,authenticated;
grant all on public.aqx_licenses,public.aqx_rate_limits,public.aqx_audit to service_role;
grant usage,select on sequence public.aqx_audit_id_seq to service_role;

create or replace function public.aqx_rate(p_bucket text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.aqx_rate_limits(bucket,hits,expires_at)
 values(p_bucket,1,clock_timestamp()+make_interval(secs=>p_seconds))
 on conflict(bucket) do update set
 hits=case when aqx_rate_limits.expires_at<=clock_timestamp() then 1 else aqx_rate_limits.hits+1 end,
 expires_at=case when aqx_rate_limits.expires_at<=clock_timestamp() then clock_timestamp()+make_interval(secs=>p_seconds) else aqx_rate_limits.expires_at end
 returning hits into n;
 if random()<0.02 then delete from public.aqx_rate_limits where expires_at<clock_timestamp()-interval '1 hour'; end if;
 return n<=p_limit;
end $$;

create or replace function public.aqx_verify(p_key_hash text,p_device_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.aqx_licenses%rowtype; t timestamptz:=clock_timestamp();
begin
 if p_key_hash !~ '^[a-f0-9]{64}$' or p_device_hash !~ '^[a-f0-9]{64}$' then
 return jsonb_build_object('ok',false,'code','invalid','message','Invalid license key or device.');end if;
 select * into l from public.aqx_licenses where key_hash=p_key_hash for update;
 if not found then return jsonb_build_object('ok',false,'code','invalid','message','Invalid license key. Check your key and retry.');end if;
 if l.revoked then return jsonb_build_object('ok',false,'code','revoked','message','This license has been revoked. Contact support on Discord.');end if;
 if l.expires_at is not null and l.expires_at<=t then return jsonb_build_object('ok',false,'code','expired','message','This license has expired. Enter a new key.');end if;
 if l.device_hash is not null and l.device_hash<>p_device_hash then return jsonb_build_object('ok',false,'code','device','message','This license is bound to another PC. Ask support for a device reset.');end if;
 if l.activated_at is null then
   update public.aqx_licenses set activated_at=t,expires_at=case when duration_days=0 then null else t+make_interval(days=>duration_days) end,
   device_hash=p_device_hash,last_seen_at=t where id=l.id returning * into l;
   insert into public.aqx_audit(license_id,action)values(l.id,'activate');
 else update public.aqx_licenses set device_hash=p_device_hash,last_seen_at=t where id=l.id;end if;
 return jsonb_build_object('ok',true,'code','active','license_id',l.id,'days',l.duration_days,
 'expires_at',l.expires_at,'expires_unix',case when l.expires_at is null then 0 else floor(extract(epoch from l.expires_at))::bigint end,
 'server_time',t,'message',case when l.duration_days=0 then 'Owner license active - valid forever.' else 'License active. Expires: '||to_char(l.expires_at at time zone 'UTC','YYYY-MM-DD HH24:MI')||' UTC' end);
end $$;

create or replace function public.aqx_manage(p_id uuid,p_action text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare l public.aqx_licenses%rowtype;
begin
 select * into l from public.aqx_licenses where id=p_id for update;
 if not found then raise exception 'License not found';end if;
 if p_action='revoke' then update public.aqx_licenses set revoked=true where id=p_id;
 elsif p_action='restore' then update public.aqx_licenses set revoked=false where id=p_id;
 elsif p_action='reset_device' then update public.aqx_licenses set device_hash=null,reset_count=reset_count+1 where id=p_id;
 else raise exception 'Unsupported action';end if;
 insert into public.aqx_audit(license_id,action)values(p_id,p_action);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.aqx_rate(text,integer,integer),public.aqx_verify(text,text),public.aqx_manage(uuid,text) from public,anon,authenticated;
grant execute on function public.aqx_rate(text,integer,integer),public.aqx_verify(text,text),public.aqx_manage(uuid,text) to service_role;
commit;
