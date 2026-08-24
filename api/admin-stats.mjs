export const config = { runtime: "edge" };

import { verifyAdminToken } from "./_lib/adminAuth.mjs";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function kvCommand(pathSegments) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const url = `${KV_URL}/${pathSegments.map(encodeURIComponent).join("/")}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function handler(request) {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const isValid = await verifyAdminToken(token);
  if (!isValid) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!KV_URL || !KV_TOKEN) {
    return Response.json(
      {
        kvConfigured: false,
        totalVisits: 0,
        popularTools: [],
        notice:
          "Vercel KV belum disetup, jadi statistik pengunjung belum tersimpan. Tambahkan KV database dari dashboard Vercel (Storage > Create Database > KV)."
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  const [visitsResult, toolsResult] = await Promise.all([
    kvCommand(["get", "stats:visits"]),
    kvCommand(["hgetall", "stats:tools"])
  ]);

  const totalVisits = Number(visitsResult?.result || 0);

  // Upstash REST API balikin HGETALL sebagai array flat:
  // [field1, value1, field2, value2, ...]
  const rawTools = Array.isArray(toolsResult?.result) ? toolsResult.result : [];
  const popularTools = [];
  for (let i = 0; i < rawTools.length; i += 2) {
    popularTools.push({
      tool: rawTools[i],
      count: Number(rawTools[i + 1] || 0)
    });
  }
  popularTools.sort((a, b) => b.count - a.count);

  return Response.json(
    { kvConfigured: true, totalVisits, popularTools },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

