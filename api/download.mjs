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

    if (shouldDownload) {
      const media = medias[mediaIndex];

      if (!media?.url) {
        return Response.json({ error: "Format media yang dipilih tidak tersedia." }, { status: 422 });
      }

      const mediaResponse = await fetch(media.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*",
          "Referer": (result.source || "").toLowerCase().includes("tiktok")
            ? "https://www.tiktok.com/"
            : (result.source || "").toLowerCase().includes("instagram")
              ? "https://www.instagram.com/"
              : (result.source || "").toLowerCase().includes("youtube")
                ? "https://www.youtube.com/"
                : ""
        }
      });

      if (!mediaResponse.ok || !mediaResponse.body) {
        let hostInfo = "";
        try { hostInfo = new URL(media.url).host; } catch {}
        return Response.json(
          { error: `Gagal mengambil file media (${mediaResponse.status}) dari ${hostInfo || "sumber tidak diketahui"}. Link dari API downloader mungkin sudah tidak valid.` },
          { status: 502 }
        );
      }

      const extension = media.extension || (media.type === "audio" ? "mp3" : "mp4");

      const title = String(result.title || "YamadaDownloader")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100) || "YamadaDownloader";

      const filename = `${title}.${extension}`;

      return new Response(mediaResponse.body, {
        status: 200,
        headers: {
          "Content-Type":
            mediaResponse.headers.get("content-type") ||
            (extension === "mp3" ? "audio/mpeg" : "video/mp4"),
          "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
          "Cache-Control": "no-store"
        }
      });
    }

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

    return Response.json({
      status: "picker",
      source: result.source || "unknown",
      title: result.title || "Video",
      thumbnail: result.thumbnail || "",
      author: result.author || "",
      duration: result.duration || 0,
      picker
    }, { status: 200, headers: {
