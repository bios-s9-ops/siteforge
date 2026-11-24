export interface StockImageResult {
  id: string;
  url: string;
  thumbUrl: string;
  title: string;
  author: string;
  license: string;
  source: 'Openverse' | 'Wikimedia';
}

export async function searchRoyaltyFreeImages(query: string, limit = 12): Promise<StockImageResult[]> {
  const cleanQuery = (query || 'architecture design').trim();
  const results: StockImageResult[] = [];

  // 1. Openverse API (gratuit, sans clé API, photos sous licence Creative Commons / Domaine public)
  try {
    const ovUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(cleanQuery)}&page_size=${limit}&license_type=commercial`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(ovUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SiteForge/2.0 (Educational Web Builder)' },
    });
    clearTimeout(timer);
    if (resp.ok) {
      const data = await resp.json();
      for (const item of data.results ?? []) {
        if (!item.url) continue;
        results.push({
          id: `ov_${item.id}`,
          url: item.url,
          thumbUrl: item.thumbnail || item.url,
          title: item.title || cleanQuery,
          author: item.creator || 'Auteur Openverse',
          license: (item.license || 'CC').toUpperCase(),
          source: 'Openverse',
        });
      }
    }
  } catch {
    // Fallback automatique vers Wikimedia Commons
  }

  // 2. Wikimedia Commons API (gratuit, sans clé API)
  if (results.length < limit) {
    try {
      const wmUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cleanQuery + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=960&format=json&origin=*`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(wmUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SiteForge/2.0 (Educational Web Builder)' },
      });
      clearTimeout(timer);
      if (resp.ok) {
        const data = await resp.json();
        const pages = Object.values(data?.query?.pages ?? {}) as Array<Record<string, unknown>>;
        for (const p of pages) {
          const info = Array.isArray(p.imageinfo) ? p.imageinfo[0] : null;
          if (!info?.url) continue;
          const meta = info.extmetadata ?? {};
          results.push({
            id: `wm_${p.pageid}`,
            url: info.thumburl || info.url,
            thumbUrl: info.thumburl || info.url,
            title: String(p.title || cleanQuery).replace(/^File:/, '').replace(/\.[^.]+$/, ''),
            author: String(meta.Artist?.value || 'Wikimedia Commons').replace(/<[^>]+>/g, '').slice(0, 60),
            license: String(meta.LicenseShortName?.value || 'CC / Public Domain'),
            source: 'Wikimedia',
          });
        }
      }
    } catch {
      // Ignorer si indisponible
    }
  }

  return results.slice(0, limit);
}
