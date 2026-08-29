(function () {
  "use strict";

  if (!window.customElements || window.customElements.get("shoot-lightbox")) return;

  function getImage(photo) {
    return photo.querySelector("img");
  }

  class ShootLightbox extends HTMLElement {
    constructor() {
      super();

      var template = document.getElementById("shoot-lightbox-template");
      if (!template) return;

      this.attachShadow({ mode: "open" });
      this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    connectedCallback() {
      if (!this.shadowRoot) return;

      this.photos = Array.from(document.querySelectorAll(".portfolio-day .tile"));
      if (!this.photos.length) return;

      this.currentPhoto = 0;
      this.modal = this.shadowRoot.querySelector(".modal");
      this.track = this.shadowRoot.querySelector(".track");
      this.previousButton = this.shadowRoot.querySelector(".previous");
      this.nextButton = this.shadowRoot.querySelector(".next");
      this.closeButton = this.shadowRoot.querySelector(".close");
      this.status = this.shadowRoot.querySelector(".status");

      this.buildSlides();
      this.bindEvents();
      this.updateControls();
    }

    buildSlides() {
      this.photos.forEach((photo) => {
        var sourceImage = getImage(photo);
        if (!sourceImage) return;

        var slide = document.createElement("div");
        var image = sourceImage.cloneNode(true);

        slide.className = "slide";
        image.loading = "eager";
        image.decoding = "async";
        image.draggable = false;
        image.addEventListener("click", (event) => event.stopPropagation());

        slide.appendChild(image);
        this.track.appendChild(slide);
      });

      this.slides = Array.from(this.track.querySelectorAll(".slide"));
    }

    loadHighResolutionImage(slide, photo) {
      if (!slide || !photo.href || slide.dataset.highResolutionRequested) return;

      var preview = slide.querySelector("img");
      if (!preview) return;

      slide.dataset.highResolutionRequested = "true";

      var image = preview.cloneNode(true);
      var revealed = false;

      image.classList.remove("blurhash-loaded");
      image.classList.add("high-resolution");
      image.removeAttribute("data-blurhash");
      image.removeAttribute("style");
      image.removeAttribute("srcset");
      image.removeAttribute("sizes");
      image.setAttribute("alt", "");
      image.setAttribute("aria-hidden", "true");
      image.loading = "eager";
      image.decoding = "async";
      image.draggable = false;
      image.addEventListener("click", (event) => event.stopPropagation());

      var reveal = () => {
        if (revealed) return;
        revealed = true;

        var decoded = typeof image.decode === "function" ? image.decode().catch(() => {}) : Promise.resolve();
        decoded.then(() => {
          window.requestAnimationFrame(() => image.classList.add("loaded"));
        });
      };

      image.addEventListener("load", reveal, { once: true });
      image.addEventListener("error", () => {
        delete slide.dataset.highResolutionRequested;
        image.remove();
      }, { once: true });

      slide.appendChild(image);
      image.src = photo.href;
      if (image.complete && image.naturalWidth) reveal();
    }

    bindEvents() {
      this.photos.forEach((photo, index) => {
        photo.addEventListener("click", (event) => this.open(event, index));
      });

      this.previousButton.addEventListener("click", this.previous);
      this.nextButton.addEventListener("click", this.next);
      this.closeButton.addEventListener("click", this.close);
      this.modal.addEventListener("click", this.close);
      this.track.addEventListener("scroll", this.onScroll, { passive: true });
      document.addEventListener("keydown", this.onKeydown);
      window.addEventListener("resize", this.onResize, { passive: true });
    }

    open(event, index) {
      event.preventDefault();

      this.previouslyFocused = document.activeElement;
      this.updateCurrentPhoto(index, "auto");
      this.modal.classList.remove("hidden");
      this.modal.setAttribute("aria-hidden", "false");
      document.documentElement.classList.add("lightbox-open");
      this.loadHighResolutionImage(this.slides[this.currentPhoto], this.photos[this.currentPhoto]);
      this.modal.focus({ preventScroll: true });
    }

    close = (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (this.modal.classList.contains("hidden")) return;

      this.modal.classList.add("hidden");
      this.modal.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("lightbox-open");

      if (this.previouslyFocused) this.previouslyFocused.focus({ preventScroll: true });
    };

    next = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.isLastPhoto()) this.updateCurrentPhoto(this.currentPhoto + 1);
    };

    previous = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.isFirstPhoto()) this.updateCurrentPhoto(this.currentPhoto - 1);
    };

    isFirstPhoto() {
      return this.currentPhoto <= 0;
    }

    isLastPhoto() {
      return this.currentPhoto >= this.photos.length - 1;
    }

    updateCurrentPhoto(index, behavior) {
      this.currentPhoto = Math.max(0, Math.min(this.photos.length - 1, index));
      this.track.scrollTo({
        left: this.currentPhoto * this.track.clientWidth,
        behavior: behavior || "smooth"
      });
      this.updateControls();
      this.loadHighResolutionImage(this.slides[this.currentPhoto], this.photos[this.currentPhoto]);
    }

    updateControls() {
      this.previousButton.disabled = this.isFirstPhoto();
      this.nextButton.disabled = this.isLastPhoto();
      this.status.textContent = "Photo " + (this.currentPhoto + 1) + " of " + this.photos.length;
    }

    onKeydown = (event) => {
      if (this.modal.classList.contains("hidden")) return;

      if (event.key === "ArrowLeft") this.previous(event);
      if (event.key === "ArrowRight") this.next(event);
      if (event.key === "Escape") this.close(event);
    };

    onScroll = () => {
      window.clearTimeout(this.scrollSyncTimeout);
      this.scrollSyncTimeout = window.setTimeout(() => {
        var width = this.track.clientWidth || window.innerWidth;
        this.currentPhoto = Math.max(
          0,
          Math.min(this.photos.length - 1, Math.round(this.track.scrollLeft / width))
        );
        this.updateControls();
        this.loadHighResolutionImage(this.slides[this.currentPhoto], this.photos[this.currentPhoto]);
      }, 100);
    };

    onResize = () => {
      if (this.modal.classList.contains("hidden")) return;
      this.updateCurrentPhoto(this.currentPhoto, "auto");
    };
  }

  window.customElements.define("shoot-lightbox", ShootLightbox);
}());
