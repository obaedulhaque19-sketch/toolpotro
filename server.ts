import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
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

async function requireAdminMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authCheck = await verifyAdminToken(req.headers.authorization);
  if (!authCheck.ok) {
    return res.status(403).json({ error: authCheck.error });
  }
  return next();
}

// ---------------------------------------------------------------------------
// Automated bKash / Nagad SMS Inbox & License Verification Helpers
// ---------------------------------------------------------------------------
interface StoredSmsReceipt {
  trxId: string;
  provider: 'bkash' | 'nagad';
  sender: string;
  amount: number;
  senderPhone: string;
  rawMessage: string;
  receivedAtMs: number;
  matchedOrderId?: string;
  matchedLicenseKey?: string;
  status: 'unused' | 'matched' | 'ignored';
  syncedToFirestore?: boolean;
}

interface SmsStateStore {
  receipts: Record<string, StoredSmsReceipt>;
  verifiedKeys: Record<string, { trxId: string; amount: number; matchedAtMs: number }>;
}

const SMS_STATE_PATH = '/tmp/toolpotro-sms-state.json';
let smsStateMemory: SmsStateStore | null = null;

function loadSmsState(): SmsStateStore {
  if (smsStateMemory) return smsStateMemory;
  try {
    if (fs.existsSync(SMS_STATE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(SMS_STATE_PATH, 'utf-8')) as Partial<SmsStateStore>;
      smsStateMemory = {
        receipts: parsed.receipts && typeof parsed.receipts === 'object' ? parsed.receipts : {},
        verifiedKeys:
          parsed.verifiedKeys && typeof parsed.verifiedKeys === 'object' ? parsed.verifiedKeys : {},
      };
      return smsStateMemory;
    }
  } catch {
    // Fallback to empty state
  }
  smsStateMemory = { receipts: {}, verifiedKeys: {} };
  return smsStateMemory;
}

function saveSmsState(state: SmsStateStore) {
  smsStateMemory = state;
  // Prune to latest 500 receipts to keep memory tiny
  const keys = Object.keys(state.receipts);
  if (keys.length > 500) {
    keys
      .sort((a, b) => (state.receipts[a]?.receivedAtMs || 0) - (state.receipts[b]?.receivedAtMs || 0))
      .slice(0, keys.length - 500)
      .forEach((oldKey) => delete state.receipts[oldKey]);
  }
  try {
    fs.writeFileSync(SMS_STATE_PATH, JSON.stringify(state), 'utf-8');
  } catch {
    // Non-fatal on read-only environments
  }
}

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedSaToken: { token: string; expiresAtMs: number } | null = null;
let lastFirestoreSyncError: string | null = null;

function parseServiceAccountCreds(): ServiceAccountCreds | null {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;

  // Strip accidental surrounding quotes from env UI paste
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1).trim();
  }

  // Support base64-encoded service account JSON if provided
  if (!raw.startsWith('{')) {
    try {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8').trim();
      if (decoded.startsWith('{')) raw = decoded;
    } catch {
      // Fall through to JSON.parse
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountCreds>;
    if (parsed.client_email && parsed.private_key) {
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key.replace(/\\n/g, '\n'),
        token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function getFirebaseAdminAccessToken(): Promise<string | null> {
  const creds = parseServiceAccountCreds();
  if (!creds) return null;
  const now = Date.now();
  if (cachedSaToken && cachedSaToken.expiresAtMs > now + 60_000) {
    return cachedSaToken.token;
  }
  try {
    const iat = Math.floor(now / 1000);
    const exp = iat + 3500;
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/datastore',
        aud: creds.token_uri || 'https://oauth2.googleapis.com/token',
        exp,
        iat,
      })
    ).toString('base64url');
    const unsigned = `${header}.${claimSet}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(creds.private_key, 'base64url');
    const jwt = `${unsigned}.${signature}`;

    const resp = await fetch(creds.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) {
      lastFirestoreSyncError = `OAuth token request failed (${resp.status})`;
      return null;
    }
    const data = (await resp.json()) as { access_token?: string; expires_in?: number };
    if (data.access_token) {
      cachedSaToken = {
        token: data.access_token,
        expiresAtMs: now + (data.expires_in || 3600) * 1000,
      };
      return data.access_token;
    }
  } catch (err) {
    lastFirestoreSyncError = err instanceof Error ? err.message : 'OAuth token error';
    return null;
  }
  return null;
}

function normalizeBdPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length === 13) {
    return digits.slice(2);
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

type SmsMismatchReason =
  | 'already_used'
  | 'provider_mismatch'
  | 'phone_mismatch'
  | 'insufficient_amount';

function evaluateSmsMatch(params: {
  receipt: StoredSmsReceipt;
  expectedProvider?: string;
  expectedPhone?: string;
  expectedAmount: number;
  targetOrderId?: string;
  targetLicenseKey?: string;
}): { ok: boolean; reason?: SmsMismatchReason } {
  const {
    receipt,
    expectedProvider,
    expectedPhone,
    expectedAmount,
    targetOrderId,
    targetLicenseKey,
  } = params;

  if (receipt.status === 'ignored') {
    return { ok: false, reason: 'already_used' };
  }

  if (receipt.status === 'matched') {
    const matchesTargetKey =
      Boolean(targetLicenseKey) &&
      Boolean(receipt.matchedLicenseKey) &&
      receipt.matchedLicenseKey === targetLicenseKey;
    const matchesTargetOrder =
      Boolean(targetOrderId) &&
      Boolean(receipt.matchedOrderId) &&
      receipt.matchedOrderId === targetOrderId;

    if (!matchesTargetKey && !matchesTargetOrder) {
      return { ok: false, reason: 'already_used' };
    }
    if (
      targetLicenseKey &&
      receipt.matchedLicenseKey &&
      receipt.matchedLicenseKey !== targetLicenseKey
    ) {
      return { ok: false, reason: 'already_used' };
    }
    if (
      targetOrderId &&
      receipt.matchedOrderId &&
      receipt.matchedOrderId !== targetOrderId
    ) {
      return { ok: false, reason: 'already_used' };
    }
  }

  const cleanExpectedProvider = String(expectedProvider || '').trim().toLowerCase();
  if (
    cleanExpectedProvider &&
    (cleanExpectedProvider === 'bkash' || cleanExpectedProvider === 'nagad') &&
    receipt.provider !== cleanExpectedProvider
  ) {
    return { ok: false, reason: 'provider_mismatch' };
  }

  const normExpectedPhone = normalizeBdPhone(expectedPhone || '');
  const normSmsPhone = normalizeBdPhone(receipt.senderPhone || '');
  if (!normExpectedPhone || !normSmsPhone || normExpectedPhone.length < 6 || normExpectedPhone !== normSmsPhone) {
    return { ok: false, reason: 'phone_mismatch' };
  }

  if (Number(receipt.amount) + 0.0001 < Number(expectedAmount)) {
    return { ok: false, reason: 'insufficient_amount' };
  }

  return { ok: true };
}

const trxLockQueues = new Map<string, Promise<void>>();
async function withTrxLock<T>(trxId: string, fn: () => Promise<T>): Promise<T> {
  const key = trxId.toUpperCase().trim() || '__empty__';
  const prev = trxLockQueues.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  const chain = prev.then(() => gate);
  trxLockQueues.set(key, chain);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (trxLockQueues.get(key) === chain) {
      trxLockQueues.delete(key);
    }
  }
}

interface FirestoreLicenseDoc {
  licenseKey: string;
  orderId: string;
  softwareId: string;
  softwareName: string;
  planName: string;
  durationDays: number;
  currency: string;
  amount: number;
  paymentMethod?: 'bkash' | 'nagad' | 'free';
  senderPhone?: string;
  trxId: string;
  resubmittedTrxId?: string;
  resubmittedPhone?: string;
  resubmittedPaymentMethod?: 'bkash' | 'nagad' | 'free';
  status: 'provisional' | 'verified' | 'payment_required' | 'revoked';
  graceUntilMs: number;
  expiresAtMs: number;
  maxDevices: number;
  boundDevices: string[];
}

async function fetchLicenseDoc(licenseKey: string): Promise<FirestoreLicenseDoc | null> {
  if (!/^[A-Z0-9-]{8,64}$/.test(licenseKey)) return null;
  const cfg = getFirebasePublicConfig();
  if (!cfg.apiKey || !cfg.projectId) return null;

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/${encodeURIComponent(cfg.databaseId)}/documents/licenses/${encodeURIComponent(
      licenseKey
    )}?key=${encodeURIComponent(cfg.apiKey)}`;
    const resp = await fetch(endpoint, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      fields?: Record<
        string,
        {
          stringValue?: string;
          integerValue?: string;
          doubleValue?: number;
          arrayValue?: { values?: Array<{ stringValue?: string }> };
        }
      >;
    };
    const f = json.fields;
    if (!f) return null;
    const statusRaw = f.status?.stringValue || 'provisional';
    const status = (
      ['provisional', 'verified', 'payment_required', 'revoked'].includes(statusRaw)
        ? statusRaw
        : 'provisional'
    ) as FirestoreLicenseDoc['status'];

    const methodRaw = f.paymentMethod?.stringValue;
    const resubMethodRaw = f.resubmittedPaymentMethod?.stringValue;

    return {
      licenseKey: f.licenseKey?.stringValue || licenseKey,
      orderId: f.orderId?.stringValue || '',
      softwareId: f.softwareId?.stringValue || '',
      softwareName: f.softwareName?.stringValue || 'Toolpotro Software',
      planName: f.planName?.stringValue || 'Standard',
      durationDays: Number(f.durationDays?.integerValue ?? 0),
      currency: f.currency?.stringValue || 'BDT',
      amount: Number(f.amount?.doubleValue ?? f.amount?.integerValue ?? 0),
      paymentMethod:
        methodRaw === 'bkash' || methodRaw === 'nagad' || methodRaw === 'free'
          ? methodRaw
          : undefined,
      senderPhone: f.senderPhone?.stringValue?.trim() || undefined,
      trxId: (f.trxId?.stringValue || '').toUpperCase().trim(),
      resubmittedTrxId: (f.resubmittedTrxId?.stringValue || '').toUpperCase().trim() || undefined,
      resubmittedPhone: f.resubmittedPhone?.stringValue?.trim() || undefined,
      resubmittedPaymentMethod:
        resubMethodRaw === 'bkash' || resubMethodRaw === 'nagad' || resubMethodRaw === 'free'
          ? resubMethodRaw
          : undefined,
      status,
      graceUntilMs: Number(f.graceUntilMs?.integerValue ?? 0),
      expiresAtMs: Number(f.expiresAtMs?.integerValue ?? 0),
      maxDevices: Math.max(1, Number(f.maxDevices?.integerValue ?? 1)),
      boundDevices: (f.boundDevices?.arrayValue?.values || [])
        .map((v) => v.stringValue || '')
        .filter(Boolean),
    };
  } catch {
    return null;
  }
}

async function fetchOrderPaymentMeta(
  orderId: string
): Promise<{ paymentMethod?: string; senderPhone?: string } | null> {
  if (!orderId) return null;
  const token = await getFirebaseAdminAccessToken();
  if (!token) return null;
  const cfg = getFirebasePublicConfig();
  if (!cfg.projectId) return null;

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/${encodeURIComponent(cfg.databaseId)}/documents/orders/${encodeURIComponent(orderId)}`;
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      fields?: Record<string, { stringValue?: string }>;
    };
    return {
      paymentMethod: json.fields?.paymentMethod?.stringValue?.trim().toLowerCase(),
      senderPhone: json.fields?.senderPhone?.stringValue?.trim(),
    };
  } catch {
    return null;
  }
}

async function fetchSmsTransactionFromFirestore(trxId: string): Promise<StoredSmsReceipt | null> {
  const token = await getFirebaseAdminAccessToken();
  if (!token) return null;
  const cfg = getFirebasePublicConfig();
  if (!cfg.projectId) return null;

  const safeDocId = trxId.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId
    )}/databases/${encodeURIComponent(cfg.databaseId)}/documents/smsTransactions/${encodeURIComponent(safeDocId)}`;
    const resp = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      fields?: Record<
        string,
        { stringValue?: string; integerValue?: string; doubleValue?: number }
      >;
    };
    const f = json.fields;
    if (!f) return null;
    const provRaw = (f.provider?.stringValue || '').toLowerCase();
    const provider: 'bkash' | 'nagad' = provRaw === 'nagad' ? 'nagad' : 'bkash';
    const statusRaw = f.status?.stringValue || 'unused';
    const status: StoredSmsReceipt['status'] =
      statusRaw === 'matched' || statusRaw === 'ignored' ? statusRaw : 'unused';

    return {
      trxId: (f.trxId?.stringValue || trxId).toUpperCase().trim(),
      provider,
      sender: f.sender?.stringValue || provider,
      amount: Number(f.amount?.doubleValue ?? f.amount?.integerValue ?? 0),
      senderPhone: f.senderPhone?.stringValue || '',
      rawMessage: f.rawMessage?.stringValue || '',
      receivedAtMs: Number(f.receivedAtMs?.integerValue ?? Date.now()),
      matchedOrderId: f.matchedOrderId?.stringValue || undefined,
      matchedLicenseKey: f.matchedLicenseKey?.stringValue || undefined,
      status,
      syncedToFirestore: true,
    };
  } catch {
    return null;
  }
}

async function isTrxIdAlreadyVerifiedElsewhere(
  trxId: string,
  currentOrderId?: string,
  currentLicenseKey?: string
): Promise<boolean> {
  const cleanTrx = trxId.toUpperCase().trim();
  if (!cleanTrx) return false;

  // Check in-memory verifiedKeys index first
  const state = loadSmsState();
  for (const [k, info] of Object.entries(state.verifiedKeys)) {
    if (info.trxId === cleanTrx && (!currentLicenseKey || k !== currentLicenseKey)) {
      return true;
    }
  }

  const token = await getFirebaseAdminAccessToken();
  if (!token) return false;
  const cfg = getFirebasePublicConfig();
  if (!cfg.projectId) return false;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/${encodeURIComponent(cfg.databaseId)}/documents`;

  const queries = [
    { collectionId: 'orders', fieldPath: 'trxId' },
    { collectionId: 'licenses', fieldPath: 'trxId' },
    { collectionId: 'licenses', fieldPath: 'resubmittedTrxId' },
  ];

  for (const q of queries) {
    try {
      const resp = await fetch(`${baseUrl}:runQuery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: q.collectionId }],
            where: {
              fieldFilter: {
                field: { fieldPath: q.fieldPath },
                op: 'EQUAL',
                value: { stringValue: cleanTrx },
              },
            },
            limit: 10,
          },
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) continue;
      const rows = (await resp.json()) as Array<{
        document?: { name?: string; fields?: Record<string, { stringValue?: string }> };
      }>;
      for (const row of rows) {
        const f = row.document?.fields;
        if (!f) continue;
        const st = f.status?.stringValue || '';
        const ordId = f.orderId?.stringValue || '';
        const licKey = f.licenseKey?.stringValue || '';
        const sameTarget =
          (Boolean(currentOrderId) && ordId === currentOrderId) ||
          (Boolean(currentLicenseKey) && licKey === currentLicenseKey);
        if (st === 'verified' && !sameTarget) {
          return true;
        }
      }
    } catch {
      // Ignore transient query failure
    }
  }
  return false;
}

async function markSmsMatchedInFirestore(
  receipt: StoredSmsReceipt,
  orderId: string,
  licenseKey: string
): Promise<boolean> {
  const token = await getFirebaseAdminAccessToken();
  if (!token) return false;
  const cfg = getFirebasePublicConfig();
  if (!cfg.projectId) return false;

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/${encodeURIComponent(cfg.databaseId)}/documents`;
  const safeDocId = receipt.trxId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const nowIso = new Date().toISOString();

  try {
    const resp = await fetch(
      `${baseUrl}/smsTransactions/${encodeURIComponent(
        safeDocId
      )}?updateMask.fieldPaths=status&updateMask.fieldPaths=matchedOrderId&updateMask.fieldPaths=matchedLicenseKey&updateMask.fieldPaths=updatedAt`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            status: { stringValue: 'matched' },
            matchedOrderId: { stringValue: orderId || '' },
            matchedLicenseKey: { stringValue: licenseKey || '' },
            updatedAt: { timestampValue: nowIso },
          },
        }),
        signal: AbortSignal.timeout(3500),
      }
    );
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      lastFirestoreSyncError = `Firestore smsTransactions match failed (${resp.status}): ${errText.slice(0, 140)}`;
      return false;
    }
    lastFirestoreSyncError = null;
    return true;
  } catch (err) {
    lastFirestoreSyncError = err instanceof Error ? err.message : 'Firestore match update error';
    return false;
  }
}

async function persistSmsAndVerifyViaServiceAccount(
  receipt: StoredSmsReceipt
): Promise<void> {
  const token = await getFirebaseAdminAccessToken();
  if (!token) return;
  const cfg = getFirebasePublicConfig();
  if (!cfg.projectId) return;

  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/${encodeURIComponent(cfg.databaseId)}/documents`;

  const nowIso = new Date().toISOString();
  const safeDocId = receipt.trxId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Preserve any existing Firestore record (never reset an already matched/ignored receipt!)
  const existingFs = await fetchSmsTransactionFromFirestore(receipt.trxId);
  if (existingFs) {
    receipt.status = existingFs.status;
    receipt.matchedOrderId = existingFs.matchedOrderId;
    receipt.matchedLicenseKey = existingFs.matchedLicenseKey;
    receipt.syncedToFirestore = true;
    lastFirestoreSyncError = null;
    return;
  }

  let matchedLicenseKey = receipt.matchedLicenseKey || '';
  let matchedOrderId = receipt.matchedOrderId || '';
  let smsStatus: 'unused' | 'matched' = receipt.status === 'matched' ? 'matched' : 'unused';

  try {
    // 1. Immediately save the incoming SMS receipt to Firestore BEFORE any matching so it survives Render restarts
    const upsertRes = await fetch(`${baseUrl}/smsTransactions/${encodeURIComponent(safeDocId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          trxId: { stringValue: receipt.trxId },
          provider: { stringValue: receipt.provider },
          sender: { stringValue: receipt.sender },
          amount: { doubleValue: receipt.amount },
          senderPhone: { stringValue: receipt.senderPhone },
          rawMessage: { stringValue: receipt.rawMessage.slice(0, 1000) },
          receivedAtMs: { integerValue: String(Math.floor(receipt.receivedAtMs)) },
          matchedOrderId: { stringValue: matchedOrderId },
          matchedLicenseKey: { stringValue: matchedLicenseKey },
          status: { stringValue: smsStatus },
          createdAt: { timestampValue: nowIso },
          updatedAt: { timestampValue: nowIso },
        },
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text().catch(() => '');
      lastFirestoreSyncError = `Firestore SMS write failed (${upsertRes.status}): ${errText.slice(0, 140)}`;
      receipt.syncedToFirestore = false;
      return;
    }

    lastFirestoreSyncError = null;
    receipt.syncedToFirestore = true;

    // 2. Look for awaiting licenses (by primary trxId OR resubmittedTrxId)
    const candidateRows: Array<{
      name?: string;
      fields?: Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number }>;
    }> = [];

    for (const fieldPath of ['trxId', 'resubmittedTrxId']) {
      const queryRes = await fetch(`${baseUrl}:runQuery`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'licenses' }],
            where: {
              fieldFilter: {
                field: { fieldPath },
                op: 'EQUAL',
                value: { stringValue: receipt.trxId },
              },
            },
            limit: 5,
          },
        }),
        signal: AbortSignal.timeout(3500),
      });

      if (queryRes.ok) {
        const rows = (await queryRes.json()) as Array<{
          document?: {
            name?: string;
            fields?: Record<
              string,
              { stringValue?: string; integerValue?: string; doubleValue?: number }
            >;
          };
        }>;
        for (const r of rows) {
          if (r.document) candidateRows.push(r.document);
        }
      }
    }

    for (const docItem of candidateRows) {
      const docFields = docItem.fields;
      if (!docFields) continue;

      const licAmount = Number(docFields.amount?.doubleValue ?? docFields.amount?.integerValue ?? 0);
      const licStatus = docFields.status?.stringValue || '';
      const licKey = docFields.licenseKey?.stringValue || docItem.name?.split('/').pop() || '';
      const ordId = docFields.orderId?.stringValue || '';

      if (!licKey || (licStatus !== 'provisional' && licStatus !== 'payment_required')) {
        continue;
      }

      const alreadyUsedElsewhere = await isTrxIdAlreadyVerifiedElsewhere(
        receipt.trxId,
        ordId,
        licKey
      );
      if (alreadyUsedElsewhere) {
        break;
      }

      const isResubmitted =
        (docFields.resubmittedTrxId?.stringValue || '').toUpperCase().trim() === receipt.trxId;
      let expectedProvider = isResubmitted
        ? docFields.resubmittedPaymentMethod?.stringValue || docFields.paymentMethod?.stringValue
        : docFields.paymentMethod?.stringValue;
      let expectedPhone = isResubmitted
        ? docFields.resubmittedPhone?.stringValue || docFields.senderPhone?.stringValue
        : docFields.senderPhone?.stringValue;

      if ((!expectedProvider || !expectedPhone) && ordId) {
        const orderMeta = await fetchOrderPaymentMeta(ordId);
        if (orderMeta) {
          if (!expectedProvider) expectedProvider = orderMeta.paymentMethod;
          if (!expectedPhone) expectedPhone = orderMeta.senderPhone;
        }
      }

      const check = evaluateSmsMatch({
        receipt,
        expectedProvider,
        expectedPhone,
        expectedAmount: licAmount,
        targetOrderId: ordId,
        targetLicenseKey: licKey,
      });

      if (check.ok) {
        await promoteLicenseViaServiceAccount(licKey, ordId);
        await markSmsMatchedInFirestore(receipt, ordId, licKey);

        matchedLicenseKey = licKey;
        matchedOrderId = ordId;
        smsStatus = 'matched';
        break;
      }
    }

    receipt.matchedLicenseKey = matchedLicenseKey || undefined;
    receipt.matchedOrderId = matchedOrderId || undefined;
    receipt.status = smsStatus;
  } catch (err) {
    lastFirestoreSyncError = err instanceof Error ? err.message : 'Firestore SMS persistence failed';
  }
}

async function promoteLicenseViaServiceAccount(licenseKey: string, orderId: string) {
  const token = await getFirebaseAdminAccessToken();
  if (!token) return;
  const cfg = getFirebasePublicConfig();
  if (!cfg.projectId) return;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    cfg.projectId
  )}/databases/${encodeURIComponent(cfg.databaseId)}/documents`;
  const nowIso = new Date().toISOString();

  await fetch(
    `${baseUrl}/licenses/${encodeURIComponent(licenseKey)}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { status: { stringValue: 'verified' }, updatedAt: { timestampValue: nowIso } },
      }),
    }
  ).catch(() => {});

  if (orderId) {
    await fetch(
      `${baseUrl}/orders/${encodeURIComponent(orderId)}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: { status: { stringValue: 'verified' }, updatedAt: { timestampValue: nowIso } },
        }),
      }
    ).catch(() => {});
  }
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  const healthLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  });

  const publicApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again shortly.' },
  });

  const adminApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many admin API requests. Please wait a minute before retrying.' },
  });

  const pageLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) =>
      /\.(js|mjs|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|map|json)$/i.test(req.path) ||
      req.path.startsWith('/@') ||
      req.path.startsWith('/src/') ||
      req.path.startsWith('/node_modules/'),
    message: 'Too many requests. Please try again in a minute.',
  });

  // Render Free Tier Keep-Alive & Health Check Endpoint
  app.get('/api/health', healthLimiter, (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'toolpotro',
      timestamp: new Date().toISOString(),
    });
  });

  // -------------------------------------------------------------------------
  // Automated bKash / Nagad SMS Webhook & License Verification Endpoints
  // -------------------------------------------------------------------------
  app.get('/api/payments/webhook-status', adminApiLimiter, requireAdminMiddleware, (_req, res) => {
    const state = loadSmsState();
    const unsyncedCount = Object.values(state.receipts).filter((r) => !r.syncedToFirestore).length;
    res.json({
      webhookSecretConfigured: Boolean(process.env.SMS_WEBHOOK_SECRET?.trim()),
      firebaseAdminConfigured: Boolean(parseServiceAccountCreds()),
      lastFirestoreSyncError,
      bufferedReceiptsCount: Object.keys(state.receipts).length,
      unsyncedCount,
    });
  });

  app.post(
    '/api/payments/sms-webhook',
    publicApiLimiter,
    express.json({ limit: '16kb' }),
    async (req, res) => {
      const configuredSecret = process.env.SMS_WEBHOOK_SECRET?.trim() || '';
      if (!configuredSecret) {
        return res.status(503).json({
          error: 'SMS_WEBHOOK_SECRET is not configured on the server environment.',
        });
      }

      const incomingSecret = String(req.headers['x-webhook-secret'] || '').trim();
      if (!incomingSecret || !timingSafeEqualString(incomingSecret, configuredSecret)) {
        return res.status(403).json({ error: 'Invalid X-Webhook-Secret' });
      }

      if (req.body?.isTest === true) {
        return res.status(200).json({
          ok: true,
          test: true,
          message: 'Toolpotro PaySync webhook connected successfully.',
          timestamp: new Date().toISOString(),
        });
      }

      const providerRaw = String(req.body?.provider || '').trim().toLowerCase();
      const provider: 'bkash' | 'nagad' | null =
        providerRaw === 'bkash' ? 'bkash' : providerRaw === 'nagad' ? 'nagad' : null;
      const trxId = String(req.body?.trxId || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
      const amount = Number(req.body?.amount);

      if (!provider || !trxId || trxId.length < 4 || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Invalid SMS transaction payload' });
      }

      return withTrxLock(trxId, async () => {
        const state = loadSmsState();
        const existingReceipt = state.receipts[trxId];
        if (existingReceipt) {
          if (!existingReceipt.syncedToFirestore) {
            await persistSmsAndVerifyViaServiceAccount(existingReceipt);
            saveSmsState(state);
          }
          return res.status(200).json({
            ok: true,
            duplicate: true,
            trxId,
            status: existingReceipt.status,
            savedToFirebase: Boolean(existingReceipt.syncedToFirestore),
          });
        }

        // Also check Firestore directly in case Render restarted and cleared /tmp
        const existingFs = await fetchSmsTransactionFromFirestore(trxId);
        if (existingFs) {
          state.receipts[trxId] = existingFs;
          saveSmsState(state);
          return res.status(200).json({
            ok: true,
            duplicate: true,
            trxId,
            status: existingFs.status,
            savedToFirebase: true,
          });
        }

        const receipt: StoredSmsReceipt = {
          trxId,
          provider,
          sender: String(req.body?.sender || provider).slice(0, 40),
          amount,
          senderPhone: String(req.body?.senderPhone || '').trim().slice(0, 40),
          rawMessage: String(req.body?.rawMessage || '').slice(0, 1000),
          receivedAtMs: Number(req.body?.receivedAt) || Date.now(),
          status: 'unused',
          syncedToFirestore: false,
        };

        await persistSmsAndVerifyViaServiceAccount(receipt);
        state.receipts[trxId] = receipt;
        saveSmsState(state);

        return res.status(200).json({
          ok: true,
          trxId: receipt.trxId,
          status: receipt.status,
          savedToFirebase: Boolean(receipt.syncedToFirestore),
        });
      });
    }
  );

  // Admin-only endpoint to fetch buffered SMS receipts & verified keys for Firestore sync
  app.get('/api/payments/sms-queue', adminApiLimiter, requireAdminMiddleware, (_req, res) => {
    const state = loadSmsState();
    res.json({
      receipts: Object.values(state.receipts).sort((a, b) => b.receivedAtMs - a.receivedAtMs),
      verifiedKeys: state.verifiedKeys,
    });
  });

  app.post(
    '/api/payments/sms-queue/ack',
    adminApiLimiter,
    requireAdminMiddleware,
    express.json({ limit: '64kb' }),
    (req, res) => {
      const trxIds = Array.isArray(req.body?.trxIds) ? req.body.trxIds : [];
      const state = loadSmsState();
      let updated = 0;
      for (const rawId of trxIds) {
        const id = String(rawId || '').trim().toUpperCase();
        if (state.receipts[id]) {
          state.receipts[id].syncedToFirestore = true;
          updated += 1;
        }
      }
      saveSmsState(state);
      res.json({ ok: true, updated });
    }
  );

  // Public instant check: matches a submitted TrxID against Firebase & server-buffered bKash/Nagad SMS receipts
  app.post(
    '/api/payments/match-trx',
    publicApiLimiter,
    express.json({ limit: '16kb' }),
    async (req, res) => {
      const trxId = String(req.body?.trxId || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
      const licenseKey = String(req.body?.licenseKey || '').trim().toUpperCase();
      const orderId = String(req.body?.orderId || '').trim();
      const expectedAmount = Number(req.body?.amount ?? 0);
      let expectedProvider = String(req.body?.paymentMethod || '').trim().toLowerCase();
      let expectedPhone = String(req.body?.senderPhone || '').trim();

      if (!trxId) {
        return res.json({ matched: false });
      }

      return withTrxLock(trxId, async () => {
        // Guard: ensure this TrxID was never already verified on another order/license
        const usedElsewhere = await isTrxIdAlreadyVerifiedElsewhere(trxId, orderId, licenseKey);
        if (usedElsewhere) {
          return res.json({ matched: false, reason: 'already_used' });
        }

        const state = loadSmsState();
        // Prefer Firestore receipt if available (survives Render restarts & holds authoritative matched status)
        const fsReceipt = await fetchSmsTransactionFromFirestore(trxId);
        let receipt = fsReceipt || state.receipts[trxId];

        if (fsReceipt) {
          state.receipts[trxId] = fsReceipt;
        }

        if (!receipt) {
          return res.json({ matched: false });
        }

        // Fill missing provider/phone metadata from Firestore order/license if client omitted them
        if ((!expectedProvider || !expectedPhone) && orderId) {
          const orderMeta = await fetchOrderPaymentMeta(orderId);
          if (orderMeta) {
            if (!expectedProvider) expectedProvider = orderMeta.paymentMethod || '';
            if (!expectedPhone) expectedPhone = orderMeta.senderPhone || '';
          }
        }
        if ((!expectedProvider || !expectedPhone) && licenseKey) {
          const lic = await fetchLicenseDoc(licenseKey);
          if (lic) {
            const isResub = lic.resubmittedTrxId === trxId;
            if (!expectedProvider) {
              expectedProvider = (isResub ? lic.resubmittedPaymentMethod : undefined) || lic.paymentMethod || '';
            }
            if (!expectedPhone) {
              expectedPhone = (isResub ? lic.resubmittedPhone : undefined) || lic.senderPhone || '';
            }
          }
        }

        const check = evaluateSmsMatch({
          receipt,
          expectedProvider,
          expectedPhone,
          expectedAmount,
          targetOrderId: orderId,
          targetLicenseKey: licenseKey,
        });

        if (!check.ok) {
          saveSmsState(state);
          return res.json({
            matched: false,
            reason: check.reason,
            paidAmount: receipt.amount,
            expectedAmount,
            receivedProvider: receipt.provider,
            expectedProvider: expectedProvider || undefined,
          });
        }

        receipt.status = 'matched';
        if (orderId) receipt.matchedOrderId = orderId;
        if (licenseKey) {
          receipt.matchedLicenseKey = licenseKey;
          state.verifiedKeys[licenseKey] = {
            trxId,
            amount: receipt.amount,
            matchedAtMs: Date.now(),
          };
        }

        const syncedMatch = await markSmsMatchedInFirestore(
          receipt,
          orderId || receipt.matchedOrderId || '',
          licenseKey || receipt.matchedLicenseKey || ''
        );
        receipt.syncedToFirestore = syncedMatch;
        state.receipts[trxId] = receipt;
        saveSmsState(state);

        if (licenseKey) {
          await promoteLicenseViaServiceAccount(licenseKey, orderId);
        }

        return res.json({
          matched: true,
          trxId,
          amount: receipt.amount,
          provider: receipt.provider,
        });
      });
    }
  );

  // Public In-App License Verification API (for Windows .exe, Android .apk, Chrome extensions & /license page)
  app.options('/api/license/verify', (_req, res) => {
    res
      .set('Access-Control-Allow-Origin', '*')
      .set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .set('Access-Control-Allow-Headers', 'Content-Type')
      .status(204)
      .end();
  });

  const handleLicenseVerify = async (req: express.Request, res: express.Response) => {
    res.set('Access-Control-Allow-Origin', '*');
    const rawKey = String(req.query.key || req.body?.key || '')
      .trim()
      .toUpperCase();
    const deviceId = String(req.query.deviceId || req.body?.deviceId || '')
      .trim()
      .slice(0, 120);

    const origin = resolveRequestOrigin(req) || 'https://toolpotro.onrender.com';

    if (!rawKey || !/^[A-Z0-9-]{8,64}$/.test(rawKey)) {
      return res.status(400).json({
        valid: false,
        status: 'invalid_key',
        message: 'Invalid license key format.',
      });
    }

    const lic = await fetchLicenseDoc(rawKey);
    if (!lic) {
      return res.status(404).json({
        valid: false,
        status: 'not_found',
        message: 'License key not found.',
      });
    }

    const fixUrl = `${origin}/license?key=${encodeURIComponent(rawKey)}`;
    const buyUrl = `${origin}/software/${encodeURIComponent(lic.softwareId)}?buy=license`;
    const now = Date.now();

    if (lic.status === 'revoked') {
      return res.json({
        valid: false,
        status: 'revoked',
        softwareId: lic.softwareId,
        softwareName: lic.softwareName,
        planName: lic.planName,
        fixUrl,
        buyUrl,
        message: 'This license key has been revoked.',
      });
    }

    if (lic.expiresAtMs > 0 && now > lic.expiresAtMs) {
      return res.json({
        valid: false,
        status: 'expired',
        softwareId: lic.softwareId,
        softwareName: lic.softwareName,
        planName: lic.planName,
        expiresAtMs: lic.expiresAtMs,
        buyUrl,
        fixUrl,
        message: 'Subscription period has expired. Please renew.',
      });
    }

    // Check Firebase & server-side SMS state in case SMS arrived or was matched before Admin synced Firestore
    const state = loadSmsState();
    let effectiveStatus = lic.status;

    if (effectiveStatus !== 'verified') {
      if (effectiveStatus === 'provisional' && state.verifiedKeys[rawKey]) {
        effectiveStatus = 'verified';
      } else {
        const candidateTrx = (lic.resubmittedTrxId || lic.trxId || '').toUpperCase().trim();
        if (candidateTrx) {
          await withTrxLock(candidateTrx, async () => {
            const fsSms = await fetchSmsTransactionFromFirestore(candidateTrx);
            const smsMatch = fsSms || state.receipts[candidateTrx];
            if (fsSms) {
              state.receipts[candidateTrx] = fsSms;
            }
            if (!smsMatch) return;

            const usedElsewhere = await isTrxIdAlreadyVerifiedElsewhere(
              candidateTrx,
              lic.orderId,
              rawKey
            );
            if (usedElsewhere) return;

            const isResub = Boolean(lic.resubmittedTrxId && lic.resubmittedTrxId === candidateTrx);
            let expectedProvider: string | undefined = isResub
              ? lic.resubmittedPaymentMethod || lic.paymentMethod
              : lic.paymentMethod;
            let expectedPhone: string | undefined = isResub
              ? lic.resubmittedPhone || lic.senderPhone
              : lic.senderPhone;

            if ((!expectedProvider || !expectedPhone) && lic.orderId) {
              const orderMeta = await fetchOrderPaymentMeta(lic.orderId);
              if (orderMeta) {
                if (!expectedProvider) expectedProvider = orderMeta.paymentMethod;
                if (!expectedPhone) expectedPhone = orderMeta.senderPhone;
              }
            }

            const check = evaluateSmsMatch({
              receipt: smsMatch,
              expectedProvider,
              expectedPhone,
              expectedAmount: lic.amount,
              targetOrderId: lic.orderId,
              targetLicenseKey: rawKey,
            });

            if (check.ok) {
              smsMatch.status = 'matched';
              smsMatch.matchedLicenseKey = rawKey;
              smsMatch.matchedOrderId = lic.orderId;
              const syncedMatch = await markSmsMatchedInFirestore(smsMatch, lic.orderId, rawKey);
              smsMatch.syncedToFirestore = syncedMatch;
              state.receipts[candidateTrx] = smsMatch;
              state.verifiedKeys[rawKey] = {
                trxId: smsMatch.trxId,
                amount: smsMatch.amount,
                matchedAtMs: now,
              };
              saveSmsState(state);
              effectiveStatus = 'verified';
              await promoteLicenseViaServiceAccount(rawKey, lic.orderId);
            }
          });
        }
      }
    }

    if (effectiveStatus === 'payment_required') {
      return res.json({
        valid: false,
        status: 'payment_required',
        softwareId: lic.softwareId,
        softwareName: lic.softwareName,
        planName: lic.planName,
        fixUrl,
        buyUrl,
        message: 'Payment could not be verified. Please submit valid bKash/Nagad payment.',
      });
    }

    if (effectiveStatus === 'provisional' && lic.graceUntilMs > 0 && now > lic.graceUntilMs) {
      return res.json({
        valid: false,
        status: 'payment_required',
        softwareId: lic.softwareId,
        softwareName: lic.softwareName,
        planName: lic.planName,
        graceEnded: true,
        fixUrl,
        buyUrl,
        message: 'Verification grace window ended without matching payment. Please complete payment.',
      });
    }

    if (
      deviceId &&
      lic.boundDevices.length >= lic.maxDevices &&
      !lic.boundDevices.includes(deviceId)
    ) {
      return res.json({
        valid: false,
        status: 'device_limit_reached',
        softwareId: lic.softwareId,
        softwareName: lic.softwareName,
        planName: lic.planName,
        maxDevices: lic.maxDevices,
        fixUrl,
        buyUrl,
        message: `Device limit reached (${lic.maxDevices} device allowed).`,
      });
    }

    return res.json({
      valid: true,
      status: effectiveStatus,
      softwareId: lic.softwareId,
      softwareName: lic.softwareName,
      planName: lic.planName,
      expiresAtMs: lic.expiresAtMs,
      graceUntilMs: lic.graceUntilMs,
      maxDevices: lic.maxDevices,
      fixUrl,
      buyUrl,
    });
  };

  app.get('/api/license/verify', publicApiLimiter, handleLicenseVerify);
  app.post('/api/license/verify', publicApiLimiter, express.json({ limit: '8kb' }), handleLicenseVerify);

  // Check if GitHub Releases storage is configured on server
  app.get('/api/github/status', publicApiLimiter, (_req, res) => {
    const cfg = getGitHubConfig();
    res.json({
      configured: cfg.configured,
      owner: cfg.owner ? cfg.owner : null,
      repo: cfg.repo ? cfg.repo : null,
    });
  });

  // Upload binary file directly to GitHub Releases (Admin Only; verifies auth BEFORE buffering body)
  app.post(
    '/api/github/upload',
    adminApiLimiter,
    requireAdminMiddleware,
    express.raw({ type: 'application/octet-stream', limit: '500mb' }),
    async (req, res) => {
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

  // Delete matching GitHub Release assets when software, images, or banners are replaced or deleted (Admin Only)
  app.delete(
    '/api/github/asset',
    adminApiLimiter,
    requireAdminMiddleware,
    express.json({ limit: '64kb' }),
    async (req, res) => {
      const cfg = getGitHubConfig();
      if (!cfg.configured) {
        return res.status(200).json({ skipped: true });
      }

      const candidateInputs: unknown[] = [
        req.body?.downloadUrl,
        req.body?.thumbnailUrl,
        ...(Array.isArray(req.body?.urls) ? req.body.urls : []),
      ];

      const targetUrls = Array.from(
        new Set(
          candidateInputs
            .filter((u): u is string => typeof u === 'string')
            .map((u) => u.trim())
            .filter((u) => u.includes('github.com/'))
        )
      ).slice(0, 50);

      if (targetUrls.length === 0) {
        return res.status(200).json({ deleted: 0 });
      }

      const targetSet = new Set(targetUrls);

      try {
        const release = await getOrCreateRelease(cfg.owner, cfg.repo, cfg.tag, cfg.token);
        const ghHeaders = {
          Authorization: `Bearer ${cfg.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Toolpotro-Distribution-Server',
        };

        const matchingAssetIds: number[] = [];
        for (let page = 1; page <= 5; page += 1) {
          const listRes = await fetch(
            `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/${release.id}/assets?per_page=100&page=${page}`,
            { headers: ghHeaders }
          );
          if (!listRes.ok) {
            // Fallback to release.assets from initial response if paginated endpoint fails
            if (page === 1 && Array.isArray(release.assets)) {
              for (const asset of release.assets) {
                if (targetSet.has(asset.browser_download_url)) {
                  matchingAssetIds.push(asset.id);
                }
              }
            }
            break;
          }
          const pageAssets = (await listRes.json()) as Array<{
            id: number;
            browser_download_url: string;
          }>;
          for (const asset of pageAssets) {
            if (targetSet.has(asset.browser_download_url)) {
              matchingAssetIds.push(asset.id);
              targetSet.delete(asset.browser_download_url);
            }
          }
          if (targetSet.size === 0 || pageAssets.length < 100) {
            break;
          }
        }

        let deleted = 0;
        for (const assetId of matchingAssetIds) {
          const delRes = await fetch(
            `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/assets/${assetId}`,
            {
              method: 'DELETE',
              headers: ghHeaders,
            }
          );
          if (delRes.ok || delRes.status === 204) {
            deleted += 1;
          }
        }

        return res.status(200).json({ deleted });
      } catch (err) {
        return res.status(500).json({
          error: err instanceof Error ? err.message : 'Failed to delete GitHub asset',
        });
      }
    }
  );

  // Social Link Preview Thumbnail Proxy for individual software pages (no 302 redirects for WhatsApp/Meta bots)
  app.get('/api/og-thumbnail/:id', publicApiLimiter, async (req, res) => {
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
  app.get('/robots.txt', pageLimiter, (req, res) => {
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
  app.get('/sitemap.xml', pageLimiter, async (req, res) => {
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
    app.get('*', pageLimiter, async (req, res) => {
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
