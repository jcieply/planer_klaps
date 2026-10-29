import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve } from 'node:path';
import { klapsPack } from './tools/pack';

// tryb "artifact": jeden plik HTML (strona na claude.ai)
// tryb "e2e": to samo plus globalne obiekty dla testów (compat.ts)
// tryb "desktop": aplikacja na komputer (Electron) – dwa wejścia: index.html (program) i launcher.html (okno startowe),
//                 czcionki lokalne zamiast Google Fonts, wyjście do katalogu app/ (zmienna DESKTOP_OUT)
function localFonts(): Plugin {
  return {
    name: 'klaps-local-fonts',
    transformIndexHtml(html) {
      return html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '').replace('</head>', '<link rel="stylesheet" href="./fonts/fonts.css">\n</head>');
    },
  };
}
export default defineConfig(({ mode }) => {
  const single = mode === 'artifact' || mode === 'e2e';
  const desktop = mode === 'desktop';
  return {
    base: './',
    // wątek roboczy (raporty, analiza scenariusza, tabele) – osadzony jako blob, więc działa tak samo w programie i w buildzie jednoplikowym
    worker: { format: 'iife', plugins: () => [klapsPack()], rollupOptions: { output: { inlineDynamicImports: true } } },
    plugins: [react(), klapsPack(), ...(single ? [viteSingleFile({ removeViteModuleLoader: true })] : []), ...(desktop ? [localFonts()] : [])],
    build: {
      outDir: desktop ? (process.env.DESKTOP_OUT || 'dist-desktop') : mode === 'artifact' ? 'dist-artifact' : mode === 'e2e' ? 'dist-e2e' : 'dist',
      emptyOutDir: true,
      target: 'es2020', chunkSizeWarningLimit: 2500, assetsInlineLimit: 100000000, cssCodeSplit: desktop, modulePreload: false,
      ...(desktop ? { rollupOptions: { input: { index: resolve(__dirname, 'index.html'), launcher: resolve(__dirname, 'launcher.html') } } } : {}),
    },
    test: { environment: 'jsdom', include: process.env.KLAPS_CLOUD_TESTS ? ['tests/cloud/**/*.test.ts'] : ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'], setupFiles: ['tests/unit/setup.ts'] },
  };
});
