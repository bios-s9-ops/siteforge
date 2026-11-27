/**
 * Recherche d'images libres de droits, sans clé API :
 * - Openverse (https://api.openverse.org/v1/images/)
 * - Wikimedia Commons (https://commons.wikimedia.org/w/api.php)
 * Chaque résultat garde son auteur, sa licence et sa page d'origine pour pouvoir créditer la photo.
 */

import type { StockImageResult } from '../src/utils/credits';
export { formatImageCredit } from '../src/utils/credits';
export type { StockImageResult };

export interface StockSearchOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 8000;
const USER_AGENT = 'SiteForge/1.0 (créateur de sites ; recherche d’images libres de droits)';

const stripHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Refuse les licences qui interdisent l'usage commercial ou la modification (NC, ND). */
export function isUsableLicense(license: string): boolean {
  const l = license.toLowerCase();
  if (!l) return false;
  if (/\bnc\b|non[- ]?commercial|\bnd\b|no[- ]?derivatives|noncommercial/.test(l)) return false;
  return /cc0|public domain|domaine public|pdm|cc[- ]by|attribution|\bpd\b|gfdl|free art/.test(l);
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

async function fetchJson(url: string, fetchFn: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface OpenverseItem {
  id?: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  foreign_landing_url?: string;
}

export function normalizeOpenverse(data: unknown): StockImageResult[] {
  const results = (data as { results?: OpenverseItem[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: StockImageResult[] = [];
  for (const item of results) {
    const url = isHttpUrl(item.url) ? item.url : isHttpUrl(item.thumbnail) ? item.thumbnail : null;
    if (!url || !item.id) continue;
    const thumbUrl = isHttpUrl(item.thumbnail) ? item.thumbnail : url;
    const code = (item.license ?? '').toLowerCase();
    const license =
      code === 'cc0'
        ? 'CC0'
        : code === 'pdm'
          ? 'Domaine public'
          : code
            ? `CC ${code.toUpperCase()}${item.license_version ? ` ${item.license_version}` : ''}`
            : '';
    if (!isUsableLicense(license)) continue;
    out.push({
      id: `openverse:${item.id}`,
      url,
      thumbUrl,
      title: stripHtml(item.title) || 'Sans titre',
      author: stripHtml(item.creator) || 'Auteur inconnu',
      license,
      source: 'openverse',
      pageUrl: isHttpUrl(item.foreign_landing_url) ? item.foreign_landing_url : undefined,
    });
  }
  return out;
}

interface WikimediaPage {
  pageid?: number;
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

export function normalizeWikimedia(data: unknown): StockImageResult[] {
  const pages = (data as { query?: { pages?: Record<string, WikimediaPage> } } | null)?.query?.pages;
  if (!pages) return [];
  const out: StockImageResult[] = [];
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const url = isHttpUrl(info.url) ? info.url : isHttpUrl(info.thumburl) ? info.thumburl : null;
    if (!url) continue;
    if (!/^image\/(jpeg|png|webp)$/i.test(info.mime ?? '')) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value) || stripHtml(meta.UsageTerms?.value);
    if (!isUsableLicense(license)) continue;
    const title = stripHtml(page.title).replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, '');
    out.push({
      id: `wikimedia:${page.pageid ?? title}`,
      url: isHttpUrl(info.thumburl) ? info.thumburl : url,
      thumbUrl: isHttpUrl(info.thumburl) ? info.thumburl : url,
      title: title || 'Sans titre',
      author: stripHtml(meta.Artist?.value) || 'Auteur inconnu',
      license,
      source: 'wikimedia',
      pageUrl: isHttpUrl(info.descriptionurl) ? info.descriptionurl : undefined,
    });
  }
  return out;
}

async function searchOpenverse(query: string, limit: number, fetchFn: typeof fetch, timeoutMs: number) {
  const params = new URLSearchParams({
    q: query,
    page_size: String(Math.min(Math.max(limit * 2, 6), 30)),
    license_type: 'commercial,modification',
    mature: 'false',
    category: 'photograph',
  });
  return normalizeOpenverse(await fetchJson(`https://api.openverse.org/v1/images/?${params}`, fetchFn, timeoutMs));
}

async function searchWikimedia(query: string, limit: number, fetchFn: typeof fetch, timeoutMs: number) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: String(Math.min(Math.max(limit * 2, 6), 30)),
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '1400',
    format: 'json',
    origin: '*',
  });
  return normalizeWikimedia(await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`, fetchFn, timeoutMs));
}

/**
 * Cherche dans les deux sources en parallèle et mélange les résultats.
 * Si une source tombe, l'autre répond. Si les deux tombent, une erreur claire est levée.
 */
export async function searchRoyaltyFreeImages(
  query: string,
  limit = 12,
  options: StockSearchOptions = {},
): Promise<StockImageResult[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const max = Math.min(Math.max(Math.floor(limit) || 12, 1), 30);

  const [openverse, wikimedia] = await Promise.allSettled([
    searchOpenverse(q, max, fetchFn, timeoutMs),
    searchWikimedia(q, max, fetchFn, timeoutMs),
  ]);

  if (openverse.status === 'rejected' && wikimedia.status === 'rejected') {
    const err = new Error('Les banques d’images libres de droits sont injoignables pour le moment.');
    (err as Error & { status?: number; code?: string }).status = 503;
    (err as Error & { status?: number; code?: string }).code = 'STOCK_UNAVAILABLE';
    throw err;
  }

  const a = openverse.status === 'fulfilled' ? openverse.value : [];
  const b = wikimedia.status === 'fulfilled' ? wikimedia.value : [];
  const merged: StockImageResult[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    for (const item of [a[i], b[i]]) {
      if (item && !seen.has(item.url)) {
        seen.add(item.url);
        merged.push(item);
      }
    }
  }
  return merged.slice(0, max);
}
