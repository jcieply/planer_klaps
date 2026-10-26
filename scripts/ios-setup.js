/* Tworzy / aktualizuje projekt Xcode (ios/) z katalogu app/: Capacitor, uprawnienia w Info.plist, ikona. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
if (!fs.existsSync(path.join(root, 'app', 'native.js'))) { console.error('Najpierw: npm run prepare-ios'); process.exit(1); }
const iosDir = path.join(root, 'ios');
// niedokończony folder ios/ (np. po przerwanym cap add) – zaczynamy od nowa
if (fs.existsSync(iosDir) && !fs.existsSync(path.join(iosDir, 'App', 'App.xcodeproj'))) fs.rmSync(iosDir, { recursive: true, force: true });
// Swift Package Manager – nie wymaga instalowania CocoaPods
// Nie używamy `cap add` – w Capacitor 7 zawsze sprawdza CocoaPods (błąd w CLI), nawet z --packagemanager SPM.
// Rozpakowujemy szablon SPM sam; potem `cap sync` widzi ios/App/CapApp-SPM i działa bez CocoaPods.
if (!fs.existsSync(iosDir)) {
  const tpl = path.join(root, 'node_modules', '@capacitor', 'cli', 'assets', 'ios-spm-template.tar.gz');
  if (!fs.existsSync(tpl)) { console.error('Brak szablonu iOS – uruchom najpierw: npm install'); process.exit(1); }
  fs.mkdirSync(iosDir, { recursive: true });
  run(`tar -xzf "${tpl}" -C "${iosDir}"`);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
  const pbx = path.join(iosDir, 'App', 'App.xcodeproj', 'project.pbxproj');
  fs.writeFileSync(pbx, fs.readFileSync(pbx, 'utf8').replace(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+)/g, `PRODUCT_BUNDLE_IDENTIFIER = ${cfg.appId}`));
  console.log('Projekt Xcode utworzony (Swift Package Manager)');
}
run('npx cap sync ios');

// Xcode 26+ wspiera iOS od 15.0 – podnosimy minimalną wersję (usuwa ostrzeżenie o 14.0)
const pbxFile = path.join(root, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
fs.writeFileSync(pbxFile, fs.readFileSync(pbxFile, 'utf8').replace(/IPHONEOS_DEPLOYMENT_TARGET = 1[0-4]\.\d+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 15.0;'));
const spm = path.join(root, 'ios', 'App', 'CapApp-SPM', 'Package.swift');
if (fs.existsSync(spm)) fs.writeFileSync(spm, fs.readFileSync(spm, 'utf8').replace(/\.iOS\(\.v1[0-4]\)/g, '.iOS(.v15)'));

// Info.plist: zdjęcia map (wybór z galerii / aparat), pliki widoczne w aplikacji Pliki, nazwa na ekranie
const plist = path.join(root, 'ios', 'App', 'App', 'Info.plist');
let s = fs.readFileSync(plist, 'utf8');
const keys = [
  ['CFBundleDisplayName', '<string>Klaps</string>'],
  ['NSPhotoLibraryUsageDescription', '<string>Klaps dodaje zdjęcia map lokacji i dojazdu do planu pracy.</string>'],
  ['NSCameraUsageDescription', '<string>Klaps może zrobić zdjęcie mapy lub planu lokacji do planu pracy.</string>'],
  ['UIFileSharingEnabled', '<true/>'],
  ['LSSupportsOpeningDocumentsInPlace', '<true/>'],
  ['ITSAppUsesNonExemptEncryption', '<false/>'],
];
for (const [k, v] of keys) {
  const re = new RegExp(`<key>${k}</key>\\s*<[^>]+>(?:[^<]*</string>)?`);
  if (re.test(s)) s = s.replace(re, `<key>${k}</key>\n\t${v}`);
  else s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${k}</key>\n\t${v}\n</dict>\n</plist>\n`);
}
fs.writeFileSync(plist, s);

// ikona aplikacji (1024×1024, bez przezroczystości)
const icons = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
if (fs.existsSync(icons)) {
  const target = fs.readdirSync(icons).find((f) => f.endsWith('.png')) || 'AppIcon-512@2x.png';
  fs.copyFileSync(path.join(root, 'build', 'icon-ios.png'), path.join(icons, target));
}
console.log('Projekt iOS gotowy: ios/App');
if (process.argv.includes('--open')) run('npx cap open ios');
