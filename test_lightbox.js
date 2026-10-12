const assert = require("node:assert/strict");
const test = require("node:test");

const elements = new Map();

global.window = {
  clearTimeout,
  customElements: {
    define(name, element) {
      elements.set(name, element);
    },
    get(name) {
      return elements.get(name);
    }
  },
  setTimeout
};
global.customElements = global.window.customElements;
global.HTMLElement = class {};
global.document = { getElementById() { return null; } };

require("./assets/lightbox.js");

const ShootLightbox = customElements.get("shoot-lightbox");

function touch(x, y) {
  return { clientX: x, clientY: y };
}

function tap(lightbox, x, y, time) {
  lightbox.touchStarts = [touch(x, y)];
  lightbox.maxTouches = 1;
  lightbox.gestureDirection = undefined;
  return lightbox.isDoubleTap({ changedTouches: [touch(x, y)], timeStamp: time });
}

function classList() {
  const classes = new Set();
  return {
    add(...names) { names.forEach((name) => classes.add(name)); },
    contains(name) { return classes.has(name); },
    remove(...names) { names.forEach((name) => classes.delete(name)); }
  };
}

function style() {
  const properties = new Map();
  return {
    getPropertyValue(name) { return properties.get(name); },
    removeProperty(name) { properties.delete(name); },
    setProperty(name, value) { properties.set(name, String(value)); }
  };
}

function gestureLightbox() {
  const lightbox = new ShootLightbox();
  const image = {
    getBoundingClientRect() { return { left: 50, top: 50 }; },
    offsetHeight: 100,
    offsetWidth: 200
  };
  const slide = {
    classList: classList(),
    querySelector() { return image; },
    style: style()
  };

  lightbox.currentPhoto = 0;
  lightbox.maxTouches = 0;
  lightbox.modal = { classList: classList() };
  lightbox.panX = 0;
  lightbox.panY = 0;
  lightbox.slides = [slide];
  lightbox.startPan = { x: null, y: null };
  lightbox.track = { style: style() };
  lightbox.zoomScale = 1;

  return { lightbox, slide };
}

test("recognizes two nearby taps within 300ms", () => {
  const lightbox = new ShootLightbox();

  assert.equal(tap(lightbox, 100, 100, 1000), false);
  assert.equal(tap(lightbox, 110, 110, 1250), true);
  assert.equal(lightbox.lastTap, null);
});

test("does not treat a drag or pinch as a tap", () => {
  const lightbox = new ShootLightbox();

  assert.equal(tap(lightbox, 100, 100, 1000), false);

  lightbox.touchStarts = [touch(100, 100)];
  lightbox.maxTouches = 1;
  lightbox.gestureDirection = "horizontal";
  assert.equal(lightbox.isDoubleTap({ changedTouches: [touch(120, 100)], timeStamp: 1100 }), false);
  assert.equal(lightbox.lastTap, null);

  lightbox.touchStarts = [touch(100, 100), touch(200, 100)];
  lightbox.maxTouches = 2;
  lightbox.gestureDirection = undefined;
  assert.equal(lightbox.isDoubleTap({ changedTouches: [touch(100, 100)], timeStamp: 1200 }), false);
});

test("requires double taps to stay close in time and space", () => {
  const lightbox = new ShootLightbox();

  assert.equal(tap(lightbox, 100, 100, 1000), false);
  assert.equal(tap(lightbox, 100, 100, 1400), false);
  assert.equal(tap(lightbox, 150, 150, 1500), false);
});

test("zooms around the gesture midpoint and resets cleanly", () => {
  const { lightbox, slide } = gestureLightbox();
  lightbox.touchStarts = [touch(100, 100), touch(200, 100)];

  lightbox.pinchToZoom({
    preventDefault() {},
    targetTouches: [touch(50, 100), touch(250, 100)]
  });

  assert.equal(lightbox.zoomScale, 2);
  assert.equal(lightbox.panX, 0);
  assert.equal(lightbox.panY, 0);
  assert.equal(slide.classList.contains("zooming"), true);
  assert.equal(slide.style.getPropertyValue("--scale"), "2");

  lightbox.resetZoomState(slide);

  assert.equal(lightbox.zoomScale, 1);
  assert.equal(slide.classList.contains("zooming"), false);
  assert.equal(slide.style.getPropertyValue("--scale"), undefined);
});
