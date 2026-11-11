/**
 * Lightweight Keep-Alive Ping Helper for Render Free Tier
 * Run externally via cron or as a scheduled worker:
 *   APP_URL=https://your-toolpotro-app.onrender.com node scripts/keep-alive.mjs
 */
const targetUrl = process.env.APP_URL || 'http://localhost:3000';
const intervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS || 600000); // 10 mins

async function ping() {
  try {
    const res = await fetch(`${targetUrl.replace(/\/$/, '')}/api/health`);
    const data = await res.json();
    console.log(`[Keep-Alive] ${new Date().toISOString()} -> ${res.status}`, data.status);
  } catch (err) {
    console.error(`[Keep-Alive] Ping failed:`, err instanceof Error ? err.message : err);
  }
}

ping();
setInterval(ping, intervalMs);
