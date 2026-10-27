-- Test schematu chmury: role, zaproszenia, RLS, numeracja zmian, migawki. Uruchamia supabase/tests/run.sh
\set ON_ERROR_STOP on
\set u1 '''11111111-1111-1111-1111-111111111111'''
\set u2 '''22222222-2222-2222-2222-222222222222'''
\set u3 '''33333333-3333-3333-3333-333333333333'''
\set u4 '''44444444-4444-4444-4444-444444444444'''
insert into auth.users(id, email) values (:u1, 'a@x'), (:u2, 'b@x'), (:u3, 'c@x'), (:u4, 'd@x');

create schema klaps_test;
grant usage on schema klaps_test to public;
create function klaps_test.expect_err(stmt text, pat text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlerrm !~ pat then raise exception 'oczekiwano błędu /%/, a jest: % (polecenie: %)', pat, sqlerrm, stmt; end if;
    return;
  end;
  raise exception 'oczekiwano błędu /%/, ale polecenie przeszło: %', pat, stmt;
end $$;
create function klaps_test.eq(a anyelement, b anyelement, what text) returns void language plpgsql as $$
begin if a is distinct from b then raise exception 'FAIL %: jest %, miało być %', what, a, b; end if; end $$;

-- ===== właściciel zakłada projekt =====
select set_config('request.jwt.claim.sub', :u1, false); set role authenticated;
select public.klaps_upsert_profile('Anna Nowak', 'Kierownik produkcji', 'data:image/jpeg;base64,AAAA', '#e0a526');
select public.klaps_create_project('ENC-TITLE', 'ENC-SNAP') as pid \gset
select klaps_test.eq((select count(*) from public.klaps_projects), 1::bigint, 'właściciel widzi swój projekt');
select klaps_test.eq(public.klaps_role(:'pid'), 'owner', 'rola właściciela');
select klaps_test.eq(public.klaps_push_ops(:'pid', 'c1', 1, 'op-a'), 1::bigint, 'pierwszy numer');
select klaps_test.eq(public.klaps_push_ops(:'pid', 'c1', 2, 'op-b'), 2::bigint, 'drugi numer');
select klaps_test.eq(public.klaps_push_ops(:'pid', 'c1', 2, 'op-b'), 2::bigint, 'ponowne wysłanie tej samej paczki nie dubluje');
select klaps_test.eq((select count(*) from public.klaps_ops), 2::bigint, 'dwie zmiany w dzienniku');
select public.klaps_log_activity(:'pid', 'ENC-LOG-1'); select public.klaps_log_activity(:'pid', 'ENC-LOG-2');
select klaps_test.eq((select count(*) from public.klaps_activity), 2::bigint, 'dziennik zmian: dwa wpisy');
select klaps_test.expect_err('insert into public.klaps_activity(project_id, author, payload) values (''' || :'pid' || ''', ''' || :u1 || ''', ''x'')', 'permission denied');
select klaps_test.expect_err('select public.klaps_log_activity(''' || :'pid' || ''', repeat(''x'', 20001))', 'too_big');
select public.klaps_log_activity(:'pid', 'x') from generate_series(1, 1005);
select klaps_test.eq((select count(*) from public.klaps_activity), 1000::bigint, 'dziennik zmian trzyma 1000 ostatnich wpisów');
-- bezpośrednie zapisy do tabel są zablokowane
select klaps_test.expect_err('insert into public.klaps_ops(project_id, seq, author, client_id, local_seq, payload) values (''' || :'pid' || ''', 99, ''' || :u1 || ''', ''x'', 1, ''p'')', 'permission denied');
select klaps_test.expect_err('update public.klaps_members set role = ''owner''', 'permission denied');
select klaps_test.expect_err('delete from public.klaps_projects', 'permission denied');

-- ===== zaproszenia =====
select public.klaps_create_invite(:'pid', 'editor', 'SECRETSECRETSECRETSECRET1', 'ENC-SEC-1', 24, 1) as inv1 \gset
select public.klaps_create_invite(:'pid', 'viewer', 'SECRETSECRETSECRETSECRET2', 'ENC-SEC-2', 0, 0) as inv2 \gset
select klaps_test.expect_err('select public.klaps_create_invite(''' || :'pid' || ''', ''owner'', ''SECRETSECRETSECRETSECRET3'', ''x'', 1, 1)', 'bad_role');
select klaps_test.expect_err('select public.klaps_create_invite(''' || :'pid' || ''', ''editor'', ''krotki'', ''x'', 1, 1)', 'weak_secret');
select klaps_test.eq((select count(*) from public.klaps_invites), 2::bigint, 'właściciel widzi zaproszenia');
select klaps_test.eq((select count(*) from public.klaps_invites where code_hash like '%SECRET%'), 0::bigint, 'sekret nie leży jawnie');

reset role; select set_config('request.jwt.claim.sub', :u2, false); set role authenticated;
select klaps_test.eq((select count(*) from public.klaps_projects), 0::bigint, 'obcy nie widzi projektu');
select klaps_test.expect_err('select public.klaps_push_ops(''' || :'pid' || ''', ''c2'', 1, ''x'')', 'not_member');
select klaps_test.expect_err('select * from public.klaps_redeem_invite(''zly-kod'')', 'invalid_invite');
select klaps_test.eq((select role from public.klaps_redeem_invite('SECRETSECRETSECRETSECRET1')), 'editor', 'dołączenie jako edytor');
select klaps_test.eq(public.klaps_role(:'pid'), 'editor', 'rola edytora');
select klaps_test.eq((select count(*) from public.klaps_invites), 0::bigint, 'edytor nie widzi zaproszeń');
select klaps_test.eq((select count(*) from public.klaps_profiles where id = :u1), 1::bigint, 'współpracownik widzi profil właściciela');
select klaps_test.eq(public.klaps_push_ops(:'pid', 'c2', 1, 'op-c'), 3::bigint, 'edytor dopisuje zmianę – kolejny numer');
select klaps_test.eq((select count(*) from public.klaps_ops), 3::bigint, 'edytor czyta dziennik');
select klaps_test.expect_err('select public.klaps_create_invite(''' || :'pid' || ''', ''editor'', ''SECRETSECRETSECRETSECRET9'', ''x'', 1, 1)', 'forbidden');
select klaps_test.expect_err('select public.klaps_set_role(''' || :'pid' || ''', ''' || :u2 || ''', ''viewer'')', 'forbidden');
select klaps_test.expect_err('select public.klaps_delete_project(''' || :'pid' || ''')', 'forbidden');

reset role; select set_config('request.jwt.claim.sub', :u3, false); set role authenticated;
select klaps_test.expect_err('select * from public.klaps_redeem_invite(''SECRETSECRETSECRETSECRET1'')', 'invalid_invite');   -- limit użyć = 1
select klaps_test.eq((select role from public.klaps_redeem_invite('SECRETSECRETSECRETSECRET2')), 'viewer', 'dołączenie jako podgląd');
select klaps_test.expect_err('select public.klaps_push_ops(''' || :'pid' || ''', ''c3'', 1, ''x'')', 'forbidden');
select klaps_test.expect_err('select public.klaps_put_blob(''' || :'pid' || ''', ''b1'', ''x'')', 'forbidden');
select klaps_test.eq((select count(*) from public.klaps_ops), 3::bigint, 'podgląd czyta dziennik');
select klaps_test.expect_err('select public.klaps_log_activity(''' || :'pid' || ''', ''x'')', 'forbidden');
select klaps_test.eq((select count(*) from public.klaps_activity), 1000::bigint, 'podgląd czyta dziennik zmian');

reset role; select set_config('request.jwt.claim.sub', :u4, false); set role authenticated;
select klaps_test.eq((select count(*) from public.klaps_ops), 0::bigint, 'osoba spoza projektu nie czyta dziennika');
select klaps_test.eq((select count(*) from public.klaps_activity), 0::bigint, 'ani dziennika zmian');
select klaps_test.expect_err('select public.klaps_log_activity(''' || :'pid' || ''', ''x'')', 'not_member');
select klaps_test.eq((select count(*) from public.klaps_members), 0::bigint, 'ani listy osób');
select klaps_test.eq((select count(*) from public.klaps_profiles where id = :u1), 0::bigint, 'ani profilu');

-- ===== role i usuwanie osób =====
reset role; select set_config('request.jwt.claim.sub', :u1, false); set role authenticated;
select public.klaps_set_role(:'pid', :u3, 'editor');
select klaps_test.eq((select role from public.klaps_members where user_id = :u3 and project_id = :'pid'), 'editor', 'zmiana roli');
select klaps_test.expect_err('select public.klaps_remove_member(''' || :'pid' || ''', ''' || :u1 || ''')', 'owner_cannot_leave');
select public.klaps_revoke_invite(:'inv2');
reset role; select set_config('request.jwt.claim.sub', :u4, false); set role authenticated;
select klaps_test.expect_err('select * from public.klaps_redeem_invite(''SECRETSECRETSECRETSECRET2'')', 'invalid_invite');   -- unieważnione
reset role; select set_config('request.jwt.claim.sub', :u1, false); set role authenticated;
select public.klaps_remove_member(:'pid', :u3);
select klaps_test.eq((select count(*) from public.klaps_members where project_id = :'pid'), 2::bigint, 'usunięto osobę');
-- samodzielne opuszczenie projektu
reset role; select set_config('request.jwt.claim.sub', :u2, false); set role authenticated;
select public.klaps_remove_member(:'pid', :u2);
select klaps_test.eq((select count(*) from public.klaps_ops), 0::bigint, 'po opuszczeniu brak dostępu');
-- wygasłe zaproszenie
reset role; select set_config('request.jwt.claim.sub', :u1, false); set role authenticated;
select public.klaps_create_invite(:'pid', 'editor', 'SECRETSECRETSECRETSECRET4', 'x', 1, 0) as inv4 \gset
reset role; update public.klaps_invites set expires_at = now() - interval '1 minute' where id = :'inv4';
select set_config('request.jwt.claim.sub', :u2, false); set role authenticated;
select klaps_test.expect_err('select * from public.klaps_redeem_invite(''SECRETSECRETSECRETSECRET4'')', 'invalid_invite');

-- ===== migawki i kompaktowanie =====
reset role; select set_config('request.jwt.claim.sub', :u1, false); set role authenticated;
do $$ declare p uuid := (select id from public.klaps_projects limit 1); i int; begin
  for i in 4..250 loop perform public.klaps_push_ops(p, 'c1', i, 'op-' || i); end loop;
end $$;
select klaps_test.eq((select head_seq from public.klaps_projects), 250::bigint, 'numeracja bez luk');
select public.klaps_put_snapshot(:'pid', 240, 'SNAP-240');
select klaps_test.eq((select seq from public.klaps_snapshots), 240::bigint, 'migawka zapisana');
select klaps_test.eq((select min(seq) from public.klaps_ops), 140::bigint, 'stare zmiany usunięte, ogon zostaje');
select public.klaps_put_snapshot(:'pid', 100, 'STARA');        -- nieaktualna: ignorowana
select klaps_test.eq((select payload from public.klaps_snapshots), 'SNAP-240', 'nieaktualna migawka ignorowana');
select public.klaps_put_snapshot(:'pid', 9999, 'Z-PRZYSZLOSCI'); -- wyprzedza dziennik: ignorowana
select klaps_test.eq((select payload from public.klaps_snapshots), 'SNAP-240', 'migawka z przyszłości ignorowana');
select klaps_test.eq(public.klaps_push_ops(:'pid', 'c1', 251, 'op-251'), 251::bigint, 'numeracja trwa po kompaktowaniu');

-- ===== zdjęcia/mapki, tytuł, przekazanie, usunięcie =====
select public.klaps_put_blob(:'pid', 'm1', 'BLOB');
select public.klaps_put_blob(:'pid', 'm1', 'INNY');
select klaps_test.eq((select payload from public.klaps_blobs where id = 'm1'), 'BLOB', 'zasób jest niezmienny');
select public.klaps_set_title(:'pid', 'ENC-NOWY');
select klaps_test.eq((select title_enc from public.klaps_projects), 'ENC-NOWY', 'zmiana tytułu');
reset role; select set_config('request.jwt.claim.sub', :u2, false); set role authenticated;
reset role; update public.klaps_invites set expires_at = now() + interval '1 hour' where id = :'inv4';
select set_config('request.jwt.claim.sub', :u2, false); set role authenticated;
select klaps_test.eq((select role from public.klaps_redeem_invite('SECRETSECRETSECRETSECRET4')), 'editor', 'ponowne dołączenie');
reset role; select set_config('request.jwt.claim.sub', :u1, false); set role authenticated;
select public.klaps_transfer_owner(:'pid', :u2);
select klaps_test.eq(public.klaps_role(:'pid'), 'editor', 'były właściciel jest edytorem');
select klaps_test.expect_err('select public.klaps_delete_project(''' || :'pid' || ''')', 'forbidden');
reset role; select set_config('request.jwt.claim.sub', :u2, false); set role authenticated;
select klaps_test.eq(public.klaps_role(:'pid'), 'owner', 'nowy właściciel');
select public.klaps_delete_project(:'pid');
reset role;
select klaps_test.eq((select count(*) from public.klaps_ops) + (select count(*) from public.klaps_members) + (select count(*) from public.klaps_snapshots) + (select count(*) from public.klaps_blobs) + (select count(*) from public.klaps_invites) + (select count(*) from public.klaps_activity), 0::bigint, 'usunięcie projektu czyści wszystko');
-- anonim nie ma dostępu do niczego poza wersją
set role anon;
select klaps_test.eq(public.klaps_version(), 1, 'wersja schematu dostępna');
select klaps_test.expect_err('select * from public.klaps_projects', 'permission denied');
select klaps_test.expect_err('select public.klaps_create_project(''a'', ''b'')', 'permission denied');
reset role;
\echo SQL: wszystkie testy przeszły
