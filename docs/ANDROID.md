# Klaps Planer na Androida (Capacitor) – od wersji 2.7.0

Aplikacja na Androida to ten sam program (React) w natywnym oknie WebView, zbudowany z Capacitorem 8.
Okno startowe, licencja, projekty, wszystkie zakładki, eksporty i chmura działają tym samym kodem co na komputerze.

## Jak zdobyć instalator (APK)
GitHub → **Actions** → „Build Android” → **Run workflow** (buduje się też sam po każdym wypchnięciu na `main`).
Po kilku minutach pobierz artefakt `Klaps-Planer-Android` – plik `Klaps-Planer-<wersja>-android.apk`.
Na telefonie: otwórz plik, zezwól na „instalowanie nieznanych aplikacji” dla przeglądarki / menedżera plików.

To wersja **debug** (do testów, poza Sklepem Play). Do Sklepu Play potrzebny jest klucz podpisu (keystore) i build
`assembleRelease`/`bundleRelease` – do dodania, gdy zapadnie decyzja o publikacji.

## Jak to jest zbudowane
| Element | Plik | Na telefonie |
|---|---|---|
| Most `window.klapsDesktop` | `web/src/android/bridge.ts` | ten sam interfejs co `electron/preload.js` |
| Projekty | Filesystem → `Directory.Data/Projekty` | `<id>.klaps.json` + `.bak` + `.meta.json`, zapis przez plik tymczasowy |
| Eksport PDF/XLSX/.klaps | Filesystem (cache) + Share | systemowe „Udostępnij” (Dysk Google, poczta, komunikatory) |
| Profil, licencja, klucze chmury | Preferences | prywatne ustawienia aplikacji |
| Zapis przy wyjściu | App `pause` | przełączenie aplikacji / wygaszenie ekranu zapisuje projekt |
| Przycisk „Wstecz” | App `backButton` | zamyka okno → wraca do okna startowego → zamyka aplikację |
| Start | `index.html` bez wybranego projektu lub bez licencji przekierowuje do `launcher.html` | |

Build: `npm run prepare-android` (w katalogu głównym) = Vite w trybie `android` do `web/dist-android/` (z pdf.js i czcionkami
lokalnie) + `npx cap sync android`. Natywny projekt jest w `web/android/` (ikony i ekran startowy z `build/icon.png`).
Lokalnie APK: Android Studio albo `cd web/android && ./gradlew assembleDebug` (JDK 21, Android SDK 36).

## Licencja
Pierwsze uruchomienie (komputer i telefon) prosi o klucz licencyjny – patrz README, sekcja „Licencja”.

## Ograniczenia
- Klucze projektów chmurowych są w prywatnych ustawieniach aplikacji, a nie w sprzętowym magazynie kluczy Androida
  (na komputerze: Keychain / DPAPI). Do rozważenia: wtyczka z EncryptedSharedPreferences / Android Keystore.
- Wersja debug nie jest podpisana kluczem wydawcy; aktualizacja wymaga ponownej instalacji z APK.
- Tablet i telefon korzystają z tego samego układu co wąskie okno programu (dolny pasek zakładek).
