# Klaps Planer – aplikacja na komputer (macOS i Windows)

Planowanie zdjęć filmowych: rozpiska, kalendarzówka, plan pracy, shotlista, ekipa, obsada, lokacje, raport dzienny,
pogoda, historia wersji. Działa w pełni offline. Wersja mobilna (iPhone/iPad) jest na razie wstrzymana –
ostatni jej stan zachowuje tag `ios-final`.

## Jak działa start
Po uruchomieniu pojawia się małe **okno startowe**: powitanie „Cześć, Imię Nazwisko”, lista projektów i „Nowy projekt”.
Imię i nazwisko podajesz raz, przy pierwszym uruchomieniu. Szczegóły i miejsce na logowanie oraz chmurę: [docs/LAUNCHER.md](docs/LAUNCHER.md).

Projekty zapisują się jako zwykłe pliki w `Dokumenty/Klaps Planer/Projekty/` (`.klaps.json` + automatyczna kopia `.bak`).
Zapis jest atomowy (plik tymczasowy → podmiana), a przy zamykaniu okna program najpierw dokańcza zapis.
Kopię projektu do wysłania komuś zapiszesz w zakładce Eksport jako plik `.klaps`.

## Jak zdobyć instalator (bez instalowania czegokolwiek na komputerze) – GitHub Actions
1. Zakładka **Actions** → „Build macOS” (plik `.dmg`) albo „Build Windows” (instalator `.exe`) → **Run workflow**.
2. Po kilku minutach pobierz artefakt z wyniku uruchomienia.

## Albo zbuduj sam
Wymagany Node.js 20+ (nodejs.org):
```
npm install
npm run start        # uruchomienie bez budowania instalatora
npm run dist:mac     # .dmg w folderze dist/
npm run dist:win     # .exe w folderze dist/
```

## Pierwsze uruchomienie (aplikacja nie jest podpisana)
* **macOS:** otwórz `.dmg`, przeciągnij aplikację do Programów, przy pierwszym starcie kliknij ją **prawym przyciskiem → Otwórz → Otwórz**.
  Jeśli system nadal blokuje: Ustawienia systemowe → Prywatność i ochrona → „Otwórz mimo to”.
* **Windows:** SmartScreen może ostrzec o nieznanym wydawcy – „Więcej informacji” → „Uruchom mimo to”.
Podpisanie (bez ostrzeżeń) wymaga płatnych certyfikatów (Apple Developer, certyfikat podpisu kodu dla Windows).

## Przeniesienie danych ze starszej wersji
Projekty zapisane wcześniej w `Dokumenty/Klaps Planer/Projekty/` są widoczne w oknie startowym bez żadnych kroków.
Kopię z wersji webowej wczytasz przez Plik → „Wczytaj projekt z kopii…” (pliki `.klaps` i starsze `.json`).

## Struktura
* `web/` – program (React + TypeScript + Vite) razem z oknem startowym; `web/README`-owe szczegóły: `web/package.json`,
* `electron/` – okna, menu, zapis plików, profil użytkownika,
* `scripts/prepare.js` – składa `app/` (program + pdf.js + czcionki lokalnie),
* `test/` – testy zapisu i profilu (Node) oraz test całej aplikacji w Electronie (`npm run e2e`, na Linuksie przez `xvfb-run -a`),
* `.github/workflows/` – testy (`ci.yml`) i budowanie instalatorów.

## Chmura i praca zespołowa

Konto w programie, projekty w chmurze szyfrowane end-to-end, kody zaproszeń, role i praca na żywo: opis i konfiguracja Supabase w [docs/CHMURA.md](docs/CHMURA.md).
