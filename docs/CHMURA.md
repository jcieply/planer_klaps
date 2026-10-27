# Chmura i praca zespołowa (Klaps Planer 2.3)

Do pracy nad jednym projektem pracuje zwykle 5–6 osób naraz. Chmura działa jak wspólny dokument: zmiany widać u wszystkich
na żywo, a projekt jest **szyfrowany end-to-end** (serwer nigdy nie widzi treści).

## Jak to wygląda dla użytkownika

1. **Konto** – w oknie startowym przycisk „Zaloguj do chmury” → „Załóż konto”: imię i nazwisko, stanowisko, zdjęcie, e-mail, hasło.
   Nikt nie wpisuje adresu serwera ani kluczy – są wbudowane w program.
2. **Projekt w chmurze** – „Nowy projekt” → „Gdzie zapisać: Chmura (zespół)”. Istniejący projekt lokalny:
   Ustawienia → „Chmura – praca zespołowa” → „Udostępnij w chmurze” (powstaje kopia, lokalny zostaje).
3. **Zaproszenia** – okno startowe → „Zarządzanie” → zakładka „Zaproszenia”: wybierasz rolę (Edytor / Podgląd), ważność i liczbę użyć,
   dostajesz **kod** `KLAPS-XXXXX-…`. Przekazujesz go osobie (komunikator), a ona wybiera „Dołącz kodem”.
4. **Role** (zakładka „Osoby”): *Właściciel* zarządza osobami i kodami, *Edytor* zmienia plan, *Podgląd* tylko czyta.
   Zmiana roli działa od razu, także w otwartym oknie. Właściciel może też przekazać własność lub usunąć osobę.
5. **Praca** – u góry widać, kto jest online (zdjęcia/inicjały, podpowiedź z zakładką, w której pracuje). Cofnij/Ponów dotyczy
   tylko Twoich zmian. Bez internetu zmiany zapisują się lokalnie (zaszyfrowane) i wysyłają po powrocie sieci.

## Jednorazowa konfiguracja Supabase (robi administrator, nie użytkownik)

1. Załóż darmowy projekt na <https://supabase.com> (region w UE).
2. **Authentication → Providers → Email**: wyłącz „Confirm email” (prostsze zakładanie kont) albo zostaw włączone –
   program pokaże wtedy prośbę o kliknięcie linku. Minimalna długość hasła: 8.
3. **SQL Editor → New query**: wklej całą zawartość `supabase/schema.sql` → Run. (Można uruchomić ponownie przy aktualizacji.)
4. **Database → Replication**: upewnij się, że publikacja `supabase_realtime` zawiera `klaps_ops` i `klaps_members`
   (schemat dodaje je sam, jeśli publikacja istnieje).
5. **Project Settings → API**: skopiuj *Project URL* i klucz *anon public*.
6. W repozytorium GitHub: **Settings → Secrets and variables → Actions → Variables** dodaj
   `KLAPS_SUPABASE_URL` i `KLAPS_SUPABASE_ANON_KEY`. Instalatory budowane przez Actions wbudowują je w program.
   Lokalnie: `VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… npm run dist`.

Klucz *anon* jest publiczny z założenia; o dostępie decydują reguły RLS i funkcje w `schema.sql` (testowane w CI).
**Nigdy nie wbudowuj klucza `service_role`.**

## Bezpieczeństwo i szyfrowanie

- Klucz projektu *K* (AES-GCM 256) powstaje na komputerze właściciela. Serwer go nie dostaje. Leży w magazynie systemu
  (Keychain macOS / DPAPI Windows przez `safeStorage`) – tam też sesja logowania.
- Kod zaproszenia = sekret (serwer zna tylko jego SHA-256) + klucz *K*. Kto ma kod, może odczytać projekt – traktuj go jak hasło,
  unieważniaj po użyciu. Właściciel może ponownie skopiować aktywny kod (jest zapisany zaszyfrowany kluczem projektu).
- Serwer widzi: konta (e-mail), imię, stanowisko i zdjęcie profilu, członkostwa i role, czasy zmian, rozmiary. Nie widzi: tytułów,
  scen, zmian, zdjęć/map (wszystko jest szyfrogramem).
- Zapisy idą wyłącznie przez funkcje SQL, które sprawdzają rolę; tabele są tylko do odczytu dla członków (RLS).

## Jak działa scalanie zmian (dla programistów)

- `web/src/collab/ops.ts` – zmiany to małe operacje na drzewie JSON; tablice obiektów z `id` (sceny, dni, ekipa…) są uporządkowanymi mapami,
  więc dwie osoby dodające różne rzeczy się nie nadpisują; pola skalarne: wygrywa ostatnia zatwierdzona zmiana (jak w arkuszu).
- `engine.ts` – serwer nadaje kolejność (`klaps_push_ops` → rosnący numer bez luk); klienci stosują te same operacje w tej samej
  kolejności, a własne niezatwierdzone zmiany nakładają na wynik. Dlatego stany są zawsze zbieżne (test losowy: 6 osób, rozłączenia, utrata potwierdzeń).
- Migawki (`klaps_put_snapshot`) skracają historię; nowa osoba pobiera migawkę + ogon.
- Cofanie: `Engine.doUndo` stosuje odwrotność własnej zmiany – cudze zmiany zostają.

## Testy

- `bash supabase/tests/run.sh` – schemat i reguły na prawdziwym Postgresie (role, zaproszenia, RLS, numeracja, migawki).
- `cd web && npm run test:cloud` – prawdziwe supabase-js + Realtime + szyfrowanie na sztucznym Supabase (`web/tests/cloud/fake-supabase.cjs`).
- `npm run e2e:cloud` (po `prepare-app` z `VITE_SUPABASE_URL=http://127.0.0.1:54399`) – dwie kopie programu w Electronie.
- Testy jednostkowe silnika (`collab.test.ts`, `session.test.ts`) działają w `npx vitest run`.

## Znane ograniczenia (kolejne kroki)

- Po usunięciu osoby z projektu zna ona jeszcze klucz *K* (widziała kod). Pełna ochrona wymaga rotacji klucza i ponownego
  zaszyfrowania projektu – jeszcze nie ma. Na razie: usunięta osoba traci dostęp do serwera, a wrażliwe projekty warto odtworzyć nowym kodem.
- Nowe urządzenie tej samej osoby wymaga ponownego wpisania kodu zaproszenia (klucz nie jest synchronizowany między urządzeniami).
- Obecność pokazuje zakładkę, w której pracuje dana osoba; nie ma jeszcze podświetlania edytowanego pola.
- Zdjęcia/mapki są częścią zaszyfrowanej migawki; bardzo duże pliki wydłużają pierwsze otwarcie (planowane: osobne zasoby `klaps_blobs`).
- Kanał obecności nie ma uprawnień per projekt (ujawnia najwyżej, że dany użytkownik jest online w projekcie o znanym UUID).
