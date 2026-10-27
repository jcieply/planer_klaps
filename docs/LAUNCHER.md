# Okno startowe (launcher) i miejsce na logowanie i chmurę

## Jak to działa dziś
1. Program startuje **małym oknem startowym** (880×540, bez ramki, na środku ekranu).
2. Przy pierwszym uruchomieniu pyta o imię i nazwisko (oraz stanowisko, język i motyw). Dane trafiają do
   `profile.json` w folderze danych programu (`app.getPath('userData')`) – z kopią `profile.bak`.
3. Potem pokazuje „Cześć, Imię Nazwisko”, listę projektów (z folderu `Dokumenty/Klaps Planer/Projekty`) i przycisk „Nowy projekt”.
4. Po wyborze projektu proces główny otwiera **ukryte okno programu**. Gdy program narysuje projekt, wysyła sygnał
   `ready` – dopiero wtedy okno programu płynnie się pojawia, a okno startowe znika.
5. Zamknięcie okna programu (i wyjście z programu) **najpierw zapisuje projekt** (`app:flush`), potem zamyka okno.
   „Plik → Okno startowe” (Ctrl/Cmd+Shift+L) wraca do wyboru projektu.

## Podział na pliki
| Plik | Rola |
|---|---|
| `electron/main.js` | okna, przejście, zapis przy zamykaniu, IPC (każde wywołanie sprawdza, że pochodzi z `klaps://app/`) |
| `electron/preload.js` | most `window.klapsDesktop` (jedyne miejsce, przez które strona rozmawia z komputerem) |
| `electron/profile.js` | profil użytkownika (czysty Node, testowany w `test/profile.test.js`) |
| `electron/intent.js` | sprawdzanie, co okno startowe chce uruchomić („otwórz projekt X” / „utwórz projekt”) |
| `electron/store.js`, `atomic.js` | zapis projektów: plik tymczasowy → `fsync` → podmiana, kopia `.bak`, odzyskiwanie po uszkodzeniu |
| `web/src/launcher/` | wygląd okna startowego (React) i **usługi** (`services.ts`) |
| `web/src/desktop/` | typy mostu (`bridge.ts`) i podłączenie okna programu (`install.ts`) |

## Dopisanie logowania (konto użytkownika)
Okno startowe nie wie, skąd bierze się konto – pyta zarejestrowanych dostawców tożsamości (`IdentityProvider`
w `web/src/launcher/services.ts`):

```ts
registerIdentity({
  id: 'cloud',
  label: () => 'Konto Klaps',
  capabilities: { signIn: true, signOut: true, editProfile: false },
  current: async () => /* zalogowany użytkownik albo null */,
  signIn: async () => /* otwiera przeglądarkę / okno logowania, zwraca konto */,
  signOut: async () => {},
});
```
Wystarczy wywołać to w `web/src/launcher/main.tsx` obok `installDefaultServices()`. Gdy dostawca ma `signIn: true`,
pod powitaniem pojawia się przycisk logowania; po zalogowaniu `resolveAccount()` zwraca jego konto zamiast lokalnego.
Tokeny przechowuj w procesie głównym (np. `safeStorage` Electrona), nie w `localStorage`.

## Dopisanie chmury i pracy równoczesnej
Lista projektów pochodzi ze **źródeł** (`ProjectSource`). Dziś jest jedno: `local`. Chmura to drugie źródło:

```ts
registerSource({
  id: 'cloud',
  label: () => 'Chmura',
  capabilities: { create: true, collaborate: true, offline: false },
  visible: (account) => !!account && account.provider === 'cloud',   // zakładka pojawia się dopiero po zalogowaniu
  list: async (account) => /* [{ id, title, updatedAt, source: 'cloud', shared: { owner, members, online } }] */,
});
```
* Przy więcej niż jednym widocznym źródle okno startowe samo pokaże zakładki (np. „Ten komputer | Chmura”),
  a przy projektach ze `shared` – liczbę osób online.
* Wybór projektu przechodzi przez `LaunchIntent { type, source, id }` → `electron/intent.js` (tu dopisz `'cloud'` do `SOURCES`)
  → okno programu dostaje `?source=cloud&open=ID` i `window.klapsDesktop.session()` (konto + tryb `local`/`cloud`).
* Po stronie programu zapis idzie przez interfejs `Backend` w `web/src/domain/store.ts` (`list/save/load/remove`) –
  to jest miejsce na zapis do chmury. Praca równoczesna wymaga jeszcze scalania zmian na poziomie pól
  (dziś synchronizacja ostatni-zapis-wygrywa, `web/src/domain/sync.js`).
* Zawsze zostaje tryb offline: projekty lokalne działają bez konta i bez internetu.


## Chmura (od 2.3)

Dostawcy `cloud` (tożsamość i źródło projektów) rejestrują się w `web/src/launcher/cloudServices.ts`, gdy program ma wbudowany adres chmury. Opis, konfiguracja Supabase i testy: [CHMURA.md](CHMURA.md).
