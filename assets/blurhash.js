(function () {
  "use strict";

  var BASE83 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~";
  var cache = new Map();

  function decode83(value) {
    var result = 0;

    for (var index = 0; index < value.length; index += 1) {
      result = result * 83 + BASE83.indexOf(value[index]);
    }

    return result;
  }

  function srgbToLinear(value) {
    value /= 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(value) {
    value = Math.max(0, Math.min(1, value));
    value = value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
    return Math.floor(value * 255 + 0.5);
  }

  function signPow(value, exponent) {
    return (value < 0 ? -1 : 1) * Math.pow(Math.abs(value), exponent);
  }

  function decodeDC(value) {
    return [
      srgbToLinear(value >> 16),
      srgbToLinear((value >> 8) & 255),
      srgbToLinear(value & 255)
    ];
  }

  function decodeAC(value, maximum) {
    return [
      signPow(Math.floor(value / (19 * 19)) / 9 - 1, 2) * maximum,
      signPow((Math.floor(value / 19) % 19) / 9 - 1, 2) * maximum,
      signPow((value % 19) / 9 - 1, 2) * maximum
    ];
  }

  function decode(hash, width, height) {
    var sizeFlag = decode83(hash[0]);
    var componentsY = Math.floor(sizeFlag / 9) + 1;
    var componentsX = (sizeFlag % 9) + 1;
    var expectedLength = 4 + 2 * componentsX * componentsY;

    if (hash.length !== expectedLength) return null;

    var maximum = (decode83(hash[1]) + 1) / 166;
    var colors = [decodeDC(decode83(hash.slice(2, 6)))];

    for (var component = 1; component < componentsX * componentsY; component += 1) {
      colors.push(decodeAC(decode83(hash.slice(4 + component * 2, 6 + component * 2)), maximum));
    }

    var pixels = new Uint8ClampedArray(width * height * 4);

    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        var red = 0;
        var green = 0;
        var blue = 0;

        for (var componentY = 0; componentY < componentsY; componentY += 1) {
          for (var componentX = 0; componentX < componentsX; componentX += 1) {
            var basis =
              Math.cos(Math.PI * x * componentX / width) *
              Math.cos(Math.PI * y * componentY / height);
            var color = colors[componentX + componentY * componentsX];
            red += color[0] * basis;
            green += color[1] * basis;
            blue += color[2] * basis;
          }
        }

        var offset = 4 * (x + y * width);
        pixels[offset] = linearToSrgb(red);
        pixels[offset + 1] = linearToSrgb(green);
        pixels[offset + 2] = linearToSrgb(blue);
        pixels[offset + 3] = 255;
      }
    }

    return pixels;
  }

  function placeholderFor(image) {
    var hash = image.dataset.blurhash;
    var intrinsicWidth = Number(image.getAttribute("width"));
    var intrinsicHeight = Number(image.getAttribute("height"));

    if (!hash || !intrinsicWidth || !intrinsicHeight) return;

    function finishLoading() {
      image.classList.remove("blurhash-loading");
    }

    image.classList.add("blurhash-loading");
    image.addEventListener("load", finishLoading, { once: true });
    image.addEventListener("error", finishLoading, { once: true });
    if (image.complete) finishLoading();

    var width = intrinsicWidth >= intrinsicHeight ? 32 : Math.max(1, Math.round(32 * intrinsicWidth / intrinsicHeight));
    var height = intrinsicHeight >= intrinsicWidth ? 32 : Math.max(1, Math.round(32 * intrinsicHeight / intrinsicWidth));
    var cacheKey = hash + ":" + width + "x" + height;
    var dataUrl = cache.get(cacheKey);

    if (!dataUrl) {
      var pixels = decode(hash, width, height);
      if (!pixels) return;

      var canvas = document.createElement("canvas");
      var context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = width;
      canvas.height = height;
      var imageData = context.createImageData(width, height);
      imageData.data.set(pixels);
      context.putImageData(imageData, 0, 0);
      dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      cache.set(cacheKey, dataUrl);
    }

    image.style.backgroundImage = "url(\"" + dataUrl + "\")";
    image.style.backgroundPosition = "center";
    image.style.backgroundRepeat = "no-repeat";
    image.style.backgroundSize = "cover";
  }

  document.querySelectorAll("img[data-blurhash]").forEach(placeholderFor);
}());
