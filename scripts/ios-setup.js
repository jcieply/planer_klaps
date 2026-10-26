/* Tworzy / aktualizuje projekt Xcode (ios/) z katalogu app/: Capacitor, uprawnienia w Info.plist, ikona. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const root = path.join(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
if (!fs.existsSync(path.join(root, 'app', 'native.js'))) { console.error('Najpierw: npm run prepare-ios'); process.exit(1); }
if (!fs.existsSync(path.join(root, 'ios'))) run('npx cap add ios');
run('npx cap sync ios');

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
