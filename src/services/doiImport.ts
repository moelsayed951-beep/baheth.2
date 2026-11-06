// استخراج بيانات المرجع من DOI عبر Crossref (يدعم CORS) وتحويلها إلى Paper جاهز للمكتبة والتوثيق.
import type { Paper } from '@/types';
import { CONTACT_EMAIL } from '@/utils/config';
import { fetchJson } from '@/utils/http';
import { mapCrossrefItem, type CRItem } from './sources/crossref';

const DOI_RE = /10\.\d{4,9}\/[^\s"<>]+/gi;

// يستخرج كل DOIs من نص (روابط doi.org أو DOI مجرد)، بدون تكرار، مع تنظيف علامات الترقيم الختامية
export function parseDois(text: string, max = 30): string[] {
  const found = (text.match(DOI_RE) ?? []).map((d) => d.replace(/[.,;:)\]}>'"]+$/, '').toLowerCase());
  return [...new Set(found)].slice(0, max);
}

export async function fetchPaperByDoi(doi: string, signal?: AbortSignal): Promise<Paper> {
  const url = new URL(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (CONTACT_EMAIL) url.searchParams.set('mailto', CONTACT_EMAIL);
  const data = await fetchJson<{ message?: CRItem }>(url.toString(), signal);
  if (!data.message?.DOI) throw new Error('لم يُعثر على بيانات لهذا الـDOI');
  return mapCrossrefItem(data.message, 'all');
}

export interface ImportResult { papers: Paper[]; failed: string[] }

export async function importDois(dois: string[], signal?: AbortSignal): Promise<ImportResult> {
  const papers: Paper[] = [];
  const failed: string[] = [];
  const queue = [...dois];
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      try { papers.push(await fetchPaperByDoi(d, signal)); } catch { failed.push(d); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { papers, failed };
}
