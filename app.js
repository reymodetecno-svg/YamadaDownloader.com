// Daftarkan Service Worker supaya web bisa diinstall sebagai aplikasi (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

const CONFIG = {
  whatsappChannel: "https://whatsapp.com/channel/0029Vb87O3oF6smw9uLgOD0U",
  customerService: "https://wa.me/6283869485575",
  // Vercel Function akan membaca DOWNLOADER_API_URL dari environment.
  downloadEndpoint: "/api/download",
  // Endpoint khusus Pinterest (format respons API-nya beda dari aio).
  pinterestEndpoint: "/api/download-pinterest",
  // Proxy same-origin supaya file video langsung kedownload (attachment),
  // bukan cuma dibuka sebagai halaman/pemutar video.
  proxyEndpoint: "/api/fetch"
};

const tools = {
  youtube: {
    title: "YouTube Downloader",
    desc: "Download video YouTube dan Shorts dengan link publik.",
    icon: "★"
  },
  tiktok: {
    title: "TikTok Downloader",
    desc: "Simpan video TikTok dari link publik yang kamu masukkan.",
    icon:  "𖹭"
  },
  instagram: {
    title: "Instagram Downloader",
    desc: "Download Reels atau video Instagram dari link publik.",
    icon:  "𖦹"
  },
  pinterest: {
    title: "Pinterest Downloader",
    desc: "Download video atau gambar Pinterest dari link publik.",
    icon:  "📌"
  }
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function showToast(message){
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function showBigNotice(message){
  const el = $("#bigNotice");
  if(!el) return;
  const text = $("#bigNoticeText");
  if(text) text.textContent = message || "Sudah Didownload silahkan cek Chrome";
  el.classList.add("show");
  clearTimeout(window.bigNoticeTimer);
  window.bigNoticeTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function setPage(route){
  $$(".page").forEach(p => p.classList.toggle("active", p.dataset.route === route));
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.page === route));
  window.scrollTo({top:0, behavior:"smooth"});
}

function openTool(name){
  const tool = tools[name];
  $("#toolTitle").textContent = tool.title;
  $("#toolDescription").textContent = tool.desc;
  $("#toolBigIcon").textContent = tool.icon;
  $("#videoUrl").value = "";
  $("#resultBox").hidden = true;
  $("#resultBox").className = "result-box";

  const labelMap = {
    youtube: "YouTube",
    tiktok: "TikTok",
    instagram: "Instagram",
    pinterest: "Pinterest"
  };
  $("#videoUrl").placeholder = `Tempel link ${labelMap[name] || ""} di sini...`;

  // Simpan tool aktif supaya downloadVideo() tahu harus panggil endpoint yang mana.
  $("#downloadBtn").dataset.activeTool = name;

  setPage("tool");
  setTimeout(() => $("#videoUrl").focus(), 300);
}

async function pasteUrl(){
  try{
    const text = await navigator.clipboard.readText();
    if(!text) throw new Error();
    $("#videoUrl").value = text;
    showToast("Link berhasil ditempel.");
  }catch{
    showToast("Clipboard tidak bisa dibaca. Tempel link secara manual.");
  }
}

function getActiveDownloadEndpoint(){
  const activeTool = $("#downloadBtn")?.dataset.activeTool;
  return activeTool === "pinterest" ? CONFIG.pinterestEndpoint : CONFIG.downloadEndpoint;
}

async function downloadVideo(){
  const input = $("#videoUrl");
  const url = input.value.trim();
  const box = $("#resultBox");
  const btn = $("#downloadBtn");

  if(!url || !/^https?:\/\//i.test(url)){
    box.hidden = false;
    box.className = "result-box error";
    box.innerHTML = "<strong>Link belum valid.</strong><br>Masukkan URL video yang diawali http:// atau https://.";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = "<span>⏳</span> Memproses...";
  box.hidden = false;
  box.className = "result-box";
  box.innerHTML = "Sedang mengambil informasi video...";

  try{
    const response = await fetch(getActiveDownloadEndpoint(), {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({url})
    });

    const data = await response.json().catch(() => ({}));
    if(!response.ok || data.error){
      throw new Error(data.error || "Downloader API belum dikonfigurasi atau link tidak dapat diproses.");
    }

    renderDownloadResult(data);

   }catch(error){
    console.error("Download error:", error);

    box.className = "result-box error";
    box.innerHTML =
      `<strong>Download belum dapat diproses.</strong><br>` +
      `${escapeHtml(error.message)}<br>` +
      `<small>Pastikan DOWNLOADER_API_URL sudah diisi di Vercel dan API downloader kamu aktif.</small>`;
  }finally{
    btn.disabled = false;
    btn.innerHTML = "<span>↓</span> Download Video";
  }
}

function renderDownloadResult(data){
  const box = $("#resultBox");
  box.className = "result-box";

  if(data.status !== "picker" || !Array.isArray(data.picker)){
    throw new Error("API tidak mengembalikan pilihan media.");
  }

  const items = data.picker.filter(item => item?.url);

  if(!items.length){
    throw new Error("Tidak ada media yang bisa diunduh.");
  }

  const title = data.title
    ? `<div style="margin-bottom:8px">
        <strong>${escapeHtml(data.title)}</strong>
      </div>`
    : "";

  const author = data.author
    ? `<small>Creator: ${escapeHtml(data.author)}</small>`
    : "";

  const firstItem = items[0];
  const isImage = /gambar|image|jpg|jpeg|png|webp/i.test(
    `${firstItem?.type || ""} ${firstItem?.extension || ""}`
  );

  const mediaPreview = firstItem?.url
    ? (isImage
        ? `
          <img
            src="${escapeAttr(firstItem.url)}"
            alt="${escapeAttr(data.title || "Preview")}"
            style="width:100%;max-height:420px;object-fit:contain;border-radius:14px;margin-top:12px;background:#000"
          >
        `
        : `
          <video
            controls
            playsinline
            preload="metadata"
            style="width:100%;max-height:420px;border-radius:14px;margin-top:12px;background:#000"
            src="${escapeAttr(firstItem.url)}">
          </video>
        `)
    : "";

  box.innerHTML = `
    ${title}
    ${author}

    ${mediaPreview}

    <div style="margin-top:14px">
      <strong>Pilih format</strong>
    </div>

    <div class="download-list" style="margin-top:8px">
      ${items.map((item, index) => `
        <button
          type="button"
          class="download-option"
          data-media-index="${index}"
        >
          <span>
            ${escapeHtml(item.type || "Media")}
            ${item.quality ? ` • ${escapeHtml(item.quality)}` : ""}
          </span>

          <span>Download →</span>
        </button>
      `).join("")}
    </div>
  `;

  $$(".download-option[data-media-index]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.mediaIndex);

      downloadSelectedMedia(
        $("#videoUrl").value.trim(),
        index,
        data.title || "YamadaDownloader",
        items[index]?.extension || "mp4",
        button
      );
    });
  });
}

async function downloadSelectedMedia(
  originalUrl,
  mediaIndex,
  title,
  extension,
  button
) {
  if (!originalUrl) {
    showToast("Link video tidak ditemukan.");
    return;
  }

  const originalLabel = button.innerHTML;

  button.disabled = true;
  button.innerHTML = "<span>⏳ Memproses...</span>";

  try {
    const response = await fetch(getActiveDownloadEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: originalUrl,
        download: true,
        mediaIndex: mediaIndex
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.error || `HTTP ${response.status}`
      );
    }

    if (!data.url) {
      throw new Error("URL download tidak diberikan API.");
    }

    // Buat nama file
    const safeTitle = String(title || "YamadaDownloader")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim();

    const safeExtension = String(extension || "mp4")
      .replace(/[^a-zA-Z0-9]/g, "");

    const fileName =
      `${safeTitle || "YamadaDownloader"}.${safeExtension || "mp4"}`;

    // PENTING: jangan arahkan <a> langsung ke URL CDN pihak ketiga.
    // URL CDN itu cross-origin, jadi atribut `download` diabaikan browser,
    // linknya cuma "dibuka" seperti halaman video biasa -> muncul dialog
    // native "Download file lagi?" yang bikin bingung.
    // Solusinya: proxy file itu lewat /api/fetch (same-origin) dengan
    // header Content-Disposition: attachment, supaya begitu diklik file
    // LANGSUNG kedownload tanpa dialog konfirmasi tambahan.
    const proxyUrl =
      `${CONFIG.proxyEndpoint}?url=${encodeURIComponent(data.url)}` +
      `&filename=${encodeURIComponent(fileName)}`;

    const link = document.createElement("a");

    link.href = proxyUrl;
    link.download = fileName;

    // JANGAN gunakan target="_blank"
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    showToast("✔ Download dimulai!");
    showBigNotice("Sudah Didownload, silahkan cek Chrome");

  } catch (error) {
    console.error("Download error:", error);

    showToast(`Gagal: ${error.message}`);

  } finally {
    button.disabled = false;
    button.innerHTML = originalLabel;
  }
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function escapeAttr(value){ return escapeHtml(value); }

function initPWA(){
  let deferredPrompt;
  const installBtn = $("#installBtn");
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
}

function initDeviceStatus() {
  const typeEl = document.querySelector("#deviceType");
  const statusEl = document.querySelector("#deviceBatteryStatus");

  // Kalau elemen tidak ada, jangan hentikan JavaScript lainnya
  if (!typeEl && !statusEl) return;

  // =========================
  // DETEKSI PERANGKAT
  // =========================
  const ua = navigator.userAgent || "";

  let deviceLabel = "Desktop";

  if (
    /iPad|Tablet/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua))
  ) {
    deviceLabel = "Tablet";
  } else if (
    /Mobi|Android|iPhone|iPod/i.test(ua)
  ) {
    deviceLabel = "Handphone";
  }

  if (typeEl) {
    typeEl.textContent = deviceLabel;
  }

  // =========================
  // STATUS BATERAI
  // =========================
  function updateBattery(battery) {
    if (!statusEl) return;

    const level = Number(battery.level);

    // Cegah NaN / nilai aneh
    if (!Number.isFinite(level)) {
      statusEl.textContent = "Tidak tersedia";
      return;
    }

    const percent = Math.max(
      0,
      Math.min(100, Math.round(level * 100))
    );

    // Reset class
    statusEl.classList.remove("low", "medium");

    if (percent <= 20) {
      statusEl.classList.add("low");
    } else if (percent <= 50) {
      statusEl.classList.add("medium");
    }

    if (battery.charging) {
      statusEl.textContent =
        `${percent}% • Mengisi daya`;
    } else {
      statusEl.textContent =
        `${percent}% • Tidak mengisi`;
    }
  }

  // =========================
  // CEK BATTERY API
  // =========================
  if (
    typeof navigator.getBattery !== "function"
  ) {
    if (statusEl) {
      statusEl.textContent = "Tidak tersedia";
    }

    return;
  }

  navigator
    .getBattery()
    .then(function (battery) {
      if (!battery) {
        if (statusEl) {
          statusEl.textContent = "Tidak tersedia";
        }
        return;
      }

      // Tampilkan status awal
      updateBattery(battery);

      // Update ketika persentase berubah
      battery.addEventListener(
        "levelchange",
        function () {
          updateBattery(battery);
        }
      );

      // Update ketika mulai/berhenti charging
      battery.addEventListener(
        "chargingchange",
        function () {
          updateBattery(battery);
        }
      );
    })
    .catch(function () {
      if (statusEl) {
        statusEl.textContent = "Tidak tersedia";
      }
    });
}

// =================================
// YAMADA DOWNLOADER LOADING SCREEN
// =================================

function initLoadingScreen(){

  const loadingScreen = document.getElementById("loadingScreen");
  const loadingText = document.getElementById("loadingText");
  const loadingBar = document.getElementById("loadingBar");
  const loadingPercent = document.getElementById("loadingPercent");

  if(!loadingScreen || !loadingText || !loadingBar){
    return;
  }

  const texts = [
    "YAMADA",
    "ADALAH",
    "TEMPAT",
    "MEDOWNLOAD",
    "LINK VIDEO",
    "DAN LAINNYA"
  ];

  let progress = 0;
  let textIndex = 0;

  // Ganti text setiap beberapa saat
  const textInterval = setInterval(() => {

    textIndex++;

    if(textIndex >= texts.length){
      textIndex = 0;
    }

    loadingText.classList.remove("change");

    // restart animation
    void loadingText.offsetWidth;

    loadingText.textContent = texts[textIndex];
    loadingText.classList.add("change");

  }, 500);


  // Loading progress
  const progressInterval = setInterval(() => {

    progress += Math.random() * 5 + 2;

    if(progress >= 100){
      progress = 100;
    }

    loadingBar.style.width = `${progress}%`;

    if(loadingPercent){
      loadingPercent.textContent = `${Math.floor(progress)}%`;
    }

    if(progress >= 100){

      clearInterval(progressInterval);
      clearInterval(textInterval);

      setTimeout(() => {

        loadingScreen.classList.add("hide");

        setTimeout(() => {
          loadingScreen.remove();
        }, 750);

      }, 350);

    }

  }, 100);

}

document.addEventListener("DOMContentLoaded", () => {

  // =========================
  // LOADING SCREEN
  // =========================

  initLoadingScreen();

  // =========================
  // WHATSAPP NOTICE
  // =========================

  const notice = $("#waNotice");
  const waLink = $("#waLink");
  const csLink = $("#csLink");

  if (waLink) {
    waLink.href = CONFIG.whatsappChannel;
  }

  if (csLink) {
    csLink.href = CONFIG.customerService;
  }

  if (notice) {
    setTimeout(() => notice.classList.add("show"), 1000);
    setTimeout(() => notice.classList.remove("show"), 6000);
  }

  const closeNotice = $("#closeNotice");

  if (closeNotice) {
    closeNotice.addEventListener("click", () => {
      notice?.classList.remove("show");
    });
  }

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;
      if (!page) return;
      setPage(page);
    });
  });

    const bigNotice = $("#bigNotice");
  if (bigNotice) {
    bigNotice.addEventListener("click", () => bigNotice.classList.remove("show"));
  }

  document.querySelectorAll(".tool-card").forEach(card => {
    card.addEventListener("click", () => {
      const tool = card.dataset.tool;
      if (!tool) return;
      openTool(tool);
    });
  });

  document.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;
      if (page) {
        setPage(page);
      }
    });
  });

  const pasteBtn = $("#pasteBtn");
  if (pasteBtn) {
    pasteBtn.addEventListener("click", pasteUrl);
  }

  const downloadBtn = $("#downloadBtn");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", downloadVideo);
  }

  const videoUrl = $("#videoUrl");
  if (videoUrl) {
    videoUrl.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        downloadVideo();
      }
    });
  }

  const themeToggle = $("#themeToggle");
  const themeIcon = $("#themeIcon");

  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("theme");
  } catch {}

  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
    if (themeIcon) themeIcon.textContent = "🌙";
  } else {
    document.body.classList.remove("dark-mode");
    if (themeIcon) themeIcon.textContent = "☀️";
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const dark = document.body.classList.contains("dark-mode");
      try {
        localStorage.setItem("theme", dark ? "dark" : "light");
      } catch {}
      if (themeIcon) themeIcon.textContent = dark ? "🌙" : "☀️";
    });
  }

  initDeviceStatus();
  initPWA();
});

// ========================================
// YAMADA REMOVE BACKGROUND
// ========================================

let removeBgSelectedFile = null;


// Buka modal
function openRemoveBg() {

  const modal =
    document.getElementById(
      "removeBgModal"
    );

  if (!modal) return;

  modal.classList.add("active");
}


// Tutup modal
function closeRemoveBg() {

  const modal =
    document.getElementById(
      "removeBgModal"
    );

  if (!modal) return;

  modal.classList.remove("active");
}


// Pilih gambar
document.addEventListener(
  "change",
  function (event) {

    if (
      event.target.id !==
      "removeBgFile"
    ) {
      return;
    }

    const file =
      event.target.files?.[0];

    if (!file) return;

    removeBgSelectedFile =
      file;

    const preview =
      document.getElementById(
        "removeBgPreview"
      );

    const imageURL =
      URL.createObjectURL(file);

    preview.innerHTML = `
      <img
        src="${imageURL}"
        alt="Preview"
      >
    `;

    preview.style.display =
      "block";

  }
);


// Proses Remove BG
async function processRemoveBg() {

  const button =
    document.getElementById(
      "removeBgButton"
    );

  const status =
    document.getElementById(
      "removeBgStatus"
    );

  if (!removeBgSelectedFile) {

    status.textContent =
      "Pilih gambar terlebih dahulu.";

    status.className =
      "remove-bg-status error";

    return;
  }


  button.disabled = true;

  status.textContent =
    "Menghapus background...";

  status.className =
    "remove-bg-status";


  try {

    // File → Base64
    const base64 =
      await fileToBase64(
        removeBgSelectedFile
      );


    const response =
      await fetch(
        "/api/removebg",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            image: base64,

            imageName:
              removeBgSelectedFile.name
          })
        }
      );


    if (!response.ok) {

      let errorMessage =
        "Gagal memproses gambar.";

      try {

        const error =
          await response.json();

        errorMessage =
          error.error ||
          errorMessage;

      } catch {}

      throw new Error(
        errorMessage
      );
    }


    const blob =
      await response.blob();


    const resultURL =
      URL.createObjectURL(blob);


    status.textContent =
      "Background berhasil dihapus!";

    status.className =
      "remove-bg-status success";


    const preview =
      document.getElementById(
        "removeBgPreview"
      );


    preview.innerHTML = `
      <div class="remove-bg-result">

        <img
          src="${resultURL}"
          alt="Hasil Remove Background"
        >

        <a
               
          href="${resultURL}"
          download="yamada-removebg.png"
          class="remove-bg-button"
          onclick="showBigNotice('Sudah Didownload silahkan cek Chrome')"
          style="
            display:block;
            text-decoration:none;
            text-align:center;
          "
        >
          <i class="fas fa-download"></i>
          Download Hasil
        </a>

      </div>
    `;


  } catch (error) {

    console.error(
      "Remove BG Error:",
      error
    );

    status.textContent =
      error.message ||
      "Gagal menghapus background.";

    status.className =
      "remove-bg-status error";

  } finally {

    button.disabled = false;

  }

}


// File → Base64
function fileToBase64(file) {

  return new Promise(
    (resolve, reject) => {

      const reader =
        new FileReader();

      reader.onload =
        () => resolve(
          reader.result
        );

      reader.onerror =
        () => reject(
          new Error(
            "Gagal membaca gambar."
          )
        );

      reader.readAsDataURL(
        file
      );

    }
  );

}
