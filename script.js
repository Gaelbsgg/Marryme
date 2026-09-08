document.documentElement.classList.add("js-ready");

const config = window.SUPABASE_CONFIG || {};
const isConfigured = Boolean(config.url && config.anonKey && !config.url.includes("SEU-PROJETO") && !config.anonKey.includes("SUA_CHAVE"));
const supabase = isConfigured && window.supabase?.createClient ? window.supabase.createClient(config.url, config.anonKey) : null;
const mediaBucket = config.mediaBucket || "wedding-media";
const backupBucket = config.backupBucket || "wedding-media-backup";
const pendingPostSeconds = 60;
const deviceStorageKey = "weddingDeviceId";
const likedStorageKey = "weddingLikedItems";
let galleryItems = [];
let slideIndex = 0;
let featuredIndex = 0;

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("in");
  }), { threshold: 0.12 });
  revealItems.forEach((el) => observer.observe(el));
} else {
  revealItems.forEach((el) => el.classList.add("in"));
}

const formatDate = (value) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
const setStatus = (form, message, isError = false) => {
  const status = form?.querySelector(".form-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
};
const requireSupabase = (form) => {
  if (supabase) return true;
  setStatus(form, "Configure o arquivo supabase-config.js com a URL e a chave publica do Supabase.", true);
  return false;
};

const getDeviceId = () => {
  let id = localStorage.getItem(deviceStorageKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(deviceStorageKey, id);
  }
  return id;
};
const getDeviceName = () => {
  const ua = navigator.userAgent || "Dispositivo desconhecido";
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  return `${platform} - ${ua}`.slice(0, 240);
};
const getLikedItems = () => {
  try { return JSON.parse(localStorage.getItem(likedStorageKey) || "[]"); } catch { return []; }
};
const setLikedItems = (ids) => localStorage.setItem(likedStorageKey, JSON.stringify(ids));
const isLiked = (id) => getLikedItems().includes(id);

const getEngagement = async (mediaIds = []) => {
  if (!mediaIds.length || !supabase) return {};
  const { data } = await supabase.from("wedding_media_engagement").select("media_id, action").in("media_id", mediaIds);
  return (data || []).reduce((acc, item) => {
    acc[item.media_id] ||= { like: 0, share: 0, download: 0, comment: 0 };
    acc[item.media_id][item.action] = (acc[item.media_id][item.action] || 0) + 1;
    return acc;
  }, {});
};

const postIcons = {
  like: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg>'
};

const createStatsHtml = (item) => {
  const stats = item.stats || { like: 0, share: 0, download: 0, comment: 0 };
  return `<div class="post-stats" data-media-id="${escapeHtml(item.id)}">
    <button class="post-icon ${isLiked(item.id) ? "active" : ""}" type="button" data-like-media aria-label="Curtir">${postIcons.like}</button><span data-like-count>${stats.like || 0}</span>
    <button class="post-icon" type="button" data-share-media aria-label="Compartilhar">${postIcons.share}</button><span data-share-count>${stats.share || 0}</span>
    <button class="post-icon" type="button" data-download-media-public aria-label="Baixar">${postIcons.download}</button><span data-download-count>${stats.download || 0}</span>
    <button class="post-icon" type="button" data-toggle-comments aria-label="Comentários" aria-expanded="false">${postIcons.comment}</button><span data-comment-count>${stats.comment || 0}</span>
  </div>
  <div class="comments-panel" data-comments-panel hidden>
    <div class="comments-list" data-comments-list></div>
    <form class="comment-form" data-comment-form><input name="comment" placeholder="Adicionar comentário" required/><button class="btn btn-secondary" type="submit">Enviar</button></form>
  </div>`;
};
const createMediaCard = (item) => {
  const isVideo = item.media_type === "video";
  const media = isVideo ? `<video src="${escapeHtml(item.public_url)}" preload="metadata" controls playsinline></video>` : `<img loading="lazy" src="${escapeHtml(item.public_url)}" alt="${escapeHtml(item.caption || "Momento compartilhado")}"/>`;
  return `<article class="media-card" data-id="${escapeHtml(item.id)}" data-type="${item.media_type}" data-src="${escapeHtml(item.public_url)}" style="--ratio:1/1">${isVideo ? '<span class="video-badge">▶</span>' : ""}${media}<div><strong>${escapeHtml(item.guest_name)}</strong><p>${escapeHtml(item.caption || "Momento compartilhado com carinho.")}</p><small>${formatDate(item.created_at)}</small><div class="media-card-actions"><button class="btn btn-secondary" type="button" data-open-media>Abrir publicação</button></div>${createStatsHtml(item)}</div></article>`;
};

const fetchPublicMedia = async (limit) => {
  if (!supabase) return [];
  const query = supabase.from("wedding_media").select("id, guest_name, caption, file_path, backup_file_path, public_url, media_type, created_at").eq("is_public", true).order("created_at", { ascending: false });
  if (limit) query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  const stats = await getEngagement((data || []).map((item) => item.id));
  return (data || []).map((item) => ({ ...item, stats: stats[item.id] || { like: 0, share: 0, download: 0, comment: 0 } }));
};

const bindGalleryFilters = () => document.querySelectorAll(".filter-btn").forEach((button) => button.addEventListener("click", () => {
  const filter = button.dataset.filter;
  document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  document.querySelectorAll(".media-card").forEach((card) => { card.hidden = filter !== "all" && card.dataset.type !== filter; });
}));

const openSlide = (index) => {
  const modal = document.querySelector(".modal");
  if (!modal || !galleryItems.length) return;
  slideIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[slideIndex];
  const modalImg = modal.querySelector("img");
  const modalVideo = modal.querySelector("video");
  const modalTitle = modal.querySelector("h2");
  const modalText = modal.querySelector("p");
  const isVideo = item.media_type === "video";
  modalImg.hidden = isVideo;
  modalImg.src = isVideo ? "" : item.public_url;
  modalVideo.hidden = !isVideo;
  modalVideo.src = isVideo ? item.public_url : "";
  modalTitle.textContent = item.guest_name;
  modalText.textContent = item.caption || "Momento compartilhado com carinho.";
  modal.classList.add("open");
};
const bindGalleryModal = () => {
  document.querySelectorAll(".media-card [data-open-media]").forEach((button) => button.addEventListener("click", () => {
    const id = button.closest(".media-card")?.dataset.id;
    openSlide(Math.max(0, galleryItems.findIndex((item) => item.id === id)));
  }));
};

const updateStatInDom = (mediaId, action, delta) => {
  document.querySelectorAll(`[data-media-id="${CSS.escape(mediaId)}"]`).forEach((stats) => {
    const target = stats.querySelector(`[data-${action}-count]`);
    if (target) target.textContent = Math.max(0, Number(target.textContent || 0) + delta);
    if (action === "like") stats.querySelector("[data-like-media]")?.classList.toggle("active", delta > 0);
  });
};
const registerEngagement = async (mediaId, action, value = "") => {
  if (!supabase || !mediaId) return false;
  const { error } = await supabase.from("wedding_media_engagement").insert({ media_id: mediaId, action, device_id: getDeviceId(), device_name: getDeviceName(), value });
  return !error;
};
const loadComments = async (mediaId, panel) => {
  const list = panel?.querySelector("[data-comments-list]");
  if (!list || !supabase) return;
  list.innerHTML = '<p class="comments-status">Carregando comentários...</p>';
  const { data, error } = await supabase.from("wedding_media_engagement").select("value, created_at").eq("media_id", mediaId).eq("action", "comment").order("created_at", { ascending: true });
  if (error) { list.innerHTML = '<p class="comments-status">Não foi possível carregar os comentários.</p>'; return; }
  list.innerHTML = data?.length
    ? data.map((comment) => `<article class="comment-item"><p>${escapeHtml(comment.value)}</p><time datetime="${escapeHtml(comment.created_at)}">${formatDate(comment.created_at)}</time></article>`).join("")
    : '<p class="comments-status">Nenhum comentário ainda.</p>';
};
const bindPostActions = () => {
  document.addEventListener("dblclick", async (event) => {
    const card = event.target.closest(".media-card, .featured-slide");
    if (card?.dataset.id) await toggleLike(card.dataset.id);
  });
  document.addEventListener("click", async (event) => {
    const stats = event.target.closest(".post-stats");
    const mediaId = stats?.dataset.mediaId;
    if (event.target.closest("[data-like-media]")) await toggleLike(mediaId);
    const commentsButton = event.target.closest("[data-toggle-comments]");
    if (commentsButton && stats) {
      const panel = stats.nextElementSibling;
      const willOpen = panel?.hasAttribute("hidden");
      panel?.toggleAttribute("hidden", !willOpen);
      commentsButton.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) await loadComments(mediaId, panel);
    }
    if (event.target.closest("[data-share-media]")) await shareMedia(mediaId);
    if (event.target.closest("[data-download-media-public]")) await downloadMedia(mediaId);
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-comment-form]");
    if (!form) return;
    event.preventDefault();
    const panel = form.closest("[data-comments-panel]");
    const mediaId = panel?.previousElementSibling?.dataset.mediaId;
    const value = form.comment.value.trim();
    if (!value) return;
    if (await registerEngagement(mediaId, "comment", value)) {
      form.reset();
      updateStatInDom(mediaId, "comment", 1);
      await loadComments(mediaId, panel);
    }
  });
};
const toggleLike = async (mediaId) => {
  if (!mediaId) return;
  const liked = getLikedItems();
  if (liked.includes(mediaId)) {
    const { error } = await supabase.from("wedding_media_engagement").delete().eq("media_id", mediaId).eq("device_id", getDeviceId()).eq("action", "like");
    if (!error) { setLikedItems(liked.filter((id) => id !== mediaId)); updateStatInDom(mediaId, "like", -1); }
    return;
  }
  if (await registerEngagement(mediaId, "like")) { liked.push(mediaId); setLikedItems(liked); updateStatInDom(mediaId, "like", 1); }
};
const shareMedia = async (mediaId) => {
  const item = galleryItems.find((media) => media.id === mediaId);
  if (!item) return;
  if (navigator.share) await navigator.share({ title: item.caption || "Momento do casamento", url: item.public_url }).catch(() => {});
  else await navigator.clipboard?.writeText(item.public_url).catch(() => {});
  if (await registerEngagement(mediaId, "share")) updateStatInDom(mediaId, "share", 1);
};
const downloadMedia = async (mediaId) => {
  const item = galleryItems.find((media) => media.id === mediaId);
  if (!item || !supabase) return;
  const { data: file, error } = await supabase.storage.from(mediaBucket).download(item.file_path);
  if (error || !file) return;
  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = item.file_path?.split("/").pop() || "momento-casamento";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  if (await registerEngagement(mediaId, "download")) updateStatInDom(mediaId, "download", 1);
};
const loadGallery = async () => {
  const gallery = document.querySelector("[data-gallery-grid]");
  if (!gallery) return;
  if (!supabase) { gallery.innerHTML = '<p class="empty-state">Não foi possível conectar à galeria agora.</p>'; return; }
  try {
    galleryItems = await fetchPublicMedia();
    gallery.innerHTML = galleryItems.length ? galleryItems.map(createMediaCard).join("") : '<p class="empty-state">Nenhuma publicação real no momento.</p>';
    bindGalleryModal();
  } catch { gallery.insertAdjacentHTML("beforebegin", '<p class="empty-state">Nao foi possivel carregar a galeria agora.</p>'); }
};
const renderFeatured = (failedItems = 0) => {
  const wrap = document.querySelector("[data-featured-media]");
  if (!wrap || !galleryItems.length) return;
  const item = galleryItems[featuredIndex % galleryItems.length];
  const isVideo = item.media_type === "video";
  wrap.innerHTML = `<article class="featured-slide" data-id="${escapeHtml(item.id)}">${isVideo ? `<video src="${escapeHtml(item.public_url)}" controls playsinline preload="metadata"></video>` : `<img src="${escapeHtml(item.public_url)}" alt="${escapeHtml(item.caption || "Momento compartilhado")}"/>`}<div class="featured-info"><strong>${escapeHtml(item.guest_name)}</strong><p>${escapeHtml(item.caption || "Momento compartilhado com carinho.")}</p>${createStatsHtml(item)}</div></article>`;
  const media = wrap.querySelector("img, video");
  media?.addEventListener("error", () => {
    if (failedItems + 1 >= galleryItems.length) {
      wrap.innerHTML = '<p class="empty-state">As mídias da galeria estão indisponíveis no momento.</p>';
      return;
    }
    featuredIndex = (featuredIndex + 1) % galleryItems.length;
    renderFeatured(failedItems + 1);
  }, { once: true });
};
const loadPreviewMosaic = async () => {
  const wrap = document.querySelector("[data-featured-media], [data-preview-mosaic]");
  if (!wrap) return;
  if (!supabase) { wrap.innerHTML = '<p class="empty-state">Não foi possível conectar à galeria agora.</p>'; return; }
  try {
    galleryItems = await fetchPublicMedia(8);
    if (!galleryItems.length) { wrap.innerHTML = '<p class="empty-state">Nenhuma publicação real no momento.</p>'; return; }
    renderFeatured();
  } catch { wrap.innerHTML = '<p class="empty-state">Nao foi possivel carregar as publicações agora.</p>'; }
};

const bindDragSlider = (surface, navigate) => {
  if (!surface) return;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let dragging = false;

  surface.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("button, input, a")) return;
    startX = event.clientX;
    startY = event.clientY;
    offsetX = 0;
    dragging = true;
    surface.classList.add("is-dragging");
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      dragging = false;
      surface.classList.remove("is-dragging");
      surface.style.removeProperty("--drag-x");
      return;
    }
    offsetX = deltaX;
    surface.style.setProperty("--drag-x", `${offsetX}px`);
  });
  const finishDrag = () => {
    if (!dragging) return;
    dragging = false;
    surface.classList.remove("is-dragging");
    const threshold = Math.min(70, surface.clientWidth * 0.16);
    if (Math.abs(offsetX) < threshold) {
      surface.style.removeProperty("--drag-x");
      return;
    }
    const direction = offsetX < 0 ? 1 : -1;
    surface.style.setProperty("--drag-x", `${direction * -surface.clientWidth}px`);
    window.setTimeout(() => {
      navigate(direction);
      surface.classList.add("is-resetting");
      surface.style.setProperty("--drag-x", `${direction * surface.clientWidth}px`);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        surface.classList.remove("is-resetting");
        surface.style.setProperty("--drag-x", "0px");
      }));
    }, 220);
  };
  surface.addEventListener("dragstart", (event) => event.preventDefault());
  surface.addEventListener("pointerup", finishDrag);
  surface.addEventListener("pointercancel", finishDrag);
};

const initHeroCarousel = () => {
  const carousel = document.querySelector(".hero-carousel");
  const slides = [...document.querySelectorAll(".hero-carousel-slide")];
  const dots = carousel?.querySelector(".hero-carousel-dots");
  if (!carousel || !slides.length) return;
  let activeIndex = 0;
  const render = () => {
    slides.forEach((slide, index) => {
      slide.classList.toggle("is-active", index === activeIndex);
      slide.classList.toggle("is-prev", index === (activeIndex - 1 + slides.length) % slides.length);
      slide.classList.toggle("is-next", index === (activeIndex + 1) % slides.length);
    });
    if (dots) dots.innerHTML = slides.map((_, index) => `<span class="hero-carousel-dot${index === activeIndex ? " is-active" : ""}"></span>`).join("");
  };
  render();
  bindDragSlider(carousel, (direction) => {
    activeIndex = (activeIndex + direction + slides.length) % slides.length;
    render();
  });
};

bindDragSlider(document.querySelector("[data-featured-media]"), (direction) => {
  if (!galleryItems.length) return;
  featuredIndex = (featuredIndex + direction + galleryItems.length) % galleryItems.length;
  renderFeatured();
});
bindDragSlider(document.querySelector(".slide-modal .modal-content"), (direction) => openSlide(slideIndex + direction));
initHeroCarousel();

const createPendingPublication = (form, seconds = pendingPostSeconds) => {
  form.querySelector("[data-pending-publication]")?.remove();
  const panel = document.createElement("div");
  panel.className = "pending-publication";
  panel.dataset.pendingPublication = "";
  panel.innerHTML = `<div class="pending-timer" data-pending-timer>${seconds}s</div><div class="pending-actions"><button class="btn btn-primary" type="button" data-confirm-post>Confirmar postagem</button><button class="btn btn-secondary" type="button" data-cancel-post>Cancelar postagem</button></div><p class="pending-warning">Tempo limite para cancelar a postagem ${seconds}s.</p>`;
  form.append(panel);
  return panel;
};
const waitForPublicationDecision = (form) => new Promise((resolve) => {
  const panel = createPendingPublication(form);
  const timer = panel.querySelector("[data-pending-timer]");
  const warning = panel.querySelector(".pending-warning");
  let remaining = pendingPostSeconds;
  let done = false;
  const finish = (publish) => { if (done) return; done = true; clearInterval(interval); panel.remove(); resolve(publish); };
  const interval = setInterval(() => { remaining -= 1; timer.textContent = `${remaining}s`; warning.textContent = `Tempo limite para cancelar a postagem ${remaining}s.`; if (remaining <= 0) finish(true); }, 1000);
  panel.querySelector("[data-confirm-post]").addEventListener("click", () => finish(true));
  panel.querySelector("[data-cancel-post]").addEventListener("click", () => finish(false));
});

const bindMediaForm = () => {
  const form = document.querySelector("[data-media-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireSupabase(form)) return;
    const submit = form.querySelector("button[type='submit']");
    const files = Array.from(form.media.files || []);
    const guestName = form["guest-name"].value.trim();
    const caption = form.caption.value.trim();
    if (!files.length) { setStatus(form, "Escolha pelo menos uma foto ou video.", true); return; }
    submit.disabled = true;
    setStatus(form, `Enviando backup de ${files.length} arquivo(s)...`);
    try {
      const pendingUploads = [];
      for (const file of files) {
        const mediaType = file.type.startsWith("video/") ? "video" : "photo";
        const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${mediaType}s/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const uploadOptions = { cacheControl: "3600", contentType: file.type, upsert: false };
        const backupPath = `backup/${path}`;
        const { error } = await supabase.storage.from(backupBucket).upload(backupPath, file, uploadOptions);
        if (error) throw error;
        pendingUploads.push({ file, mediaType, path, backupPath, uploadOptions });
      }
      setStatus(form, "Backup salvo. Confirme para publicar agora ou aguarde 60 segundos.");
      if (!(await waitForPublicationDecision(form))) { form.reset(); setStatus(form, "Postagem cancelada. O backup permanece armazenado para os noivos."); return; }
      setStatus(form, `Publicando ${pendingUploads.length} arquivo(s)...`);
      for (const pending of pendingUploads) {
        const { file, mediaType, path, backupPath, uploadOptions } = pending;
        const { error: uploadError } = await supabase.storage.from(mediaBucket).upload(path, file, uploadOptions);
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from(mediaBucket).getPublicUrl(path);
        const { error: insertError } = await supabase.from("wedding_media").insert({ guest_name: guestName, caption, file_path: path, backup_file_path: backupPath, public_url: publicData.publicUrl, media_type: mediaType, is_public: true, device_id: getDeviceId(), device_name: getDeviceName() });
        if (insertError) throw insertError;
      }
      form.reset();
      setStatus(form, "Momentos enviados com sucesso. Obrigado por compartilhar!");
    } catch (error) { console.error(error); setStatus(form, "Nao foi possivel enviar agora. Confira a configuracao do Supabase e tente novamente.", true); }
    finally { submit.disabled = false; }
  });
};

const createMessageCard = (item) => `<article class="message-card" data-message-id="${escapeHtml(item.id || "")}"><p>${escapeHtml(item.message)}</p><footer><strong>${escapeHtml(item.guest_name)}</strong><span>${formatDate(item.created_at)}</span></footer></article>`;
const loadMessages = async () => {
  const wall = document.querySelector("[data-messages-wall], [data-main-messages]");
  if (!wall || !supabase) return;
  const { data, error } = await supabase.from("wedding_messages").select("id, guest_name, message, created_at").order("created_at", { ascending: false }).limit(wall.matches("[data-main-messages]") ? 3 : 100);
  if (error) { wall.insertAdjacentHTML("beforebegin", '<p class="empty-state">Nao foi possivel carregar os recados agora.</p>'); return; }
  wall.innerHTML = data?.length ? data.map(createMessageCard).join("") : '<p class="empty-state">Nenhum recado real no momento.</p>';
};
const bindMessageForm = () => {
  const form = document.querySelector("[data-message-form]");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireSupabase(form)) return;
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    setStatus(form, "Enviando recado...");
    const { error } = await supabase.from("wedding_messages").insert({ guest_name: form.name.value.trim(), message: form.message.value.trim(), device_id: getDeviceId(), device_name: getDeviceName() });
    submit.disabled = false;
    if (error) { console.error(error); setStatus(form, "Nao foi possivel enviar o recado agora.", true); return; }
    form.reset(); setStatus(form, "Recado enviado com carinho."); await loadMessages();
  });
};

document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => document.querySelector(".modal")?.classList.remove("open")));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") document.querySelector(".modal")?.classList.remove("open"); });

const createAdminMediaItem = (item) => {
  const isVideo = item.media_type === "video";
  const preview = isVideo ? `<video src="${escapeHtml(item.public_url)}" preload="metadata" muted playsinline></video>` : `<img loading="lazy" src="${escapeHtml(item.public_url)}" alt="${escapeHtml(item.caption || "Momento compartilhado")}"/>`;
  return `<article class="admin-item" data-id="${item.id}" data-file-path="${escapeHtml(item.file_path)}" data-backup-file-path="${escapeHtml(item.backup_file_path || "")}">${preview}<div><strong>${escapeHtml(item.guest_name)}</strong><p>${escapeHtml(item.caption || "Sem legenda")}</p><small>${formatDate(item.created_at)} · ${isVideo ? "Video" : "Foto"}<br>ID aparelho: ${escapeHtml(item.device_id || "Nao registrado")}<br>Aparelho: ${escapeHtml(item.device_name || "Nao registrado")}</small></div><div class="admin-actions"><button class="btn btn-secondary" type="button" data-download-media data-download-url="${escapeHtml(item.public_url)}">Baixar</button><button class="btn btn-secondary" type="button" data-delete-site-media>Excluir bucket Site</button><button class="btn btn-secondary" type="button" data-delete-backup-media>Excluir backup</button><button class="btn btn-secondary btn-danger" type="button" data-delete-both-media>Excluir ambos</button></div></article>`;
};
const createAdminMessageItem = (item) => `<article class="admin-item" data-id="${item.id}"><div></div><div><strong>${escapeHtml(item.guest_name)}</strong><p>${escapeHtml(item.message)}</p><small>${formatDate(item.created_at)}<br>ID aparelho: ${escapeHtml(item.device_id || "Nao registrado")}<br>Aparelho: ${escapeHtml(item.device_name || "Nao registrado")}</small></div><button class="btn btn-secondary" type="button" data-delete-message>Excluir texto</button></article>`;
const loadAdminContent = async () => {
  const mediaList = document.querySelector("[data-admin-media]");
  const messageList = document.querySelector("[data-admin-messages]");
  if (!mediaList || !messageList || !supabase) return;
  const [{ data: media, error: mediaError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("wedding_media").select("id, guest_name, caption, file_path, backup_file_path, public_url, media_type, created_at, device_id, device_name").order("created_at", { ascending: false }),
    supabase.from("wedding_messages").select("id, guest_name, message, created_at, device_id, device_name").order("created_at", { ascending: false })
  ]);
  mediaList.innerHTML = mediaError ? '<p class="admin-empty">Nao foi possivel carregar as midias.</p>' : (media?.length ? media.map(createAdminMediaItem).join("") : '<p class="admin-empty">Nenhuma midia no momento.</p>');
  messageList.innerHTML = messagesError ? '<p class="admin-empty">Nao foi possivel carregar os recados.</p>' : (messages?.length ? messages.map(createAdminMessageItem).join("") : '<p class="admin-empty">Nenhum recado no momento.</p>');
};
const bindAdmin = () => {
  const login = document.querySelector("[data-admin-login]");
  const dashboard = document.querySelector("[data-admin-dashboard]");
  const loginForm = document.querySelector("[data-admin-login-form]");
  if (!login || !dashboard || !loginForm) return;
  const showDashboard = async () => { login.hidden = true; dashboard.hidden = false; await loadAdminContent(); };
  if (sessionStorage.getItem("weddingAdmin") === "true") showDashboard();
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!requireSupabase(loginForm)) return;
    if (loginForm.login.value.trim() !== "noivos" || loginForm.password.value !== "331656") { setStatus(loginForm, "Login ou senha incorretos.", true); return; }
    sessionStorage.setItem("weddingAdmin", "true"); setStatus(loginForm, "Acesso liberado."); await showDashboard();
  });
  document.querySelector("[data-admin-signout]")?.addEventListener("click", () => { sessionStorage.removeItem("weddingAdmin"); dashboard.hidden = true; login.hidden = false; });
  dashboard.addEventListener("click", async (event) => {
    const item = event.target.closest(".admin-item");
    if (!item) return;
    const filePath = item.dataset.filePath;
    const backupPath = item.dataset.backupFilePath;
    const id = item.dataset.id;
    if (event.target.closest("[data-download-media]")) { window.open(event.target.closest("[data-download-media]").dataset.downloadUrl, "_blank", "noopener"); return; }
    if (event.target.closest("[data-delete-site-media], [data-delete-backup-media], [data-delete-both-media]")) {
      const delSite = Boolean(event.target.closest("[data-delete-site-media], [data-delete-both-media]"));
      const delBackup = Boolean(event.target.closest("[data-delete-backup-media], [data-delete-both-media]"));
      if (!confirm("Confirmar exclusao selecionada?")) return;
      if (delSite && filePath) await supabase.storage.from(mediaBucket).remove([filePath]);
      if (delBackup && backupPath) await supabase.storage.from(backupBucket).remove([backupPath]);
      const update = delSite ? { is_public: false, public_url: null } : {};
      if (delBackup) update.backup_file_path = null;
      await supabase.from("wedding_media").update(update).eq("id", id);
      await loadAdminContent();
      return;
    }
    if (event.target.closest("[data-delete-message]")) { if (!confirm("Excluir este texto?")) return; await supabase.from("wedding_messages").delete().eq("id", id); item.remove(); }
  });
};

bindGalleryFilters();
bindGalleryModal();
bindMediaForm();
bindMessageForm();
bindPostActions();
loadGallery();
loadPreviewMosaic();
loadMessages();
bindAdmin();
