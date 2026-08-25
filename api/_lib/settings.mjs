// Pengaturan Panel Admin: Downloader Manager (ON/OFF + nama platform per
// platform) dan Maintenance Mode. Disimpan di Vercel KV supaya persisten
// tanpa perlu database terpisah, konsisten dengan cara statistik disimpan
// di admin-stats.mjs / track.mjs.

import { kvHGetAll, kvHSet, kvGetJSON, kvSetJSON, isKvConfigured } from "./kv.mjs";

// Default: semua platform ON dengan nama bawaan. Dipakai kalau KV belum
// disetup ATAU platform belum pernah diatur sama sekali dari Panel Admin.
export const DEFAULT_PLATFORMS = {
  tiktok: { enabled: true, name: "TikTok" },
  instagram: { enabled: true, name: "Instagram" },
  youtube: { enabled: true, name: "YouTube" },
  pinterest: { enabled: true, name: "Pinterest" }
};

export const DEFAULT_MAINTENANCE = {
  enabled: false,
  message: "Website sedang dalam perbaikan. Silakan coba lagi beberapa saat lagi."
};

const PLATFORMS_KEY = "settings:platforms";
const MAINTENANCE_KEY = "settings:maintenance";

function sanitizeName(name, fallback) {
  const clean = String(name ?? "").trim().slice(0, 40);
  return clean || fallback;
}

function sanitizeMessage(message) {
  const clean = String(message ?? "").trim().slice(0, 500);
  return clean || DEFAULT_MAINTENANCE.message;
}

export async function getPlatformSettings() {
  if (!isKvConfigured()) return structuredClone(DEFAULT_PLATFORMS);

  const raw = await kvHGetAll(PLATFORMS_KEY);
  const merged = {};

  for (const id of Object.keys(DEFAULT_PLATFORMS)) {
    let parsed = null;
    try {
      parsed = raw[id] ? JSON.parse(raw[id]) : null;
    } catch {
      parsed = null;
    }

    merged[id] = {
      enabled: typeof parsed?.enabled === "boolean" ? parsed.enabled : DEFAULT_PLATFORMS[id].enabled,
      name: sanitizeName(parsed?.name, DEFAULT_PLATFORMS[id].name)
    };
  }

  return merged;
}

export async function savePlatformSettings(updates) {
  if (!isKvConfigured()) return false;

  const current = await getPlatformSettings();
  const jobs = [];

  for (const id of Object.keys(DEFAULT_PLATFORMS)) {
    if (!updates[id]) continue;

    const next = {
      enabled: typeof updates[id].enabled === "boolean" ? updates[id].enabled : current[id].enabled,
      name:
        updates[id].name !== undefined
          ? sanitizeName(updates[id].name, DEFAULT_PLATFORMS[id].name)
          : current[id].name
    };

    jobs.push(kvHSet(PLATFORMS_KEY, id, JSON.stringify(next)));
  }

  await Promise.all(jobs);
  return true;
}

export async function isPlatformEnabled(id) {
  if (!DEFAULT_PLATFORMS[id]) return true; // platform tidak dikenal -> jangan diblokir di sini
  const settings = await getPlatformSettings();
  return settings[id]?.enabled !== false;
}

export async function getMaintenanceSettings() {
  const saved = await kvGetJSON(MAINTENANCE_KEY, null);
  if (!saved || typeof saved !== "object") return structuredClone(DEFAULT_MAINTENANCE);

  return {
    enabled: Boolean(saved.enabled),
    message: sanitizeMessage(saved.message)
  };
}

export async function saveMaintenanceSettings(update) {
  if (!isKvConfigured()) return false;

  const current = await getMaintenanceSettings();
  const next = {
    enabled: typeof update.enabled === "boolean" ? update.enabled : current.enabled,
    message: update.message !== undefined ? sanitizeMessage(update.message) : current.message
  };

  await kvSetJSON(MAINTENANCE_KEY, next);
  return true;
}
