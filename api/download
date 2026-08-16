export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = req.body || {};
  const url = String(body.url || "").trim();
  const shouldDownload = body.download === true;
  const mediaIndex = Number.isInteger(body.mediaIndex) ? body.mediaIndex : 0;

  if (!/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "URL video tidak valid." });
    return;
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
      res.status(502).json({ error: data?.message || data?.error || `Nexray API error (${upstream.status})` });
      return;
    }
    if (!data?.status || !data?.result) {
      res.status(422).json({ error: data?.message || "API tidak menemukan media dari link tersebut." });
      return;
    }

    const result = data.result;
    const rawMedias = Array.isArray(result.medias) ? result.medias : [];
    const medias = rawMedias.filter(item => item?.url);

    if (shouldDownload) {
      const media = medias[mediaIndex];

      if (!media?.url) {
        res.status(422).json({ error: "Format media yang dipilih tidak tersedia." });
        return;
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
        res.status(502).json({
          error: `Gagal mengambil file media (${mediaResponse.status}) dari ${hostInfo || "sumber tidak diketahui"}. Link dari API downloader mungkin sudah tidak valid.`
        });
        return;
      }

      const extension = media.extension || (media.type === "audio" ? "mp3" : "mp4");

      const title = String(result.title || "YamadaDownloader")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100) || "YamadaDownloader";

      const filename = `${title}.${extension}`;

      // Node.js runtime tidak bisa langsung pipe web-stream ke res,
      // jadi kita buffer dulu isi filenya baru dikirim.
      const arrayBuffer = await mediaResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader(
        "Content-Type",
        mediaResponse.headers.get("content-type") || (extension === "mp3" ? "audio/mpeg" : "video/mp4")
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename.replace(/"/g, "")}"`);
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(buffer);
      return;
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
      res.status(422).json({ error: "API berhasil dipanggil tetapi tidak ada media download." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      status: "picker",
      source: result.source || "unknown",
      title: result.title || "Video",
      thumbnail: result.thumbnail || "",
      author: result.author || "",
      duration: result.duration || 0,
      picker
    });
  } catch (error) {
    res.status(502).json({ error: `Tidak dapat terhubung ke Nexray API: ${error.message}` });
  }
}

