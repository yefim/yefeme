(function () {
  "use strict";

  var DOUBLE_TAP_MAX_MS = 300;
  var DOUBLE_TAP_MAX_DISTANCE = 30;
  var DOUBLE_TAP_ZOOM_SCALE = 2;
  var TAP_MAX_DISTANCE = 10;

  if (!window.customElements || window.customElements.get("shoot-lightbox")) return;

  function getImage(photo) {
    return photo.querySelector("img");
  }

  function distanceBetween(first, second) {
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
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
      this.maxTouches = 0;
      this.touchStarts = [];
      this.zoomScale = 1;
      this.panX = 0;
      this.panY = 0;
      this.startPan = { x: null, y: null };
      this.lastTap = null;

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
        this.bindImageEvents(image);

        slide.appendChild(image);
        this.track.appendChild(slide);
      });

      this.slides = Array.from(this.track.querySelectorAll(".slide"));
    }

    bindImageEvents(image) {
      image.addEventListener("click", (event) => event.stopPropagation());
      image.addEventListener("touchstart", this.onTouchStart, { passive: false });
      image.addEventListener("touchmove", this.onTouchMove, { passive: false });
      image.addEventListener("touchend", this.onTouchEnd, { passive: false });
      image.addEventListener("touchcancel", this.onTouchCancel, { passive: false });
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
      this.bindImageEvents(image);

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

      if (this.modal.classList.contains("hidden") || this.zoomScale !== 1) return;

      var slide = this.getCurrentSlide();

      this.modal.classList.add("hidden");
      this.modal.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("lightbox-open");
      this.lastTap = null;

      if (slide && slide.classList.contains("settling")) {
        this.scheduleGestureReset(slide);
      } else {
        this.resetGestureState(slide);
      }

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

    getCurrentSlide() {
      return this.slides[this.currentPhoto];
    }

    getCurrentImage() {
      var slide = this.getCurrentSlide();
      return slide && (slide.querySelector(".high-resolution.loaded") || slide.querySelector("img"));
    }

    updateCurrentPhoto(index, behavior) {
      if (this.zoomScale !== 1) this.resetZoomState(this.getCurrentSlide());

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
      if (this.modal.classList.contains("hidden") || this.zoomScale !== 1) return;

      if (event.key === "ArrowLeft") this.previous(event);
      if (event.key === "ArrowRight") this.next(event);
      if (event.key === "Escape") this.close(event);
    };

    onScroll = () => {
      window.clearTimeout(this.scrollSyncTimeout);
      this.scrollSyncTimeout = window.setTimeout(() => {
        var width = this.track.clientWidth || window.innerWidth;
        var nextPhoto = Math.max(
          0,
          Math.min(this.photos.length - 1, Math.round(this.track.scrollLeft / width))
        );

        if (nextPhoto !== this.currentPhoto && this.zoomScale !== 1) {
          this.resetZoomState(this.getCurrentSlide());
        }

        this.currentPhoto = nextPhoto;
        this.updateControls();
        this.loadHighResolutionImage(this.slides[this.currentPhoto], this.photos[this.currentPhoto]);
      }, 100);
    };

    onResize = () => {
      if (this.modal.classList.contains("hidden")) return;
      this.updateCurrentPhoto(this.currentPhoto, "auto");
    };

    onTouchStart = (event) => {
      if (this.getCurrentSlide().classList.contains("settling")) this.resetGestureState();

      this.touchStarts = Array.from(event.targetTouches);
      this.maxTouches = Math.max(this.maxTouches, event.targetTouches.length);
      this.startPan = { x: null, y: null };

      if (this.touchStarts.length === 1) this.gestureDirection = undefined;
    };

    onTouchMove = (event) => {
      this.maxTouches = Math.max(this.maxTouches, event.targetTouches.length);

      if (this.maxTouches >= 2) {
        this.pinchToZoom(event);
      } else if (this.zoomScale === 1) {
        this.maybeApplyVerticalDrag(event);
      } else {
        this.panZoomedImage(event);
      }
    };

    onTouchEnd = (event) => {
      if (event.targetTouches.length !== 0) return;

      var slide = this.getCurrentSlide();

      if (this.isDoubleTap(event)) {
        if (this.zoomScale === 1) {
          this.doubleTapZoomIn(event);
        } else {
          this.resetZoomState(slide);
        }
      } else if (this.zoomScale === 1) {
        if (this.maxTouches === 1) this.finishVerticalDrag(event);
        if (this.maxTouches >= 2) this.resetZoomState(slide);
      } else if (this.maxTouches === 1) {
        this.finishPanning();
      } else if (this.maxTouches >= 2) {
        this.pauseZooming();
      }

      this.maxTouches = 0;
    };

    onTouchCancel = () => {
      this.lastTap = null;
      this.maxTouches = 0;

      if (this.zoomScale === 1) {
        this.resetGestureState();
      } else {
        this.pauseZooming();
      }
    };

    isDoubleTap(event) {
      var touch = event.changedTouches[0];
      var startedAsTap = touch &&
        this.maxTouches === 1 &&
        !this.gestureDirection &&
        this.touchStarts[0] &&
        distanceBetween(this.touchStarts[0], touch) < TAP_MAX_DISTANCE;

      if (!startedAsTap) {
        this.lastTap = null;
        return false;
      }

      var isDoubleTap = this.lastTap &&
        event.timeStamp - this.lastTap.time < DOUBLE_TAP_MAX_MS &&
        distanceBetween(this.lastTap.touch, touch) < DOUBLE_TAP_MAX_DISTANCE;

      this.lastTap = isDoubleTap ? null : { time: event.timeStamp, touch: touch };
      return Boolean(isDoubleTap);
    }

    doubleTapZoomIn(event) {
      this.resetGestureState();

      var slide = this.getCurrentSlide();
      var image = this.getCurrentImage();
      var rect = image.getBoundingClientRect();

      this.zoomScale = DOUBLE_TAP_ZOOM_SCALE;
      this.panX = (1 - DOUBLE_TAP_ZOOM_SCALE) *
        ((event.changedTouches[0].clientX - rect.left) - image.offsetWidth / 2);
      this.panY = (1 - DOUBLE_TAP_ZOOM_SCALE) *
        ((event.changedTouches[0].clientY - rect.top) - image.offsetHeight / 2);

      slide.classList.add("zooming", "zooming-paused");
      this.modal.classList.add("zoomed");
      this.applyZoomStyles(slide);
    }

    pinchToZoom(event) {
      var slide = this.getCurrentSlide();
      if (slide.classList.contains("dragging") || event.targetTouches.length < 2) return;

      var image = this.getCurrentImage();
      var rect = image.getBoundingClientRect();
      var firstTouch = event.targetTouches[0];
      var secondTouch = event.targetTouches[1];
      var distance = distanceBetween(firstTouch, secondTouch);
      var previousScale = this.zoomScale;

      event.preventDefault();
      slide.classList.add("zooming");
      slide.classList.remove("zooming-paused");
      this.modal.classList.add("zoomed");

      if (this.startDistance == null) {
        this.startDistance = distanceBetween(this.touchStarts[0], this.touchStarts[1]);
        this.startScale = this.zoomScale;
        this.zoomAnchorPhotoX = ((firstTouch.clientX + secondTouch.clientX) / 2 - rect.left) / previousScale;
        this.zoomAnchorPhotoY = ((firstTouch.clientY + secondTouch.clientY) / 2 - rect.top) / previousScale;
      }

      this.zoomScale = Math.max(1, this.startScale * (distance / this.startDistance));

      var midpointX = (firstTouch.clientX + secondTouch.clientX) / 2;
      var midpointY = (firstTouch.clientY + secondTouch.clientY) / 2;

      this.panX += (midpointX - rect.left) - this.zoomScale * this.zoomAnchorPhotoX +
        (image.offsetWidth / 2) * (this.zoomScale - previousScale);
      this.panY += (midpointY - rect.top) - this.zoomScale * this.zoomAnchorPhotoY +
        (image.offsetHeight / 2) * (this.zoomScale - previousScale);

      this.applyZoomStyles(slide);
    }

    panZoomedImage(event) {
      event.preventDefault();

      var slide = this.getCurrentSlide();
      var image = this.getCurrentImage();
      var rect = image.getBoundingClientRect();
      var touch = event.targetTouches[0];

      if (this.startPan.x == null || this.startPan.y == null) {
        slide.classList.add("panning");
        this.startPan = {
          x: (touch.clientX - rect.left) / this.zoomScale,
          y: (touch.clientY - rect.top) / this.zoomScale
        };
      }

      this.panX += (touch.clientX - rect.left) - this.startPan.x * this.zoomScale;
      this.panY += (touch.clientY - rect.top) - this.startPan.y * this.zoomScale;
      this.applyZoomStyles(slide);
    }

    applyZoomStyles(slide) {
      slide.style.setProperty("--scale", this.zoomScale);
      slide.style.setProperty("--pan-x", this.panX + "px");
      slide.style.setProperty("--pan-y", this.panY + "px");
    }

    maybeApplyVerticalDrag(event) {
      var touch = event.targetTouches[0];
      if (!touch || !this.touchStarts[0]) return;

      if (!this.gestureDirection && distanceBetween(this.touchStarts[0], touch) >= TAP_MAX_DISTANCE) {
        this.gestureDirection = Math.abs(touch.clientX - this.touchStarts[0].clientX) >
          Math.abs(touch.clientY - this.touchStarts[0].clientY) ? "horizontal" : "vertical";
      }

      if (this.gestureDirection !== "vertical") return;

      event.preventDefault();
      this.track.style.scrollSnapType = "none";
      this.track.style.overflowX = "hidden";
      this.applyVerticalDrag(touch.clientY - this.touchStarts[0].clientY);
    }

    applyVerticalDrag(distance) {
      var slide = this.getCurrentSlide();
      var maxDrag = window.innerHeight * 0.5;
      var opacity = Math.max(0, Math.min(1, 1 - Math.abs(distance) / maxDrag));

      slide.classList.add("dragging");
      slide.style.setProperty("--drag-y", distance + "px");
      slide.style.setProperty("--drag-opacity", opacity);
    }

    finishVerticalDrag(event) {
      if (this.gestureDirection !== "vertical") return;

      var slide = this.getCurrentSlide();
      var distance = event.changedTouches[0].clientY - this.touchStarts[0].clientY;
      var threshold = Math.min(window.innerHeight * 0.3, 150);

      slide.classList.add("settling");

      if (Math.abs(distance) < threshold) {
        slide.style.setProperty("--drag-y", "0px");
        slide.style.setProperty("--drag-opacity", "1");
        this.scheduleGestureReset(slide);
        return;
      }

      slide.style.setProperty("--drag-y", (distance > 0 ? distance + 200 : distance - 200) + "px");
      slide.style.setProperty("--drag-opacity", "0");
      this.close();
    }

    finishPanning() {
      this.startPan = { x: null, y: null };
      this.getCurrentSlide().classList.remove("panning");
    }

    pauseZooming() {
      this.startDistance = null;
      this.getCurrentSlide().classList.add("zooming-paused");
    }

    resetZoomState(slide) {
      if (!slide) return;

      this.resetGestureState(slide);
      slide.classList.remove("zooming", "zooming-paused", "panning");
      slide.style.removeProperty("--scale");
      slide.style.removeProperty("--pan-x");
      slide.style.removeProperty("--pan-y");
      this.modal.classList.remove("zoomed");
      this.zoomScale = 1;
      this.panX = 0;
      this.panY = 0;
    }

    scheduleGestureReset(slide) {
      window.clearTimeout(this.gestureResetTimeout);
      this.gestureResetTimeout = window.setTimeout(() => this.resetGestureState(slide), 350);
    }

    resetGestureState = (slide) => {
      slide = slide || this.getCurrentSlide();
      if (!slide) return;

      window.clearTimeout(this.gestureResetTimeout);
      slide.classList.remove("dragging", "settling");
      slide.style.removeProperty("--drag-y");
      slide.style.removeProperty("--drag-opacity");
      this.track.style.scrollSnapType = "";
      this.track.style.overflowX = "";
      this.maxTouches = 0;
      this.startDistance = null;
      this.gestureDirection = undefined;
    };
  }

  window.customElements.define("shoot-lightbox", ShootLightbox);
}());
