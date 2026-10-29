/* Ciężkie zadania (raporty PDF/XLSX, analiza scenariusza, odczyt tabel shotlisty). Ten sam kod działa w wątku roboczym
   (heavy.worker.ts) i – awaryjnie – w oknie programu, gdy wątku nie da się uruchomić. */
import { I18N } from '../domain/i18n';
import { ensureEn } from '../domain/enpack';
import { Reports } from '../domain/reports';
import { Parser } from '../domain/parser';
import { Table } from '../domain/table';

export type Task = 'ping' | 'pdf' | 'xlsx' | 'parse' | 'table';
export interface ParseRaw { kind: 'pdf' | 'fdx' | 'docx' | 'text'; pages?: unknown; text?: string; xml?: string }

export function parseScript(raw: ParseRaw, o: Record<string, unknown>) {
  if (raw.kind === 'pdf') return Parser.fromPdfPages(raw.pages, o);
  if (raw.kind === 'fdx') return Parser.fromFdx(raw.text, o);
  if (raw.kind === 'docx') return Parser.fromDocxXml(raw.xml, o);
  return Parser.fromText(raw.text, o);
}

/** wykonuje zadanie w języku interfejsu okna, które je zleciło */
export async function runTask(task: Task, args: any, lang: 'pl' | 'en'): Promise<unknown> {
  if (task === 'ping') return 'pong';
  if (lang === 'en' || (args && args.st && args.st.meta && args.st.meta.docLang === 'en')) await ensureEn();
  const prev = I18N.lang;
  I18N.lang = lang;
  try {
    switch (task) {
      case 'pdf': return await Reports.buildPdf(args.st, args.sections, args.opts);
      case 'xlsx': return await Reports.buildXlsx(args.st, args.sections, args.opts);
      case 'parse': return parseScript(args.raw, args.o);
      case 'table': {
        if (args.worker && Table.isLegacyXls(args.name, args.bytes)) { const e = new Error('main-thread') as Error & { code?: string }; e.code = 'main'; throw e; }
        return await Table.readBytes(args.name, args.bytes);
      }
      default: throw new Error('Nieznane zadanie: ' + String(task));
    }
  } finally { I18N.lang = prev; }
}
