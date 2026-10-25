/* Shared by the web tracker and the APK. Missing tiles retry their nearest real parent. */
(function (root) {
  root.createHelpdeskSatelliteLayer = function (L) {
    var Layer = L.GridLayer.extend({
      createTile: function (coords, done) {
        var canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
        var original = { x: coords.x, y: coords.y, z: coords.z };
        function load(z) {
          var factor = Math.pow(2, original.z - z), x = Math.floor(original.x / factor), y = Math.floor(original.y / factor);
          var image = new Image(); image.crossOrigin = 'anonymous';
          image.onload = function () {
            var size = 256 / factor;
            canvas.getContext('2d').drawImage(image, (original.x - x * factor) * size, (original.y - y * factor) * size, size, size, 0, 0, 256, 256);
            done(null, canvas);
          };
          image.onerror = function () { if (z > 12) load(z - 1); else done(new Error('Citra satelit belum tersedia'), canvas); };
          image.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x + '?blankTile=false';
        }
        load(Math.min(coords.z, 19)); return canvas;
      }
    });
    return new Layer({ minZoom: 3, maxZoom: 19, maxNativeZoom: 19, keepBuffer: 2, updateWhenIdle: true, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
  };
})(window);
