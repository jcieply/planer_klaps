# Klaps Planer – aplikacja na macOS i iOS

Aplikacja działa w pełni offline. Projekty zapisują się jako zwykłe pliki w
`Dokumenty/Klaps Planer/Projekty/` (jeden plik `.klaps.json` na projekt, z automatyczną kopią `.bak`).
Eksporty PDF/XLSX zapisują się przez standardowe okno „Zapisz jako…”.

## Co nowego (wersja 1.1)
- Dni specjalne w kalendarzówce: przerzut, prelight, budowa dekoracji (poza numeracją dni zdjęciowych).
- Plan pracy: czas realizacji i przestawki, godziny liczone automatycznie, ostrzeżenia 12 h pracy i 11 h odpoczynku, mapki JPG/PNG w PDF, harmonogram z kalendarzówki albo z shotlisty.
- Wersja językowa PL/EN (interfejs i dokumenty), motyw jasny/ciemny.
- Ekipa: e-mail, diety, dni pracy, raport cateringowy. Obsada: pełne dane aktorów jak w ekipie.
- Lokacje: rzeczywista nazwa, adres, właściciel i kontakt, zasilanie, toaleta, camp, status umowy, uwagi.

## Jak zdobyć plik .dmg (bez instalowania czegokolwiek na Macu) – GitHub Actions
1. Załóż darmowe konto na github.com i nowe **prywatne** repozytorium (np. `klaps-planer`).
2. Wgraj do niego zawartość tego folderu (Add file → Upload files; folder `.github` też musi trafić do repo –
   jeśli przeglądarka go pomija, utwórz plik `.github/workflows/build-mac.yml` ręcznie i wklej jego treść).
3. Zakładka **Actions** → „Build macOS” → **Run workflow**. Po ok. 5–8 minut pobierz z wyniku
   artefakt `Klaps-Planer-macOS` (zawiera `.dmg`).

## Albo zbuduj sam na Macu
Wymagany Node.js 20+ (nodejs.org): `npm install`, potem `npm run dist` → `.dmg` w folderze `dist/`.
Do samego uruchomienia bez budowania paczki: `npm start`.

## Pierwsze uruchomienie (aplikacja nie jest podpisana kontem Apple Developer)
Otwórz `.dmg`, przeciągnij aplikację do Programów. Przy pierwszym starcie kliknij ją **prawym przyciskiem → Otwórz → Otwórz**.
Jeśli macOS nadal blokuje: Ustawienia systemowe → Prywatność i ochrona → na dole „Otwórz mimo to”.
Podpisanie i notaryzacja (usunięcie tych ostrzeżeń) wymagają płatnego konta Apple Developer (99 USD/rok).

## Przeniesienie danych z wersji webowej
W wersji webowej: zakładka Eksport → „Zapisz projekt (.json)”. W aplikacji: Plik → „Wczytaj projekt z kopii (.json)…”.

## Struktura
- `web/` – kod aplikacji (ten sam co wersja webowa), `electron/` – okno, menu, zapis plików,
- `scripts/prepare.js` – składa `app/` (aplikacja + pdf.js + czcionki lokalnie).

## iPhone / iPad (aplikacja natywna, Capacitor)
Potrzebne: Mac z Xcode (darmowy, App Store), Apple ID, Node.js 20+ (nodejs.org) i kabel do iPhone'a.
1. Pobierz repozytorium na Maca: GitHub Desktop → File → Clone repository → `jcieply/planer_klaps`.
2. W Terminalu w folderze repozytorium: `npm install`, potem `npm run ios` (przygotuje projekt i otworzy Xcode).
3. W Xcode kliknij **App** w lewym panelu → zakładka **Signing & Capabilities** → **Team** → *Add an Account…* (Twoje Apple ID) → wybierz *Personal Team*.
   Jeśli Xcode zgłosi zajęty identyfikator, zmień *Bundle Identifier* na np. `pl.klaps.planer.twojenazwisko`.
4. Podłącz iPhone'a, wybierz go na górnym pasku Xcode i kliknij ▶ (Run).
   Na iPhonie (pierwszy raz): Ustawienia → Prywatność i ochrona → **Tryb dewelopera** → włącz; potem Ustawienia → Ogólne → **VPN i urządzenia** → zaufaj swojemu Apple ID.
5. Bez płatnego konta Apple Developer aplikacja działa 7 dni – potem podłącz telefon i kliknij ▶ jeszcze raz (projekty zostają).
   Z kontem (99 USD/rok) można instalować przez TestFlight bez kabla i bez limitu 7 dni.

Aktualizacja: w GitHub Desktop *Fetch / Pull*, potem `npm run ios-sync` i ▶ w Xcode.
Projekty na iPhonie są plikami: aplikacja **Pliki** → *Na moim iPhonie* → **Klaps** → *Projekty*.
Eksport PDF / Excel / .json otwiera systemowe **Udostępnij** (Zachowaj w Plikach, AirDrop, Mail…).

GitHub Actions przy każdej zmianie kompiluje wersję iOS, uruchamia ją na symulatorze iPhone'a i sprawdza zapis projektu
(zrzut ekranu w artefakcie *Klaps-iOS-Simulator*).

## Synchronizacja Mac ↔ iPhone (Supabase)
Projekty synchronizują się automatycznie przez Twoją własną bazę Supabase (darmowy plan wystarcza).
Konfiguracja jest w aplikacji: **Ustawienia → Synchronizacja → „Jak przygotować bazę”** (skrypt SQL do skopiowania).
1. Konto na supabase.com → nowy projekt.
2. SQL Editor → wklej skrypt z aplikacji → Run.
3. Authentication → Sign In / Providers → Email → wyłącz *Confirm email*.
4. Project Settings → API: skopiuj *Project URL* i klucz *anon / publishable*.
5. W aplikacji na Macu: wpisz adres, klucz, e-mail i hasło → **Załóż konto**. Na iPhonie te same dane → **Zaloguj i synchronizuj**.

Konflikt (ten sam projekt zmieniony na dwóch urządzeniach bez połączenia): obie wersje zostają –
wersja z drugiego urządzenia zapisuje się jako osobny projekt z dopiskiem „konflikt”.
