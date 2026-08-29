(function () {
  "use strict";

  if (!window.customElements || window.customElements.get("shoot-lightbox")) return;

  var LARGE_VIEWPORT_BREAKPOINT = 600;
  var VERTICAL_DRAG_DISTANCE = 10;

  function getImage(photo) {
    return photo.querySelector("img");
  }

  function loadLargeImage(slide, photo) {
    if (!window.matchMedia("(min-width: " + LARGE_VIEWPORT_BREAKPOINT + "px)").matches) return;

    var image = slide && slide.querySelector("img");
    if (image && photo.href && image.src !== photo.href) image.src = photo.href;
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
        image.addEventListener("touchstart", this.startTouch, { passive: true });
        image.addEventListener("touchmove", this.dragVertically, { passive: false });
        image.addEventListener("touchend", this.endTouch);
        image.addEventListener("touchcancel", this.resetGesture);

        slide.appendChild(image);
        this.track.appendChild(slide);
      });

      this.slides = Array.from(this.track.querySelectorAll(".slide"));
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
      loadLargeImage(this.slides[this.currentPhoto], this.photos[this.currentPhoto]);
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
      this.resetGesture();

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
      loadLargeImage(this.slides[this.currentPhoto], this.photos[this.currentPhoto]);
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
        loadLargeImage(this.slides[this.currentPhoto], this.photos[this.currentPhoto]);
      }, 100);
    };

    onResize = () => {
      if (this.modal.classList.contains("hidden")) return;
      this.updateCurrentPhoto(this.currentPhoto, "auto");
    };

    startTouch = (event) => {
      if (event.touches.length !== 1) return;

      this.touchStartX = event.touches[0].clientX;
      this.touchStartY = event.touches[0].clientY;
      this.gestureDirection = "undecided";
    };

    dragVertically = (event) => {
      if (event.touches.length !== 1 || this.gestureDirection === "horizontal") return;

      var deltaX = Math.abs(event.touches[0].clientX - this.touchStartX);
      var deltaY = Math.abs(event.touches[0].clientY - this.touchStartY);

      if (this.gestureDirection === "undecided") {
        if (deltaX < VERTICAL_DRAG_DISTANCE && deltaY < VERTICAL_DRAG_DISTANCE) return;
        this.gestureDirection = deltaX > deltaY ? "horizontal" : "vertical";
      }

      if (this.gestureDirection !== "vertical") return;

      event.preventDefault();
      this.track.style.scrollSnapType = "none";
      this.track.style.overflowX = "hidden";
      this.applyVerticalDrag(event.touches[0].clientY - this.touchStartY);
    };

    applyVerticalDrag(distance) {
      var image = this.slides[this.currentPhoto] && this.slides[this.currentPhoto].querySelector("img");
      if (!image) return;

      var maxDrag = window.innerHeight * 0.5;
      var opacity = Math.max(0, Math.min(1, 1 - Math.abs(distance) / maxDrag));

      image.classList.add("dragging");
      image.style.setProperty("--drag-y", distance + "px");
      image.style.setProperty("--drag-opacity", opacity);
    }

    endTouch = (event) => {
      if (this.gestureDirection !== "vertical") return;

      var distance = event.changedTouches[0].clientY - this.touchStartY;
      var dismissDistance = Math.min(window.innerHeight * 0.3, 150);

      if (Math.abs(distance) < dismissDistance) {
        this.resetGesture();
        return;
      }

      var image = this.slides[this.currentPhoto] && this.slides[this.currentPhoto].querySelector("img");
      if (!image) return;

      image.classList.add("dismissing");
      image.style.setProperty("--drag-y", (distance > 0 ? distance + 200 : distance - 200) + "px");
      image.style.setProperty("--drag-opacity", "0");
      window.setTimeout(() => this.close(), 200);
    };

    resetGesture = () => {
      var image = this.slides && this.slides[this.currentPhoto] && this.slides[this.currentPhoto].querySelector("img");

      if (image) {
        image.classList.remove("dragging", "dismissing");
        image.style.removeProperty("--drag-y");
        image.style.removeProperty("--drag-opacity");
      }

      if (this.track) {
        this.track.style.removeProperty("scroll-snap-type");
        this.track.style.removeProperty("overflow-x");
      }

      this.gestureDirection = "undecided";
    };
  }

  window.customElements.define("shoot-lightbox", ShootLightbox);
}());
