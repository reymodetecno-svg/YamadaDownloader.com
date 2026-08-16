const CONFIG = {
  whatsappChannel: "https://whatsapp.com/channel/0029Vb87O3oF6smw9uLgOD0U",
  customerService: "https://wa.me/6283869485575",
  // Vercel Function akan membaca DOWNLOADER_API_URL dari environment.
  downloadEndpoint: "/api/download"
};

const tools = {
  youtube: {
    title: "YouTube Downloader",
    desc: "Download video YouTube dan Shorts dengan link publik.",
    icon: "▶"
  },
  tiktok: {
    title: "TikTok Downloader",
    desc: "Simpan video TikTok dari link publik yang kamu masukkan.",
    icon: "♪"
  },
  instagram: {
    title: "Instagram Downloader",
    desc: "Download Reels atau video Instagram dari link publik.",
    icon: "◎"
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
  $("#videoUrl").placeholder = `Tempel link ${name === "youtube" ? "YouTube" : name === "tiktok" ? "TikTok" : "Instagram"} di sini...`;
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
    const response = await fetch(CONFIG.downloadEndpoint, {
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
}  // <-- TAMBAHKAN INI

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

  const mediaPreview = items[0].url
    ? `
      <video
        controls
        playsinline
        preload="metadata"
        style="width:100%;max-height:420px;border-radius:14px;margin-top:12px;background:#000"
        src="${escapeAttr(items[0].url)}">
      </video>
    `
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
){
  if(!originalUrl){
    showToast("Link video tidak ditemukan.");
    return;
  }

  const originalLabel = button.innerHTML;

  button.disabled = true;
  button.innerHTML = "<span>⏳ Memproses...</span>";

  try{
    const response = await fetch(CONFIG.downloadEndpoint, {
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

    if(!response.ok){
      throw new Error(
        data.error || `HTTP ${response.status}`
      );
    }

    if(!data.url){
      throw new Error("URL download tidak diberikan API.");
    }

    /*
     * PENTING:
     * Jangan fetch URL googlevideo.com dari Vercel.
     * Browser langsung membuka URL media.
     */
    const link = document.createElement("a");

    link.href = data.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();
    link.remove();

    showToast("✔ Download dimulai!");
  }catch(error){
    console.error("Download error:", error);

    showToast(`Gagal: ${error.message}`);
  }finally{
    button.disabled = false;
    button.innerHTML = originalLabel;
  }
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

document.addEventListener("DOMContentLoaded", () => {
  
  const notice = $("#waNotice");
  $("#waLink").href = CONFIG.whatsappChannel;
  $("#csLink").href = CONFIG.customerService;
  setTimeout(() => notice.classList.add("show"), 1550);
  setTimeout(() => notice.classList.remove("show"), 6550);
  $("#closeNotice").addEventListener("click", () => notice.classList.remove("show"));

  $$(".nav-item, [data-page]").forEach(el => {
    el.addEventListener("click", e => {
      const page = el.dataset.page;
      if(page) setPage(page);
    });
  });

  $$(".tool-card").forEach(card => card.addEventListener("click", () => openTool(card.dataset.tool)));
  $("#pasteBtn").addEventListener("click", pasteUrl);
  $("#downloadBtn").addEventListener("click", downloadVideo);
  $("#videoUrl").addEventListener("keydown", e => { if(e.key === "Enter") downloadVideo(); });

  if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>{});
  initPWA();
});

// =========================
// MODE GELAP / MODE CERAH
// =========================

const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");

// Ambil tema yang tersimpan
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
  document.body.classList.add("dark-mode");

  if (themeIcon) {
    themeIcon.textContent = "🌙";
  }
} else {
  document.body.classList.remove("dark-mode");

  if (themeIcon) {
    themeIcon.textContent = "☀️";
  }
}

// Tombol ganti tema
if (themeToggle) {
  themeToggle.addEventListener("click", function () {

    document.body.classList.toggle("dark-mode");

    const darkMode =
      document.body.classList.contains("dark-mode");

    localStorage.setItem(
      "theme",
      darkMode ? "dark" : "light"
    );

    if (themeIcon) {
      themeIcon.textContent =
        darkMode ? "🌙" : "☀️";
    }

  });
}
