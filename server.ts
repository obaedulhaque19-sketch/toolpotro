import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFirebaseApiKey(): string {
  if (process.env.VITE_FIREBASE_API_KEY) return process.env.VITE_FIREBASE_API_KEY;
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (parsed.apiKey) return parsed.apiKey;
    }
  } catch {
    // Ignore fallback read errors
  }
  return '';
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
    app.get('*', (req, res) => {
      if (!cachedHtml) {
        return res.sendFile(indexHtmlPath);
      }
      const forwardedProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
        .split(',')[0]
        .trim();
      const host = String(req.headers['x-forwarded-host'] || req.get('host') || '')
        .split(',')[0]
        .trim();
      const envUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/+$/, '') : '';
      const origin = envUrl || (host ? `${forwardedProto}://${host}` : '');

      if (!origin) {
        return res.type('html').send(cachedHtml);
      }

      const safePath = (req.originalUrl || '/').replace(/["<>]/g, '');
      const pageUrl = `${origin}${safePath}`;
      const ogImageUrl = `${origin}/og-preview.png`;

      const html = cachedHtml
        .replace(/content="\/og-preview\.png"/g, `content="${ogImageUrl}"`)
        .replace(/"image": "\/og-preview\.png"/g, `"image": "${ogImageUrl}"`)
        .replace(
          '</head>',
          `  <meta property="og:url" content="${pageUrl}" />\n    <link rel="canonical" href="${pageUrl}" />\n  </head>`
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
