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

const modal = document.querySelector(".modal");
const modalImg = document.querySelector(".modal img");
const modalTitle = document.querySelector(".modal h2");
const modalText = document.querySelector(".modal p");

document.querySelectorAll(".media-card button").forEach((button) => {
  button.addEventListener("click", () => {
    const card = button.closest(".media-card");
    const img = card.querySelector("img");
    modalImg.src = img.src;
    modalImg.alt = img.alt;
    modalTitle.textContent = card.querySelector("strong").textContent;
    modalText.textContent = card.querySelector("p").textContent;
    modal.classList.add("open");
    modal.querySelector(".modal-close").focus();
  });
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => modal?.classList.remove("open"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") modal?.classList.remove("open");
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
