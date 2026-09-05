import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const config = window.SUPABASE_CONFIG || {};
const isConfigured = Boolean(config.url && config.anonKey && !config.url.includes("SEU-PROJETO") && !config.anonKey.includes("SUA_CHAVE"));
const supabase = isConfigured ? createClient(config.url, config.anonKey) : null;
const mediaBucket = config.mediaBucket || "wedding-media";

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("in");
    });
  }, { threshold: 0.12 });
  revealItems.forEach((el) => observer.observe(el));
} else {
  revealItems.forEach((el) => el.classList.add("in"));
}

const formatDate = (value) => new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
}).format(new Date(value));

const escapeHtml = (value = "") => value.replace(/[&<>"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[char]));

const setStatus = (form, message, isError = false) => {
  const status = form?.querySelector(".form-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
};

const requireSupabase = (form) => {
  if (supabase) return true;
  setStatus(form, "Configure o arquivo supabase-config.js com a URL e a chave pública do Supabase.", true);
  return false;
};

const createMediaCard = (item) => {
  const isVideo = item.media_type === "video";
  const media = isVideo
    ? `<video src="${escapeHtml(item.public_url)}" preload="metadata" muted playsinline></video>`
    : `<img loading="lazy" src="${escapeHtml(item.public_url)}" alt="${escapeHtml(item.caption || "Momento compartilhado")}"/>`;

  return `<article class="media-card" data-type="${item.media_type}" data-src="${escapeHtml(item.public_url)}" style="--ratio:1/1">
    ${isVideo ? '<span class="video-badge">▶</span>' : ""}${media}
    <div><strong>${escapeHtml(item.guest_name)}</strong><p>${escapeHtml(item.caption || "Momento compartilhado com carinho.")}</p><small>${formatDate(item.created_at)}</small><button class="btn btn-secondary" type="button">Abrir publicação</button></div>
  </article>`;
};

const bindGalleryFilters = () => {
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".media-card").forEach((card) => {
        card.hidden = filter !== "all" && card.dataset.type !== filter;
      });
    });
  });
};

const bindGalleryModal = () => {
  const modal = document.querySelector(".modal");
  const modalImg = document.querySelector(".modal img");
  const modalVideo = document.querySelector(".modal video");
  const modalTitle = document.querySelector(".modal h2");
  const modalText = document.querySelector(".modal p");

  document.querySelectorAll(".media-card button").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".media-card");
      const isVideo = card.dataset.type === "video";
      const image = card.querySelector("img");
      const video = card.querySelector("video");
      const src = card.dataset.src || image?.src || video?.src;

      if (modalImg) {
        modalImg.hidden = isVideo;
        modalImg.src = isVideo ? "" : src;
        modalImg.alt = image?.alt || "Momento compartilhado";
      }
      if (modalVideo) {
        modalVideo.hidden = !isVideo;
        modalVideo.src = isVideo ? src : "";
      }
      modalTitle.textContent = card.querySelector("strong").textContent;
      modalText.textContent = card.querySelector("p").textContent;
      modal.classList.add("open");
      modal.querySelector(".modal-close").focus();
    });
  });
};

const loadGallery = async () => {
  const gallery = document.querySelector("[data-gallery-grid]");
  if (!gallery || !supabase) return;

  const { data, error } = await supabase
    .from("wedding_media")
    .select("guest_name, caption, public_url, media_type, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) {
    gallery.insertAdjacentHTML("beforebegin", `<p class="empty-state">Nao foi possivel carregar a galeria agora.</p>`);
    return;
  }

  if (data?.length) gallery.innerHTML = data.map(createMediaCard).join("");
  bindGalleryModal();
};

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
    const isPublic = form["is-public"].checked;

    if (!files.length) {
      setStatus(form, "Escolha pelo menos uma foto ou video.", true);
      return;
    }

    submit.disabled = true;
    setStatus(form, `Enviando ${files.length} arquivo(s)...`);

    try {
      for (const file of files) {
        const mediaType = file.type.startsWith("video/") ? "video" : "photo";
        const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${mediaType}s/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(mediaBucket).upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false
        });
        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage.from(mediaBucket).getPublicUrl(path);
        const { error: insertError } = await supabase.from("wedding_media").insert({
          guest_name: guestName,
          caption,
          file_path: path,
          public_url: publicData.publicUrl,
          media_type: mediaType,
          is_public: isPublic
        });
        if (insertError) throw insertError;
      }

      form.reset();
      setStatus(form, "Momentos enviados com sucesso. Obrigado por compartilhar!");
    } catch (error) {
      console.error(error);
      setStatus(form, "Nao foi possivel enviar agora. Confira a configuracao do Supabase e tente novamente.", true);
    } finally {
      submit.disabled = false;
    }
  });
};

const createMessageCard = (item) => `<article class="message-card"><p>${escapeHtml(item.message)}</p><footer><strong>${escapeHtml(item.guest_name)}</strong><span>${formatDate(item.created_at)}</span></footer></article>`;

const loadMessages = async () => {
  const wall = document.querySelector("[data-messages-wall]");
  if (!wall || !supabase) return;

  const { data, error } = await supabase
    .from("wedding_messages")
    .select("guest_name, message, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    wall.insertAdjacentHTML("beforebegin", `<p class="empty-state">Nao foi possivel carregar os recados agora.</p>`);
    return;
  }

  if (data?.length) wall.innerHTML = data.map(createMessageCard).join("");
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

    const { error } = await supabase.from("wedding_messages").insert({
      guest_name: form.name.value.trim(),
      message: form.message.value.trim()
    });

    submit.disabled = false;
    if (error) {
      console.error(error);
      setStatus(form, "Nao foi possivel enviar o recado agora.", true);
      return;
    }

    form.reset();
    setStatus(form, "Recado enviado com carinho.");
    await loadMessages();
  });
};

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(".modal")?.classList.remove("open"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelector(".modal")?.classList.remove("open");
});

const heroCarousel = document.querySelector(".hero-carousel");

if (heroCarousel) {
  const slides = Array.from(heroCarousel.querySelectorAll(".hero-carousel-slide"));
  const previousButton = heroCarousel.querySelector(".hero-carousel-prev");
  const nextButton = heroCarousel.querySelector(".hero-carousel-next");
  const dotsContainer = heroCarousel.querySelector(".hero-carousel-dots");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let currentIndex = slides.findIndex((slide) => slide.classList.contains("is-active"));
  let autoplayTimer;

  if (currentIndex < 0) currentIndex = 0;

  const updateCarousel = () => {
    slides.forEach((slide, index) => {
      slide.classList.toggle("is-active", index === currentIndex);
      slide.classList.toggle("is-prev", index === (currentIndex - 1 + slides.length) % slides.length);
      slide.classList.toggle("is-next", index === (currentIndex + 1) % slides.length);
    });

    dotsContainer?.querySelectorAll(".hero-carousel-dot").forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentIndex);
      dot.setAttribute("aria-current", index === currentIndex ? "true" : "false");
    });
  };

  const stopAutoplay = () => window.clearInterval(autoplayTimer);
  const startAutoplay = () => {
    stopAutoplay();
    if (!reduceMotion.matches && slides.length > 1) {
      autoplayTimer = window.setInterval(() => {
        currentIndex = (currentIndex + 1) % slides.length;
        updateCarousel();
      }, 4500);
    }
  };

  slides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.className = "hero-carousel-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Mostrar foto ${index + 1}`);
    dot.addEventListener("click", () => {
      currentIndex = index;
      updateCarousel();
      stopAutoplay();
    });
    dotsContainer?.append(dot);
  });

  previousButton?.addEventListener("click", () => {
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel();
    stopAutoplay();
  });

  nextButton?.addEventListener("click", () => {
    currentIndex = (currentIndex + 1) % slides.length;
    updateCarousel();
    stopAutoplay();
  });

  heroCarousel.addEventListener("mouseenter", stopAutoplay);
  heroCarousel.addEventListener("mouseleave", startAutoplay);
  heroCarousel.addEventListener("focusin", stopAutoplay);
  heroCarousel.addEventListener("touchstart", stopAutoplay, { passive: true });
  reduceMotion.addEventListener?.("change", startAutoplay);

  updateCarousel();
  startAutoplay();
}

bindGalleryFilters();
bindGalleryModal();
bindMediaForm();
bindMessageForm();
loadGallery();
loadMessages();
