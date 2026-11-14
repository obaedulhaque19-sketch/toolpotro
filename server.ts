import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FirebasePublicConfig {
  apiKey: string;
  projectId: string;
  databaseId: string;
}

function getFirebasePublicConfig(): FirebasePublicConfig {
  let fileCfg: { apiKey?: string; projectId?: string; firestoreDatabaseId?: string } = {};
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      fileCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch {
    // Ignore fallback read errors
  }
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY || fileCfg.apiKey || '',
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || fileCfg.projectId || '',
    databaseId:
      process.env.VITE_FIREBASE_DATABASE_ID || fileCfg.firestoreDatabaseId || '(default)',
  };
}

function getFirebaseApiKey(): string {
  return getFirebasePublicConfig().apiKey;
}

interface PublicSoftwareMeta {
  id: string;
  name: string;
  version: string;
  platform: string;
  category: string;
  fileType: string;
  fileSize: string;
  tagline: string;
  description: string;
  thumbnailUrl: string;
  price: number;
  downloadsCount: number;
}

const softwareMetaCache = new Map<string, { expiresAt: number; data: PublicSoftwareMeta | null }>();

async function fetchPublicSoftwareMeta(softwareId: string): Promise<PublicSoftwareMeta | null> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(softwareId)) {
    return null;
  }

  const now = Date.now();
  const cached = softwareMetaCache.get(softwareId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const cfg = getFirebasePublicConfig();
  if (!cfg.apiKey || !cfg.projectId) {
    return null;
  }

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/${encodeURIComponent(cfg.databaseId)}/documents/software/${encodeURIComponent(
      softwareId
    )}?key=${encodeURIComponent(cfg.apiKey)}`;

    const resp = await fetch(endpoint, { signal: AbortSignal.timeout(2500) });
    if (!resp.ok) {
      softwareMetaCache.set(softwareId, { expiresAt: now + 30_000, data: null });
      return null;
    }

    const docJson = (await resp.json()) as {
      fields?: Record<
        string,
        { stringValue?: string; integerValue?: string; doubleValue?: number }
      >;
    };
    const fields = docJson.fields;
    if (!fields || fields.status?.stringValue !== 'active') {
      softwareMetaCache.set(softwareId, { expiresAt: now + 30_000, data: null });
      return null;
    }

    const item: PublicSoftwareMeta = {
      id: softwareId,
      name: fields.name?.stringValue || 'Toolpotro Software',
      version: fields.version?.stringValue || 'v1.0',
      platform: fields.platform?.stringValue || 'Cross-Platform',
      category: fields.category?.stringValue || 'utility',
      fileType: fields.fileType?.stringValue || '',
      fileSize: fields.fileSize?.stringValue || '',
      tagline: fields.tagline?.stringValue || '',
      description: fields.description?.stringValue || '',
      thumbnailUrl: fields.thumbnailUrl?.stringValue || '',
      price: Number(fields.price?.doubleValue ?? fields.price?.integerValue ?? 0),
      downloadsCount: Number(
        fields.downloadsCount?.integerValue ?? fields.downloadsCount?.doubleValue ?? 0
      ),
    };

    if (softwareMetaCache.size > 100) {
      const oldestKey = softwareMetaCache.keys().next().value;
      if (oldestKey) softwareMetaCache.delete(oldestKey);
    }
    softwareMetaCache.set(softwareId, { expiresAt: now + 60_000, data: item });
    return item;
  } catch {
    return null;
  }
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value: string): string {
  return escapeHtmlAttr(value);
}

interface ActiveSeoListItem {
  id: string;
  name: string;
  version: string;
  platform: string;
  fileType: string;
  tagline: string;
  updatedAtIso: string;
}

let activeSoftwareCache: { expiresAt: number; items: ActiveSeoListItem[] } | null = null;
let contactSettingsCache: {
  expiresAt: number;
  data: { contactEmail: string; facebookUrl: string };
} | null = null;
let redirectsCache: { expiresAt: number; map: Record<string, string> } | null = null;

async function fetchAllActiveSoftwareForSeo(): Promise<ActiveSeoListItem[]> {
  const now = Date.now();
  if (activeSoftwareCache && activeSoftwareCache.expiresAt > now) {
    return activeSoftwareCache.items;
  }

  const cfg = getFirebasePublicConfig();
  if (!cfg.apiKey || !cfg.projectId) {
    return [];
  }

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/${encodeURIComponent(cfg.databaseId)}/documents:runQuery?key=${encodeURIComponent(
      cfg.apiKey
    )}`;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'software' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'active' },
            },
          },
          limit: 500,
        },
      }),
      signal: AbortSignal.timeout(3500),
    });

    if (!resp.ok) {
      return activeSoftwareCache?.items || [];
    }

    const rows = (await resp.json()) as Array<{
      document?: {
        name?: string;
        updateTime?: string;
        fields?: Record<string, { stringValue?: string }>;
      };
    }>;

    const list: ActiveSeoListItem[] = [];
    for (const row of rows) {
      const doc = row.document;
      if (!doc?.name || !doc.fields) continue;
      const id = doc.name.split('/').pop() || '';
      if (!id) continue;
      list.push({
        id,
        name: doc.fields.name?.stringValue || id,
        version: doc.fields.version?.stringValue || 'v1.0',
        platform: doc.fields.platform?.stringValue || 'Cross-Platform',
        fileType: doc.fields.fileType?.stringValue || '',
        tagline: doc.fields.tagline?.stringValue || '',
        updatedAtIso: doc.updateTime || new Date().toISOString(),
      });
    }

    activeSoftwareCache = { expiresAt: now + 60_000, items: list };
    return list;
  } catch {
    return activeSoftwareCache?.items || [];
  }
}

async function fetchContactSettings(): Promise<{ contactEmail: string; facebookUrl: string }> {
  const defaults = {
    contactEmail: 'obaedulhaque19@gmail.com',
    facebookUrl: 'https://www.facebook.com/toolpotro',
  };
  const now = Date.now();
  if (contactSettingsCache && contactSettingsCache.expiresAt > now) {
    return contactSettingsCache.data;
  }

  const cfg = getFirebasePublicConfig();
  if (!cfg.apiKey || !cfg.projectId) return defaults;

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/${encodeURIComponent(
      cfg.databaseId
    )}/documents/settings/contact?key=${encodeURIComponent(cfg.apiKey)}`;
    const resp = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) {
      contactSettingsCache = { expiresAt: now + 60_000, data: defaults };
      return defaults;
    }
    const json = (await resp.json()) as {
      fields?: {
        contactEmail?: { stringValue?: string };
        facebookUrl?: { stringValue?: string };
      };
    };
    const data = {
      contactEmail: json.fields?.contactEmail?.stringValue?.trim() || defaults.contactEmail,
      facebookUrl: json.fields?.facebookUrl?.stringValue?.trim() || defaults.facebookUrl,
    };
    contactSettingsCache = { expiresAt: now + 60_000, data };
    return data;
  } catch {
    return defaults;
  }
}

async function fetchSlugRedirects(): Promise<Record<string, string>> {
  const now = Date.now();
  if (redirectsCache && redirectsCache.expiresAt > now) {
    return redirectsCache.map;
  }

  const cfg = getFirebasePublicConfig();
  if (!cfg.apiKey || !cfg.projectId) return {};

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/${encodeURIComponent(
      cfg.databaseId
    )}/documents/settings/redirects?key=${encodeURIComponent(cfg.apiKey)}`;
    const resp = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) {
      redirectsCache = { expiresAt: now + 60_000, map: {} };
      return {};
    }
    const json = (await resp.json()) as {
      fields?: {
        redirects?: {
          mapValue?: { fields?: Record<string, { stringValue?: string }> };
        };
      };
    };
    const rawFields = json.fields?.redirects?.mapValue?.fields || {};
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawFields)) {
      if (typeof v?.stringValue === 'string' && v.stringValue.trim()) {
        map[k] = v.stringValue.trim();
      }
    }
    redirectsCache = { expiresAt: now + 60_000, map };
    return map;
  } catch {
    return {};
  }
}

function resolveRequestOrigin(req: express.Request): string {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
    .split(',')[0]
    .trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
    .split(',')[0]
    .trim();
  const envUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : '';
  return envUrl || (host ? `${forwardedProto}://${host}` : '');
}

function buildSeoDescription(item: PublicSoftwareMeta): string {
  const downloads = `${item.downloadsCount.toLocaleString('en-US')} downloads`;
  const priceLabel = item.price > 0 ? `$${item.price}` : 'Free';
  const specs = [item.platform, item.fileType, item.fileSize].filter(Boolean).join(' · ');
  const base = [item.tagline, specs, downloads, priceLabel].filter(Boolean).join(' • ');
  if (base.length <= 165) return base;
  const suffix = ` • ${downloads} • ${priceLabel}`;
  const maxTaglineLen = Math.max(40, 162 - suffix.length);
  return `${item.tagline.slice(0, maxTaglineLen).trim()}...${suffix}`;
}

function resolveFallbackOgImagePath(): string | null {
  const distImg = path.resolve(__dirname, 'dist', 'og-preview.png');
  if (fs.existsSync(distImg)) return distImg;
  const pubImg = path.resolve(__dirname, 'public', 'og-preview.png');
  if (fs.existsSync(pubImg)) return pubImg;
  return null;
}

async function verifyAdminToken(authHeader?: string): Promise<{ ok: boolean; error?: string }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, error: 'Missing Authorization Bearer token' };
  }
  const idToken = authHeader.slice(7).trim();
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    return { ok: false, error: 'Firebase API key not configured on server' };
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) {
      return { ok: false, error: 'Invalid or expired Firebase Auth token' };
    }
    const data = (await resp.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    const adminEmail = (process.env.VITE_ADMIN_EMAIL || 'obaedulhaque19@gmail.com').toLowerCase();
    if (!user || !user.emailVerified || user.email?.toLowerCase() !== adminEmail) {
      return { ok: false, error: 'Forbidden: Verified admin access required' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Token verification failed' };
  }
}

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN || '';
  const owner = process.env.GITHUB_REPO_OWNER || '';
  const repo = process.env.GITHUB_REPO_NAME || '';
  const tag = process.env.GITHUB_RELEASE_TAG || 'toolpotro-assets';
  return { token, owner, repo, tag, configured: Boolean(token && owner && repo) };
}

async function getOrCreateRelease(owner: string, repo: string, tag: string, token: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Toolpotro-Distribution-Server',
  };

  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    { headers }
  );

  if (getRes.ok) {
    return (await getRes.json()) as { id: number; upload_url: string; assets?: Array<{ id: number; browser_download_url: string }> };
  }

  if (getRes.status !== 404) {
    const errText = await getRes.text();
    throw new Error(`GitHub Release lookup failed (${getRes.status}): ${errText}`);
  }

  const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tag_name: tag,
      name: 'Toolpotro Distribution Assets',
      body: 'Automated software packages and preview images managed by Toolpotro.',
      draft: false,
      prerelease: false,
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create GitHub Release (${createRes.status}): ${errText}`);
  }

  return (await createRes.json()) as { id: number; upload_url: string; assets?: Array<{ id: number; browser_download_url: string }> };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  // Render Free Tier Keep-Alive & Health Check Endpoint
  app.get('/api/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'toolpotro',
      timestamp: new Date().toISOString(),
    });
  });

  // Check if GitHub Releases storage is configured on server
  app.get('/api/github/status', (_req, res) => {
    const cfg = getGitHubConfig();
    res.json({
      configured: cfg.configured,
      owner: cfg.owner ? cfg.owner : null,
      repo: cfg.repo ? cfg.repo : null,
    });
  });

  // Upload binary file directly to GitHub Releases (Admin Only)
  app.post(
    '/api/github/upload',
    express.raw({ type: 'application/octet-stream', limit: '500mb' }),
    async (req, res) => {
      const authCheck = await verifyAdminToken(req.headers.authorization);
      if (!authCheck.ok) {
        return res.status(403).json({ error: authCheck.error });
      }

      const cfg = getGitHubConfig();
      if (!cfg.configured) {
        return res.status(400).json({
          error:
            'GitHub Releases is not configured. Set GITHUB_TOKEN, GITHUB_REPO_OWNER, and GITHUB_REPO_NAME in your environment variables.',
        });
      }

      const rawName = String(req.headers['x-file-name'] || `asset_${Date.now()}.bin`);
      const safeName = `${Date.now()}_${rawName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const bodyBuffer = req.body as Buffer;

      if (!Buffer.isBuffer(bodyBuffer) || bodyBuffer.length === 0) {
        return res.status(400).json({ error: 'Empty file payload' });
      }

      try {
        const release = await getOrCreateRelease(cfg.owner, cfg.repo, cfg.tag, cfg.token);
        const uploadBase = release.upload_url.split('{')[0];
        const uploadUrl = `${uploadBase}?name=${encodeURIComponent(safeName)}`;

        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/octet-stream',
            'User-Agent': 'Toolpotro-Distribution-Server',
          },
          body: new Uint8Array(bodyBuffer),
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          return res.status(uploadRes.status).json({
            error: `GitHub asset upload failed: ${errText}`,
          });
        }

        const asset = (await uploadRes.json()) as {
          id: number;
          name: string;
          size: number;
          browser_download_url: string;
        };

        return res.status(200).json({
          downloadUrl: asset.browser_download_url,
          assetId: asset.id,
          fileName: asset.name,
          size: asset.size,
        });
      } catch (err) {
        return res.status(500).json({
          error: err instanceof Error ? err.message : 'GitHub upload failed',
        });
      }
    }
  );

  // Delete matching GitHub Release assets when software is deleted (Admin Only)
  app.delete('/api/github/asset', express.json(), async (req, res) => {
    const authCheck = await verifyAdminToken(req.headers.authorization);
    if (!authCheck.ok) {
      return res.status(403).json({ error: authCheck.error });
    }

    const cfg = getGitHubConfig();
    if (!cfg.configured) {
      return res.status(200).json({ skipped: true });
    }

    const urls = [req.body?.downloadUrl, req.body?.thumbnailUrl].filter(
      (u): u is string => typeof u === 'string' && u.includes('github.com/')
    );

    if (urls.length === 0) {
      return res.status(200).json({ deleted: 0 });
    }

    try {
      const release = await getOrCreateRelease(cfg.owner, cfg.repo, cfg.tag, cfg.token);
      const assets = release.assets || [];
      let deleted = 0;

      for (const asset of assets) {
        if (urls.includes(asset.browser_download_url)) {
          const delRes = await fetch(
            `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/assets/${asset.id}`,
            {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${cfg.token}`,
                Accept: 'application/vnd.github+json',
                'User-Agent': 'Toolpotro-Distribution-Server',
              },
            }
          );
          if (delRes.ok || delRes.status === 204) {
            deleted += 1;
          }
        }
      }

      return res.status(200).json({ deleted });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete GitHub asset',
      });
    }
  });

  // Social Link Preview Thumbnail Proxy for individual software pages (no 302 redirects for WhatsApp/Meta bots)
  app.get('/api/og-thumbnail/:id', async (req, res) => {
    const sendFallback = () => {
      const fallbackPath = resolveFallbackOgImagePath();
      if (fallbackPath) {
        return res.set('Cache-Control', 'public, max-age=3600').sendFile(fallbackPath);
      }
      return res.status(404).end();
    };

    try {
      const item = await fetchPublicSoftwareMeta(req.params.id);
      const thumbUrl = item?.thumbnailUrl?.trim();
      if (!thumbUrl) {
        return sendFallback();
      }

      if (thumbUrl.startsWith('/') && !thumbUrl.startsWith('//')) {
        const cleanRel = thumbUrl.replace(/^\/+/, '');
        const candidates = [
          path.resolve(__dirname, 'dist', cleanRel),
          path.resolve(__dirname, 'public', cleanRel),
        ];
        for (const candidate of candidates) {
          const distBase = path.resolve(__dirname, 'dist') + path.sep;
          const pubBase = path.resolve(__dirname, 'public') + path.sep;
          if (
            (candidate.startsWith(distBase) || candidate.startsWith(pubBase)) &&
            fs.existsSync(candidate) &&
            fs.statSync(candidate).isFile()
          ) {
            return res.set('Cache-Control', 'public, max-age=3600').sendFile(candidate);
          }
        }
        return sendFallback();
      }

      if (/^https?:\/\//i.test(thumbUrl)) {
        const imgRes = await fetch(thumbUrl, {
          redirect: 'follow',
          signal: AbortSignal.timeout(7000),
          headers: { 'User-Agent': 'Toolpotro-OG-Fetcher/1.0' },
        });
        if (imgRes.ok) {
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length > 12 && buf.length <= 5 * 1024 * 1024) {
            let detectedType = '';
            if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
              detectedType = 'image/png';
            } else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
              detectedType = 'image/jpeg';
            } else if (buf.subarray(0, 4).toString('ascii') === 'GIF8') {
              detectedType = 'image/gif';
            } else if (
              buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
              buf.subarray(8, 12).toString('ascii') === 'WEBP'
            ) {
              detectedType = 'image/webp';
            } else {
              const headerType = (imgRes.headers.get('content-type') || '')
                .split(';')[0]
                .trim()
                .toLowerCase();
              if (
                headerType === 'image/png' ||
                headerType === 'image/jpeg' ||
                headerType === 'image/jpg' ||
                headerType === 'image/gif' ||
                headerType === 'image/webp'
              ) {
                detectedType = headerType === 'image/jpg' ? 'image/jpeg' : headerType;
              }
            }

            if (detectedType) {
              return res
                .status(200)
                .set('Content-Type', detectedType)
                .set('Cache-Control', 'public, max-age=3600')
                .send(buf);
            }
          }
        }
      }

      return sendFallback();
    } catch {
      return sendFallback();
    }
  });

  // Dynamic robots.txt for Googlebot & AI Search Crawlers
  app.get('/robots.txt', (req, res) => {
    const origin = resolveRequestOrigin(req);
    const lines = [
      'User-agent: *',
      'Allow: /',
      'Allow: /software/',
      'Disallow: /admin',
      'Disallow: /api/',
      ...(origin ? ['', `Sitemap: ${origin}/sitemap.xml`] : []),
    ];
    res.set('Cache-Control', 'public, max-age=3600').type('text/plain').send(lines.join('\n'));
  });

  // Dynamic XML Sitemap of all active software pages + platform directories
  app.get('/sitemap.xml', async (req, res) => {
    const origin = resolveRequestOrigin(req) || 'https://toolpotro.onrender.com';
    const items = await fetchAllActiveSoftwareForSeo();
    const today = new Date().toISOString().slice(0, 10);

    const staticUrls = [
      { loc: `${origin}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
      { loc: `${origin}/?platform=Windows`, lastmod: today, changefreq: 'daily', priority: '0.8' },
      { loc: `${origin}/?platform=Android`, lastmod: today, changefreq: 'daily', priority: '0.8' },
      { loc: `${origin}/?platform=Chrome`, lastmod: today, changefreq: 'daily', priority: '0.8' },
      { loc: `${origin}/?platform=macOS`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
    ];

    const softwareUrls = items.map((item) => ({
      loc: `${origin}/software/${encodeURIComponent(item.id)}`,
      lastmod: item.updatedAtIso.slice(0, 10),
      changefreq: 'weekly',
      priority: '0.9',
    }));

    const xmlEntries = [...staticUrls, ...softwareUrls]
      .map(
        (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(u.lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
      )
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;

    res.set('Cache-Control', 'public, max-age=600').type('application/xml').send(xml);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distPath, 'index.html');
    const cachedHtml = fs.existsSync(indexHtmlPath)
      ? fs.readFileSync(indexHtmlPath, 'utf-8')
      : '';

    app.use(express.static(distPath, { maxAge: '1d', index: false }));
    app.get('*', async (req, res) => {
      if (!cachedHtml) {
        return res.sendFile(indexHtmlPath);
      }

      const origin = resolveRequestOrigin(req);
      if (!origin) {
        return res.type('html').send(cachedHtml);
      }

      const softwareMatch = req.path.match(/^\/software\/([a-zA-Z0-9_-]{1,128})\/?$/);
      if (softwareMatch) {
        const requestedId = softwareMatch[1];
        const redirects = await fetchSlugRedirects();
        const redirectTarget = redirects[requestedId];
        if (redirectTarget && redirectTarget !== requestedId) {
          return res.redirect(301, `/software/${encodeURIComponent(redirectTarget)}`);
        }
      }

      const softwareItem = softwareMatch ? await fetchPublicSoftwareMeta(softwareMatch[1]) : null;

      const cleanPath = req.path === '/' ? '/' : req.path.replace(/\/+$/, '');
      const platformParam =
        cleanPath === '/' && typeof req.query.platform === 'string' && req.query.platform
          ? `?platform=${encodeURIComponent(req.query.platform)}`
          : '';
      const canonicalUrl = `${origin}${cleanPath}${platformParam}`.replace(/["<>]/g, '');

      if (softwareItem) {
        const title = `${softwareItem.name} (${softwareItem.version}) — Toolpotro`;
        const desc = buildSeoDescription(softwareItem);
        const hasSoftwareThumb = Boolean(softwareItem.thumbnailUrl?.trim());
        const ogImageUrl = hasSoftwareThumb
          ? `${origin}/api/og-thumbnail/${encodeURIComponent(softwareItem.id)}`
          : `${origin}/og-preview.png`;

        const safeTitle = escapeHtmlAttr(title);
        const safeDesc = escapeHtmlAttr(desc);
        const safeAlt = escapeHtmlAttr(`${softwareItem.name} logo`);

        const schemaJson = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: softwareItem.name,
          softwareVersion: softwareItem.version,
          operatingSystem: softwareItem.platform,
          applicationCategory:
            softwareItem.category === 'android'
              ? 'MobileApplication'
              : softwareItem.category === 'extension'
              ? 'BrowserApplication'
              : 'DesktopEnhancementApplication',
          fileSize: softwareItem.fileSize,
          description: softwareItem.tagline || softwareItem.description.slice(0, 200),
          image: ogImageUrl,
          url: canonicalUrl,
          offers: {
            '@type': 'Offer',
            price: String(softwareItem.price > 0 ? softwareItem.price : 0),
            priceCurrency: 'USD',
          },
          interactionStatistic: {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/DownloadAction',
            userInteractionCount: softwareItem.downloadsCount,
          },
        }).replace(/<\/script/gi, '<\\/script');

        // Semantic SSR content inside #root so Googlebot & AI crawlers read full details immediately; React replaces #root cleanly on load.
        const ssrFallbackHtml = `<main style="max-width:960px;margin:0 auto;padding:24px;font-family:sans-serif"><h1>${escapeHtmlAttr(
          softwareItem.name
        )} (${escapeHtmlAttr(softwareItem.version)})</h1><p>${escapeHtmlAttr(
          softwareItem.tagline
        )}</p><p>Platform: ${escapeHtmlAttr(softwareItem.platform)} (${escapeHtmlAttr(
          softwareItem.fileType
        )}) · Size: ${escapeHtmlAttr(
          softwareItem.fileSize
        )} · Downloads: ${softwareItem.downloadsCount}</p><p>${escapeHtmlAttr(
          softwareItem.description
        )}</p><a href="/">Back to Toolpotro Catalog</a></main>`;

        let html = cachedHtml
          .replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`)
          .replace(
            /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="description" content="${safeDesc}" />`
          )
          .replace(
            /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:title" content="${safeTitle}" />`
          )
          .replace(
            /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:description" content="${safeDesc}" />`
          )
          .replace(
            /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image" content="${ogImageUrl}" />`
          )
          .replace(
            /<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image:secure_url" content="${ogImageUrl}" />`
          )
          .replace(
            /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/i,
            `<meta property="og:image:alt" content="${safeAlt}" />`
          )
          .replace(
            /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:title" content="${safeTitle}" />`
          )
          .replace(
            /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:description" content="${safeDesc}" />`
          )
          .replace(
            /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
            `<meta name="twitter:image" content="${ogImageUrl}" />`
          )
          .replace(
            /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
            `<script type="application/ld+json">\n      ${schemaJson}\n    </script>`
          )
          .replace('<div id="root"></div>', `<div id="root">${ssrFallbackHtml}</div>`);

        if (hasSoftwareThumb) {
          html = html
            .replace(/<meta\s+property="og:image:type"\s+content="[^"]*"\s*\/?>\s*/i, '')
            .replace(/<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>\s*/i, '')
            .replace(/<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>\s*/i, '')
            .replace(
              /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/i,
              `<meta name="twitter:card" content="summary" />`
            );
        }

        html = html.replace(
          '</head>',
          `  <meta property="og:url" content="${canonicalUrl}" />\n    <link rel="canonical" href="${canonicalUrl}" />\n  </head>`
        );

        return res.set('Cache-Control', 'no-cache').type('html').send(html);
      }

      const ogImageUrl = `${origin}/og-preview.png`;
      const [contact, activeList] = await Promise.all([
        fetchContactSettings(),
        fetchAllActiveSoftwareForSeo(),
      ]);

      const homeSchemaJson = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Organization',
            name: 'Toolpotro',
            url: origin,
            logo: `${origin}/favicon.png`,
            email: contact.contactEmail,
            ...(contact.facebookUrl ? { sameAs: [contact.facebookUrl] } : {}),
          },
          {
            '@type': 'WebSite',
            name: 'Toolpotro',
            url: origin,
            potentialAction: {
              '@type': 'SearchAction',
              target: `${origin}/?q={search_term_string}`,
              'query-input': 'required name=search_term_string',
            },
          },
          {
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Are downloads on Toolpotro direct and free of bundled installers?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. Every download button links directly to the published release file (.exe, .apk, .zip, or official store listing) without third-party download managers or redirect chains.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which platforms and file formats are supported?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Toolpotro distributes Windows PC utilities (.exe / .zip), Android mobile applications (.apk), Chrome & Chromium browser extensions, macOS apps, and cross-platform developer tools.',
                },
              },
            ],
          },
        ],
      }).replace(/<\/script/gi, '<\\/script');

      const catalogLinksHtml = activeList
        .slice(0, 60)
        .map(
          (item) =>
            `<li><a href="/software/${encodeURIComponent(item.id)}">${escapeHtmlAttr(
              item.name
            )} (${escapeHtmlAttr(item.version)})</a> - ${escapeHtmlAttr(
              item.platform
            )} · ${escapeHtmlAttr(item.tagline)}</li>`
        )
        .join('');

      const homeSsrFallbackHtml = `<main style="max-width:960px;margin:0 auto;padding:24px;font-family:sans-serif"><h1>Toolpotro — Verified Software, Apps &amp; Browser Extensions</h1><p>Direct, verified distribution for Windows utilities (.exe, .zip), Android APKs (.apk), macOS apps, and browser extensions with installation guides.</p><ul>${catalogLinksHtml}</ul><footer><a href="mailto:${escapeHtmlAttr(
        contact.contactEmail
      )}">${escapeHtmlAttr(contact.contactEmail)}</a></footer></main>`;

      const html = cachedHtml
        .replace(/content="\/og-preview\.png"/g, `content="${ogImageUrl}"`)
        .replace(/"image": "\/og-preview\.png"/g, `"image": "${ogImageUrl}"`)
        .replace(
          /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
          `<script type="application/ld+json">\n      ${homeSchemaJson}\n    </script>`
        )
        .replace('<div id="root"></div>', `<div id="root">${homeSsrFallbackHtml}</div>`)
        .replace(
          '</head>',
          `  <meta property="og:url" content="${canonicalUrl}" />\n    <link rel="canonical" href="${canonicalUrl}" />\n  </head>`
        );

      return res.set('Cache-Control', 'no-cache').type('html').send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Toolpotro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Toolpotro server:', err);
  process.exit(1);
});
