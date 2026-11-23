begin;
do $$
declare k text:=repeat('a',64);d text:=repeat('b',64);other text:=repeat('c',64);r jsonb;fixture_id uuid;expiry text;
begin
 if has_table_privilege('anon','public.aqx_licenses','SELECT') then raise exception 'Anonymous table access';end if;
 if has_table_privilege('authenticated','public.aqx_licenses','SELECT') then raise exception 'Authenticated table access';end if;
 if has_function_privilege('anon','public.aqx_verify(text,text)','EXECUTE') then raise exception 'Anonymous verification access';end if;
 if has_function_privilege('authenticated','public.aqx_manage(uuid,text)','EXECUTE') then raise exception 'Authenticated management access';end if;
 if has_table_privilege('anon','public.aqx_license_checks','SELECT') then raise exception 'Anonymous history access';end if;
 insert into public.aqx_licenses(key_hash,label,duration_days)values(k,'TRANSACTIONAL ACCEPTANCE FIXTURE',3) returning aqx_licenses.id into fixture_id;
 r:=public.aqx_verify(k,d);if not (r->>'ok')::boolean then raise exception 'Activation failed';end if;
 expiry:=r->>'expires_at';
 if abs((r->>'expires_unix')::bigint-extract(epoch from clock_timestamp())-259200)>2 then raise exception 'Three-day expiry incorrect';end if;
 r:=public.aqx_verify(k,d);if r->>'expires_at'<>expiry then raise exception 'Repeat activation reset expiry';end if;
 r:=public.aqx_verify(k,other);if r->>'code'<>'device' then raise exception 'Wrong device accepted';end if;
 if not exists(select 1 from public.aqx_licenses where id=fixture_id and successful_checks=2 and previous_seen_at<=last_seen_at)
   or (select count(*) from public.aqx_license_checks where license_id=fixture_id)<>2 then raise exception 'Successful check history incorrect';end if;
 perform public.aqx_manage(fixture_id,'reset_device');r:=public.aqx_verify(k,other);if not (r->>'ok')::boolean or r->>'expires_at'<>expiry then raise exception 'Reset changed expiry';end if;
 perform public.aqx_manage(fixture_id,'revoke');r:=public.aqx_verify(k,other);if r->>'code'<>'revoked' then raise exception 'Revocation failed';end if;
 perform public.aqx_manage(fixture_id,'restore');r:=public.aqx_verify(k,other);if not (r->>'ok')::boolean then raise exception 'Restore failed';end if;
 update public.aqx_licenses set expires_at=clock_timestamp()-interval '1 second' where aqx_licenses.id=fixture_id;
 r:=public.aqx_verify(k,other);if r->>'code'<>'expired' then raise exception 'Expiry failed';end if;
 insert into public.aqx_licenses(key_hash,label,duration_days)values(repeat('d',64),'PERMANENT ACCEPTANCE FIXTURE',0);
 r:=public.aqx_verify(repeat('d',64),d);if not(r->>'ok')::boolean or (r->>'expires_unix')::bigint<>0 then raise exception 'Permanent license failed';end if;
 for i in 1..55 loop perform public.aqx_verify(repeat('d',64),d);end loop;
 if (select count(*) from public.aqx_license_checks where license_id=(r->>'license_id')::uuid)<>50
   or (select successful_checks from public.aqx_licenses where id=(r->>'license_id')::uuid)<>56 then raise exception 'History retention incorrect';end if;
 update public.aqx_licenses set archived_at=clock_timestamp() where id=(r->>'license_id')::uuid;
 r:=public.aqx_verify(repeat('d',64),d);if r->>'code'<>'invalid' then raise exception 'Archived license accepted';end if;
 if exists(select 1 from public.aqx_visible_audit where license_id in (select id from public.aqx_licenses where archived_at is not null))
   then raise exception 'Archived activity still visible';end if;
 if not public.aqx_rate('acceptance-fixture',1,60) or public.aqx_rate('acceptance-fixture',1,60) then raise exception 'Rate limiting failed';end if;
end $$;
rollback;
select 'PASS: activation, expiry, repeat checks, device binding, reset, revoke, restore, history retention, archive, rate limits and access isolation. Fixtures rolled back.' as acceptance;
