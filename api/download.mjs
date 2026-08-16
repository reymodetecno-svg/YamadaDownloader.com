export const config = { runtime: "edge" };

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Request JSON tidak valid." }, { status: 400 }); }

  const url = String(body?.url || "").trim();
  const shouldDownload = body?.download === true;
  const mediaIndex = Number.isInteger(body?.mediaIndex) ? body.mediaIndex : 0;

  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ error: "URL video tidak valid." }, { status: 400 });
  }

  const apiBase = process.env.DOWNLOADER_API_URL || "https://api.nexray.eu.cc/downloader/aio";

  try {
    const apiUrl = `${apiBase}?url=${encodeURIComponent(url)}`;
    const upstream = await fetch(apiUrl, {
      method: "GET",
      headers: { "Accept": "application/json", "User-Agent": "YamadaDownloader/1.0" }
    });
    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return Response.json({ error: data?.message || data?.error || `Nexray API error (${upstream.status})` }, { status: 502 });
    }
    if (!data?.status || !data?.result) {
      return Response.json({ error: data?.message || "API tidak menemukan media dari link tersebut." }, { status: 422 });
    }

    const result = data.result;
    const rawMedias = Array.isArray(result.medias) ? result.medias : [];
    const medias = rawMedias.filter(item => item?.url);
    const picker = medias.map((item, index) => ({
      url: item.url,
      type: item.type === "audio" ? "Audio" : `Video ${item.quality || index + 1}`,
      extension: item.extension || (item.type === "audio" ? "mp3" : "mp4"),
      quality: item.quality || "",
      width: item.width || null,
      height: item.height || null
    }));

    if (!picker.length) {
      return Response.json({ error: "API berhasil dipanggil tetapi tidak ada media download." }, { status: 422 });
    }

    // Jika ini permintaan "download" untuk satu format terpilih,
    // balas dengan URL media langsung, bukan daftar picker lagi.
    if (shouldDownload) {
      const chosen = picker[mediaIndex];
      if (!chosen || !chosen.url) {
        return Response.json({ error: "Format yang dipilih tidak ditemukan." }, { status: 422 });
      }
      return Response.json({
        url: chosen.url,
        extension: chosen.extension,
        title: result.title || "Video"
      }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    return Response.json({
      status: "picker",
      source: result.source || "unknown",
      title: result.title || "Video",
      thumbnail: result.thumbnail || "",
      author: result.author || "",
      duration: result.duration || 0,
      picker
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: `Tidak dapat terhubung ke Nexray API: ${error.message}` }, { status: 502 });
  }
}
