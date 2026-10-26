# Klaps Planer – aplikacja na macOS

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
