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
