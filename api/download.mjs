export const config = {
  runtime: "edge"
};

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request JSON tidak valid." },
      { status: 400 }
    );
  }

  const url = String(body?.url || "").trim();
  const shouldDownload = body?.download === true;
  const mediaIndex = Number.isInteger(body?.mediaIndex)
    ? body.mediaIndex
    : 0;

  if (!/^https?:\/\//i.test(url)) {
    return Response.json(
      { error: "URL tidak valid." },
      { status: 400 }
    );
  }

  /*
   * Tentukan platform berdasarkan URL
   */
  const lowerUrl = url.toLowerCase();

  let apiBase = "";

  if (
    lowerUrl.includes("pinterest.com") ||
    lowerUrl.includes("pin.it")
  ) {
    apiBase =
      "https://api.nexray.eu.cc/downloader/pinterest";
  } else if (
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtu.be")
  ) {
    apiBase =
      process.env.DOWNLOADER_API_URL ||
      "https://api.nexray.eu.cc/downloader/aio";
  } else if (lowerUrl.includes("tiktok.com")) {
    apiBase =
      process.env.DOWNLOADER_API_URL ||
      "https://api.nexray.eu.cc/downloader/aio";
  } else if (lowerUrl.includes("instagram.com")) {
    apiBase =
      process.env.DOWNLOADER_API_URL ||
      "https://api.nexray.eu.cc/downloader/aio";
  } else {
    apiBase =
      process.env.DOWNLOADER_API_URL ||
      "https://api.nexray.eu.cc/downloader/aio";
  }

  try {
    const apiUrl =
      `${apiBase}?url=${encodeURIComponent(url)}`;

    const upstream = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "YamadaDownloader/2.0"
      }
    });

    const data = await upstream
      .json()
      .catch(() => null);

    if (!upstream.ok) {
      return Response.json(
        {
          error:
            data?.message ||
            data?.error ||
            `Nexray API error (${upstream.status})`
        },
        { status: 502 }
      );
    }

    /*
     * Normalisasi response API
     */

    const result =
      data?.result ||
      data?.data ||
      data;

    /*
     * Ambil media dari berbagai kemungkinan
     * response Nexray.
     */

    let rawMedias = [];

    if (Array.isArray(result?.medias)) {
      rawMedias = result.medias;
    } else if (Array.isArray(result?.media)) {
      rawMedias = result.media;
    } else if (Array.isArray(result?.downloads)) {
      rawMedias = result.downloads;
    } else if (Array.isArray(data?.medias)) {
      rawMedias = data.medias;
    } else if (Array.isArray(data?.downloads)) {
      rawMedias = data.downloads;
    }

    /*
     * Kalau API Pinterest langsung mengembalikan URL,
     * masukkan sebagai satu media.
     */

    if (!rawMedias.length) {
      const directUrl =
        result?.url ||
        result?.download ||
        result?.downloadUrl ||
        data?.url ||
        data?.download ||
        data?.downloadUrl;

      if (directUrl) {
        rawMedias = [
          {
            url: directUrl,
            type: "Video",
            extension: "mp4",
            quality: result?.quality || ""
          }
        ];
      }
    }

    /*
     * Filter media valid
     */

    const medias = rawMedias.filter(
      item =>
        item &&
        (
          item.url ||
          item.download ||
          item.downloadUrl ||
          item.link
        )
    );

    const picker = medias.map((item, index) => {
      const mediaUrl =
        item.url ||
        item.download ||
        item.downloadUrl ||
        item.link;

      let extension =
        item.extension ||
        item.ext ||
        "";

      if (!extension) {
        extension =
          item.type === "audio"
            ? "mp3"
            : "mp4";
      }

      return {
        url: mediaUrl,

        type:
          item.type === "audio"
            ? "Audio"
            : item.type === "image"
            ? "Image"
            : "Video",

        extension,

        quality:
          item.quality ||
          item.resolution ||
          "",

        width:
          item.width ||
          null,

        height:
          item.height ||
          null
      };
    });

    if (!picker.length) {
      return Response.json(
        {
          error:
            data?.message ||
            data?.error ||
            "API berhasil dipanggil tetapi tidak menemukan media download."
        },
        { status: 422 }
      );
    }

    /*
     * DOWNLOAD MEDIA YANG DIPILIH
     */

    if (shouldDownload) {
      const chosen = picker[mediaIndex];

      if (!chosen?.url) {
        return Response.json(
          {
            error:
              "Format yang dipilih tidak ditemukan."
          },
          { status: 422 }
        );
      }

      return Response.json(
        {
          url: chosen.url,
          extension: chosen.extension,
          title:
            result?.title ||
            result?.name ||
            "Pinterest"
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    }

    /*
     * RESPONSE KE FRONTEND
     */

    return Response.json(
      {
        status: "picker",

        source:
          result?.source ||
          "pinterest",

        title:
          result?.title ||
          result?.name ||
          "Pinterest",

        thumbnail:
          result?.thumbnail ||
          result?.thumb ||
          result?.image ||
          "",

        author:
          result?.author ||
          result?.username ||
          "",

        duration:
          result?.duration ||
          0,

        picker
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    console.error(
      "Nexray API Error:",
      error
    );

    return Response.json(
      {
        error:
          `Tidak dapat terhubung ke Nexray API: ${error.message}`
      },
      { status: 502 }
    );
  }
}
