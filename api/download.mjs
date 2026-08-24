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

  if (!url || !/^https?:\/\//i.test(url)) {
    return Response.json(
      { error: "URL tidak valid." },
      { status: 400 }
    );
  }

  const lowerUrl = url.toLowerCase();

  const isPinterest =
    lowerUrl.includes("pinterest.com") ||
    lowerUrl.includes("pin.it");

  /*
   * Pinterest menggunakan endpoint khusus.
   * YouTube/TikTok/Instagram tetap menggunakan
   * DOWNLOADER_API_URL seperti sebelumnya.
   */
  const apiBase = isPinterest
    ? "https://api.nexray.eu.cc/downloader/pinterest"
    : (
        process.env.DOWNLOADER_API_URL ||
        "https://api.nexray.eu.cc/downloader/aio"
      );

  try {
    const apiUrl =
      `${apiBase}?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();

    // Jangan biarkan frontend loading selamanya.
    const timeout = setTimeout(() => {
      controller.abort();
    }, 30000);

    let upstream;

    try {
      upstream = await fetch(apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "YamadaDownloader/1.0"
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = await upstream.text();

    let data = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

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

    if (!data) {
      return Response.json(
        {
          error:
            "API Pinterest tidak mengembalikan JSON yang valid."
        },
        { status: 502 }
      );
    }

    /*
     * ============================
     * PINTEREST
     * ============================
     */

    if (isPinterest) {
      const result =
        data?.result ||
        data?.data ||
        data;

      let medias = [];

      /*
       * Kemungkinan response:
       *
       * result.medias
       * result.media
       * result.downloads
       * data.medias
       * data.media
       * data.downloads
       */

      if (Array.isArray(result?.medias)) {
        medias = result.medias;
      } else if (Array.isArray(result?.media)) {
        medias = result.media;
      } else if (Array.isArray(result?.downloads)) {
        medias = result.downloads;
      } else if (Array.isArray(data?.medias)) {
        medias = data.medias;
      } else if (Array.isArray(data?.media)) {
        medias = data.media;
      } else if (Array.isArray(data?.downloads)) {
        medias = data.downloads;
      }

      /*
       * Kalau API mengembalikan satu URL langsung.
       */

      if (!medias.length) {
        const directUrl =
          result?.url ||
          result?.download ||
          result?.downloadUrl ||
          result?.video ||
          result?.videoUrl ||
          data?.url ||
          data?.download ||
          data?.downloadUrl ||
          data?.video ||
          data?.videoUrl;

        if (directUrl) {
          medias = [
            {
              url: directUrl,
              type: "Video",
              extension: "mp4"
            }
          ];
        }
      }

      /*
       * Normalisasi media
       */

      const picker = medias
        .map((item) => {
          if (typeof item === "string") {
            return {
              url: item,
              type: "Video",
              extension: "mp4",
              quality: ""
            };
          }

          const mediaUrl =
            item?.url ||
            item?.download ||
            item?.downloadUrl ||
            item?.link ||
            item?.video ||
            item?.videoUrl;

          if (!mediaUrl) {
            return null;
          }

          const type =
            String(item?.type || "").toLowerCase();

          const extension =
            item?.extension ||
            item?.ext ||
            (
              type.includes("audio")
                ? "mp3"
                : "mp4"
            );

          return {
            url: mediaUrl,

            type:
              type.includes("audio")
                ? "Audio"
                : type.includes("image")
                ? "Image"
                : "Video",

            extension,

            quality:
              item?.quality ||
              item?.resolution ||
              "",

            width:
              item?.width || null,

            height:
              item?.height || null
          };
        })
        .filter(Boolean);

      if (!picker.length) {
        return Response.json(
          {
            error:
              data?.message ||
              data?.error ||
              "Pinterest tidak memiliki media yang bisa didownload."
          },
          { status: 422 }
        );
      }

      /*
       * Download media yang dipilih
       */

      if (shouldDownload) {
        const selected = picker[mediaIndex];

        if (!selected?.url) {
          return Response.json(
            {
              error:
                "Media Pinterest yang dipilih tidak ditemukan."
            },
            { status: 422 }
          );
        }

        return Response.json(
          {
            url: selected.url,
            extension:
              selected.extension || "mp4",
            title:
              result?.title ||
              result?.name ||
              "Pinterest"
          },
          { status: 200 }
        );
      }

      /*
       * Kirim ke frontend
       */

      return Response.json(
        {
          status: "picker",

          source: "pinterest",

          title:
            result?.title ||
            result?.name ||
            "Pinterest Video",

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
    }

    /*
     * ============================
     * YOUTUBE / TIKTOK / INSTAGRAM
     * ============================
     *
     * Bagian ini sengaja dibuat sama
     * seperti sistem lama kamu.
     */

    if (!data?.status || !data?.result) {
      return Response.json(
        {
          error:
            data?.message ||
            "API tidak menemukan media dari link tersebut."
        },
        { status: 422 }
      );
    }

    const result = data.result;

    const rawMedias =
      Array.isArray(result.medias)
        ? result.medias
        : [];

    const medias =
      rawMedias.filter(item => item?.url);

    const picker =
      medias.map((item, index) => ({
        url: item.url,

        type:
          item.type === "audio"
            ? "Audio"
            : `Video ${item.quality || index + 1}`,

        extension:
          item.extension ||
          (
            item.type === "audio"
              ? "mp3"
              : "mp4"
          ),

        quality:
          item.quality || "",

        width:
          item.width || null,

        height:
          item.height || null
      }));

    if (!picker.length) {
      return Response.json(
        {
          error:
            "API berhasil dipanggil tetapi tidak ada media download."
        },
        { status: 422 }
      );
    }

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
            result.title || "Video"
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        status: "picker",

        source:
          result.source || "unknown",

        title:
          result.title || "Video",

        thumbnail:
          result.thumbnail || "",

        author:
          result.author || "",

        duration:
          result.duration || 0,

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
      "Downloader Error:",
      error
    );

    if (error?.name === "AbortError") {
      return Response.json(
        {
          error:
            "API terlalu lama merespons. Silakan coba lagi."
        },
        { status: 504 }
      );
    }

    return Response.json(
      {
        error:
          `Tidak dapat terhubung ke Nexray API: ${error.message}`
      },
      { status: 502 }
    );
  }
}
