import * as THREE from "./vendor/three.module.min.js";

(function () {
  "use strict";

  var FLOOR_LIFT = 14;
  var ISO_AZ = Math.PI / 4;
  var ISO_POL = Math.atan(1 / Math.sqrt(2));
  var TONE = { ok: 0x22c55e, wait: 0xeab308, error: 0xef4444, idle: 0x9ca3af };
  var tmp = new THREE.Vector3();
  var core = function () {
    return window.HQCore;
  };

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function hexNum(hex) {
    return parseInt(String(hex).slice(1), 16);
  }

  function themeOf(team) {
    var t = String(team || "").toLowerCase();
    if (t.indexOf("paid") !== -1 || t === "product" || t.indexOf("sales") !== -1) return "charts";
    if (t === "game") return "game";
    if (t === "homerun") return "homerun";
    if (t === "research" || t === "engineering") return "books";
    if (t === "ops") return "ops";
    return "generic";
  }

  function layoutDesks(count, theme) {
    var spots = [];
    var i;
    if (theme === "books" && count <= 5) {
      var ring = [
        [-2.4, -1.1],
        [2.0, -1.3],
        [-0.2, 1.8],
        [3.4, 1.3],
        [-3.4, 1.5]
      ];
      for (i = 0; i < count; i++) {
        spots.push({ x: ring[i][0], z: ring[i][1], rot: 0, round: true });
      }
      return spots;
    }
    var cols = count <= 4 ? Math.max(count, 1) : Math.ceil(count / 2);
    var rows = Math.ceil(count / cols) || 1;
    var n = 0;
    var r;
    var c;
    for (r = 0; r < rows; r++) {
      var rowCount = Math.min(cols, count - n);
      var startX = -((rowCount - 1) * 2.2) / 2;
      for (c = 0; c < rowCount; c++) {
        spots.push({
          x: startX + c * 2.2,
          z: (r - (rows - 1) / 2) * 3.15,
          rot: r % 2 ? Math.PI : 0,
          round: false
        });
        n += 1;
      }
    }
    return spots;
  }

  function roomSize(spots) {
    var maxX = 5;
    var maxZ = 4;
    for (var i = 0; i < spots.length; i++) {
      maxX = Math.max(maxX, Math.abs(spots[i].x) + 3.4);
      maxZ = Math.max(maxZ, Math.abs(spots[i].z) + 3.2);
    }
    return { w: maxX * 2, d: maxZ * 2 };
  }

  function disposeObject(obj) {
    obj.traverse(function (node) {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        var list = Array.isArray(node.material) ? node.material : [node.material];
        for (var i = 0; i < list.length; i++) {
          if (list[i].map) list[i].map.dispose();
          list[i].dispose();
        }
      }
    });
  }

  function mat(color, extras) {
    var opts = { color: color, roughness: 0.42, metalness: 0.04 };
    if (extras) {
      var keys = Object.keys(extras);
      for (var i = 0; i < keys.length; i++) opts[keys[i]] = extras[keys[i]];
    }
    return new THREE.MeshStandardMaterial(opts);
  }

  function mesh(geo, material, cast, receive) {
    var m = new THREE.Mesh(geo, material);
    m.castShadow = !!cast;
    m.receiveShadow = !!receive;
    return m;
  }

  function textTexture(text, fill, width, height, fontPx) {
    var canvas = document.createElement("canvas");
    canvas.width = width || 512;
    canvas.height = height || 128;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = fill || "#6b7280";
    ctx.font = "600 " + (fontPx || 44) + "px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(String(text).slice(0, 48), 18, canvas.height / 2);
    var tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function shapeMesh(shape, material) {
    var s = 0.4;
    var g;
    var i;
    var piece;
    if (shape === "rounded_square") {
      return mesh(new THREE.BoxGeometry(s * 1.55, s * 1.55, s * 1.55), material, true);
    }
    if (shape === "hexagon") {
      return mesh(new THREE.CylinderGeometry(s, s, s * 1.25, 6), material, true);
    }
    if (shape === "cone") {
      return mesh(new THREE.ConeGeometry(s * 0.95, s * 1.55, 18), material, true);
    }
    if (shape === "triangle") {
      return mesh(new THREE.ConeGeometry(s * 1.05, s * 1.45, 3), material, true);
    }
    if (shape === "pentagon") {
      return mesh(new THREE.CylinderGeometry(s, s, s * 1.15, 5), material, true);
    }
    if (shape === "pill") {
      return mesh(new THREE.CapsuleGeometry(s * 0.42, s * 0.7, 6, 12), material, true);
    }
    if (shape === "star6" || shape === "star4") {
      piece = mesh(new THREE.OctahedronGeometry(s * 1.15, 0), material, true);
      if (shape === "star4") piece.rotation.y = Math.PI / 4;
      return piece;
    }
    if (shape === "cloud") {
      g = new THREE.Group();
      g.add(mesh(new THREE.SphereGeometry(s * 0.68, 16, 12), material, true));
      piece = mesh(new THREE.SphereGeometry(s * 0.55, 14, 10), material, true);
      piece.position.set(-0.28, -0.04, 0.04);
      g.add(piece);
      piece = mesh(new THREE.SphereGeometry(s * 0.5, 14, 10), material, true);
      piece.position.set(0.26, -0.02, 0.02);
      g.add(piece);
      return g;
    }
    if (shape === "bubble") {
      g = new THREE.Group();
      g.add(mesh(new THREE.SphereGeometry(s, 20, 14), material, true));
      piece = mesh(new THREE.ConeGeometry(s * 0.26, s * 0.38, 8), material, true);
      piece.rotation.z = Math.PI * 0.92;
      piece.position.set(-0.2, -s * 0.82, 0.06);
      g.add(piece);
      return g;
    }
    if (shape === "clover") {
      g = new THREE.Group();
      var clover = [
        [0, 0.22],
        [-0.2, -0.04],
        [0.2, -0.04],
        [0, -0.24]
      ];
      for (i = 0; i < clover.length; i++) {
        piece = mesh(new THREE.SphereGeometry(s * 0.46, 14, 10), material, true);
        piece.position.set(clover[i][0], clover[i][1], 0);
        g.add(piece);
      }
      return g;
    }
    if (shape === "trio") {
      g = new THREE.Group();
      var trio = [
        [0, 0.22],
        [-0.2, -0.16],
        [0.2, -0.16]
      ];
      for (i = 0; i < trio.length; i++) {
        piece = mesh(new THREE.SphereGeometry(s * 0.38, 12, 10), material, true);
        piece.position.set(trio[i][0], trio[i][1], 0);
        g.add(piece);
      }
      return g;
    }
    if (shape === "flower") {
      g = new THREE.Group();
      g.add(mesh(new THREE.SphereGeometry(s * 0.32, 12, 10), material, true));
      for (i = 0; i < 6; i++) {
        piece = mesh(new THREE.SphereGeometry(s * 0.26, 10, 8), material, true);
        var a = (i / 6) * Math.PI * 2;
        piece.position.set(Math.cos(a) * s * 0.46, Math.sin(a) * s * 0.46, 0);
        g.add(piece);
      }
      return g;
    }
    if (shape === "drop") {
      g = new THREE.Group();
      g.add(mesh(new THREE.SphereGeometry(s * 0.68, 16, 12), material, true));
      piece = mesh(new THREE.ConeGeometry(s * 0.68, s * 0.9, 16), material, true);
      piece.position.y = s * 0.52;
      g.add(piece);
      return g;
    }
    return mesh(new THREE.SphereGeometry(s, 22, 16), material, true);
  }

  function addAccessory(group, accessory) {
    var piece;
    if (accessory === "glasses") {
      var frame = mat(0x1b1f2a, { roughness: 0.35 });
      piece = mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 16), frame, true);
      piece.position.set(-0.11, 0.06, 0.26);
      group.add(piece);
      piece = mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 16), frame, true);
      piece.position.set(0.11, 0.06, 0.26);
      group.add(piece);
    } else if (accessory === "antenna") {
      piece = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 8), mat(0x4b5563), true);
      piece.position.y = 0.52;
      group.add(piece);
      piece = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(0xf0b429, { metalness: 0.35 }), true);
      piece.position.y = 0.68;
      group.add(piece);
    } else if (accessory === "stem") {
      piece = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), mat(0x4caf7a), true);
      piece.position.set(0.12, 0.48, 0);
      piece.rotation.z = -0.45;
      group.add(piece);
      piece = mesh(new THREE.SphereGeometry(0.075, 10, 8), mat(0x5ecf8d), true);
      piece.scale.set(1.5, 0.42, 0.85);
      piece.position.set(0.22, 0.56, 0);
      group.add(piece);
    } else if (accessory === "bow") {
      var red = mat(0xef6b73);
      piece = mesh(new THREE.ConeGeometry(0.09, 0.15, 3), red, true);
      piece.rotation.z = Math.PI / 2;
      piece.position.set(-0.07, -0.26, 0.18);
      group.add(piece);
      piece = mesh(new THREE.ConeGeometry(0.09, 0.15, 3), red, true);
      piece.rotation.z = -Math.PI / 2;
      piece.position.set(0.07, -0.26, 0.18);
      group.add(piece);
    }
  }

  function makeBot(look) {
    var group = new THREE.Group();
    var bodyMat = mat(hexNum(look.color), { roughness: 0.32, metalness: 0.06 });
    var body = shapeMesh(look.shape, bodyMat);
    body.position.y = 0.28;
    group.scale.set(1.2, 1.2, 1.2);
    group.add(body);
    addAccessory(group, look.accessory);
    return group;
  }

  function makeBadge() {
    var group = new THREE.Group();
    var disc = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 24), mat(0xffffff, { roughness: 0.25 }), true);
    disc.rotation.x = Math.PI / 2;
    var dot = mesh(
      new THREE.SphereGeometry(0.075, 12, 10),
      mat(TONE.idle, { emissive: TONE.idle, emissiveIntensity: 0.18 }),
      true
    );
    dot.position.z = 0.02;
    group.add(disc);
    group.add(dot);
    group.userData.dot = dot;
    return group;
  }

  function setBadgeTone(badge, tone) {
    var color = TONE[tone] || TONE.idle;
    var dot = badge.userData.dot;
    if (!dot) return;
    dot.material.color.setHex(color);
    dot.material.emissive.setHex(color);
  }

  function makePlant(scale) {
    var g = new THREE.Group();
    var s = scale || 1;
    var trunk = mesh(new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 0.7 * s, 8), mat(0x4b5563), true);
    trunk.position.y = 0.35 * s;
    var leaf = mesh(new THREE.SphereGeometry(0.28 * s, 16, 12), mat(0x86c48a, { roughness: 0.55 }), true);
    leaf.position.y = 0.78 * s;
    g.add(trunk);
    g.add(leaf);
    return g;
  }

  function makeClock() {
    var g = new THREE.Group();
    var face = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 24), mat(0xffffff), true);
    face.rotation.x = Math.PI / 2;
    var rim = mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 24), mat(0xd1d5db), true);
    g.add(face);
    g.add(rim);
    var hand = mesh(new THREE.BoxGeometry(0.03, 0.14, 0.02), mat(0x111827), true);
    hand.position.y = 0.05;
    g.add(hand);
    return g;
  }

  function makeMonitor() {
    var g = new THREE.Group();
    var stand = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8), mat(0xd1d5db, { metalness: 0.2 }), true);
    stand.position.y = 0.14;
    var base = mesh(new THREE.BoxGeometry(0.22, 0.03, 0.14), mat(0xd1d5db), true);
    var screen = mesh(new THREE.BoxGeometry(0.62, 0.4, 0.04), mat(0x111827, { roughness: 0.28 }), true);
    screen.position.set(0, 0.38, 0);
    var bezel = mesh(new THREE.BoxGeometry(0.52, 0.32, 0.02), mat(0xf8fafc), true);
    bezel.position.set(0, 0.38, 0.022);
    g.add(base);
    g.add(stand);
    g.add(screen);
    g.add(bezel);
    return g;
  }

  function makeDesk(round) {
    var g = new THREE.Group();
    var top = mesh(
      round ? new THREE.CylinderGeometry(0.72, 0.72, 0.08, 24) : new THREE.BoxGeometry(1.85, 0.08, 0.95),
      mat(0xf7f7f8, { roughness: 0.35 }),
      true,
      true
    );
    top.position.y = 0.74;
    g.add(top);
    if (!round) {
      var legs = [
        [-0.8, -0.38],
        [0.8, -0.38],
        [-0.8, 0.38],
        [0.8, 0.38]
      ];
      for (var i = 0; i < legs.length; i++) {
        var leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), mat(0xe5e7eb), true);
        leg.position.set(legs[i][0], 0.35, legs[i][1]);
        g.add(leg);
      }
      var keys = mesh(new THREE.BoxGeometry(0.42, 0.025, 0.16), mat(0x374151), true);
      keys.position.set(0, 0.79, 0.18);
      g.add(keys);
      var monitor = makeMonitor();
      monitor.position.set(0, 0.78, -0.18);
      g.add(monitor);
    } else {
      var pole = mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.7, 12), mat(0xe5e7eb), true);
      pole.position.y = 0.35;
      g.add(pole);
      var monitor = makeMonitor();
      monitor.position.set(0, 0.78, 0);
      monitor.scale.set(0.85, 0.85, 0.85);
      g.add(monitor);
    }
    return g;
  }

  function makeChair() {
    var g = new THREE.Group();
    var black = mat(0x1f2430, { roughness: 0.45 });
    var seat = mesh(new THREE.BoxGeometry(0.48, 0.07, 0.48), black, true);
    seat.position.y = 0.46;
    var back = mesh(new THREE.BoxGeometry(0.48, 0.46, 0.07), black, true);
    back.position.set(0, 0.72, -0.22);
    var stem = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8), black, true);
    stem.position.y = 0.22;
    var base = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16), black, true);
    base.position.y = 0.03;
    g.add(seat);
    g.add(back);
    g.add(stem);
    g.add(base);
    return g;
  }

  function makeBookshelf(h) {
    var g = new THREE.Group();
    var height = h || 2.2;
    var shell = mesh(new THREE.BoxGeometry(1.5, height, 0.32), mat(0xf3f4f6), true, true);
    shell.position.y = height / 2;
    g.add(shell);
    var colors = [0x7c9cff, 0xe8a0bf, 0x7dcea0, 0xf5c16c, 0xa78bfa, 0x67e8f9, 0xfca5a5];
    var rows = 4;
    var r;
    var b;
    for (r = 0; r < rows; r++) {
      for (b = 0; b < 7; b++) {
        var book = mesh(
          new THREE.BoxGeometry(0.12, 0.32, 0.22),
          mat(colors[(r + b) % colors.length]),
          true
        );
        book.position.set(-0.58 + b * 0.19, 0.32 + r * 0.5, 0.02);
        g.add(book);
      }
    }
    return g;
  }

  function makeChartWall(w) {
    var g = new THREE.Group();
    var screen = mesh(new THREE.BoxGeometry(w || 2.6, 1.15, 0.08), mat(0x111827), true);
    g.add(screen);
    var bars = [0.35, 0.55, 0.42, 0.7, 0.5, 0.62];
    for (var i = 0; i < bars.length; i++) {
      var bar = mesh(new THREE.BoxGeometry(0.16, bars[i], 0.04), mat(0x93c5fd, { emissive: 0x2563eb, emissiveIntensity: 0.15 }), true);
      bar.position.set(-0.9 + i * 0.34, -0.35 + bars[i] / 2, 0.06);
      g.add(bar);
    }
    return g;
  }

  function makeServerRack() {
    var g = new THREE.Group();
    var body = mesh(new THREE.BoxGeometry(1.1, 2.1, 0.55), mat(0x1f2937), true);
    body.position.y = 1.05;
    g.add(body);
    var i;
    for (i = 0; i < 10; i++) {
      var slot = mesh(new THREE.BoxGeometry(0.92, 0.08, 0.04), mat(0x111827), true);
      slot.position.set(0, 0.22 + i * 0.18, 0.28);
      g.add(slot);
      var led = mesh(
        new THREE.BoxGeometry(0.05, 0.04, 0.03),
        mat(i % 3 ? 0x22c55e : 0xeab308, { emissive: i % 3 ? 0x22c55e : 0xeab308, emissiveIntensity: 0.5 }),
        true
      );
      led.position.set(0.38, 0.22 + i * 0.18, 0.3);
      g.add(led);
    }
    return g;
  }

  function makePingPong() {
    var g = new THREE.Group();
    var table = mesh(new THREE.BoxGeometry(1.7, 0.07, 0.95), mat(0xf8fafc), true);
    table.position.y = 0.72;
    var net = mesh(new THREE.BoxGeometry(0.04, 0.16, 0.95), mat(0x111827), true);
    net.position.y = 0.84;
    var leg;
    var pts = [
      [-0.7, -0.38],
      [0.7, -0.38],
      [-0.7, 0.38],
      [0.7, 0.38]
    ];
    for (var i = 0; i < pts.length; i++) {
      leg = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.68, 8), mat(0xe5e7eb), true);
      leg.position.set(pts[i][0], 0.34, pts[i][1]);
      g.add(leg);
    }
    g.add(table);
    g.add(net);
    return g;
  }

  function makeTrophy() {
    var g = new THREE.Group();
    var cup = mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22, 12), mat(0xf5c16c, { metalness: 0.45, roughness: 0.25 }), true);
    cup.position.y = 0.34;
    var stem = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 8), mat(0xf5c16c, { metalness: 0.4 }), true);
    stem.position.y = 0.16;
    var base = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), mat(0x1f2937), true);
    base.position.y = 0.03;
    g.add(base);
    g.add(stem);
    g.add(cup);
    return g;
  }

  function makeOttoman() {
    return mesh(new THREE.BoxGeometry(0.7, 0.22, 0.7), mat(0x1f2937), true, true);
  }

  function makeSofa() {
    var g = new THREE.Group();
    var seat = mesh(new THREE.BoxGeometry(1.15, 0.28, 0.62), mat(0x1f2937), true, true);
    seat.position.y = 0.22;
    var back = mesh(new THREE.BoxGeometry(1.15, 0.42, 0.16), mat(0x14532d), true);
    back.position.set(0, 0.42, -0.24);
    g.add(seat);
    g.add(back);
    return g;
  }

  function addThemedProps(room, theme, size) {
    var plant;
    var i;
    var clock = makeClock();
    clock.position.set(-size.w * 0.28, 2.15, size.d / 2 - 0.08);
    room.add(clock);

    plant = makePlant(1);
    plant.position.set(size.w * 0.38, 0, -size.d * 0.32);
    room.add(plant);
    plant = makePlant(0.85);
    plant.position.set(-size.w * 0.4, 0, size.d * 0.18);
    room.add(plant);

    if (theme === "charts") {
      var chart = makeChartWall(2.8);
      chart.position.set(0.8, 1.7, size.d / 2 - 0.08);
      room.add(chart);
      room.add(makeOttoman());
      room.children[room.children.length - 1].position.set(size.w * 0.28, 0.11, size.d * 0.28);
      room.add(makeOttoman());
      room.children[room.children.length - 1].position.set(size.w * 0.28 + 0.85, 0.11, size.d * 0.28);
    } else if (theme === "books") {
      var shelf = makeBookshelf(2.3);
      shelf.position.set(size.w / 2 - 0.3, 0, 0.2);
      shelf.rotation.y = -Math.PI / 2;
      room.add(shelf);
      shelf = makeBookshelf(1.8);
      shelf.position.set(-size.w / 2 + 1.0, 0, size.d / 2 - 0.3);
      room.add(shelf);
      var globe = new THREE.Group();
      globe.add(mesh(new THREE.SphereGeometry(0.18, 16, 12), mat(0x60a5fa, { metalness: 0.2 }), true));
      globe.position.set(-1.6, 0.28, 1.4);
      var stand = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.28, 8), mat(0x1f2937), true);
      stand.position.y = -0.22;
      globe.add(stand);
      room.add(globe);
      var sofa = makeSofa();
      sofa.position.set(size.w * 0.28, 0, size.d * 0.28);
      sofa.rotation.y = -0.6;
      room.add(sofa);
    } else if (theme === "game") {
      var table = makePingPong();
      table.position.set(0, 0, size.d * 0.32);
      room.add(table);
      var arcade = mesh(new THREE.BoxGeometry(0.7, 1.3, 0.55), mat(0x111827), true);
      arcade.position.set(size.w * 0.36, 0.65, -size.d * 0.22);
      room.add(arcade);
    } else if (theme === "homerun") {
      var trophy = makeTrophy();
      trophy.position.set(size.w * 0.3, 0, size.d * 0.26);
      room.add(trophy);
      var bat = mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.1, 8), mat(0xc4a484), true);
      bat.rotation.z = 0.4;
      bat.position.set(size.w * 0.34, 0.4, size.d * 0.18);
      room.add(bat);
      var chart = makeChartWall(2.2);
      chart.position.set(0.4, 1.7, size.d / 2 - 0.08);
      room.add(chart);
    } else if (theme === "ops") {
      var rack = makeServerRack();
      rack.position.set(size.w / 2 - 0.45, 0, 0.4);
      room.add(rack);
      rack = makeServerRack();
      rack.position.set(size.w / 2 - 0.45, 0, 1.15);
      room.add(rack);
      var monitors = makeChartWall(3.1);
      monitors.position.set(0.2, 1.85, size.d / 2 - 0.08);
      room.add(monitors);
    } else {
      var board = makeChartWall(2.0);
      board.position.set(0.6, 1.65, size.d / 2 - 0.08);
      room.add(board);
    }

    for (i = 0; i < 3; i++) {
      var extra = makePlant(0.7 + (i % 2) * 0.15);
      extra.position.set(-size.w * 0.18 + i * 1.4, 0, -size.d * 0.36);
      room.add(extra);
    }
  }

  function addWindows(wall, width, height, horizontal) {
    var cols = Math.max(3, Math.round(width / 1.6));
    var rows = 2;
    var r;
    var c;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        var pane = mesh(
          new THREE.BoxGeometry(horizontal ? 0.7 : 0.06, 0.7, horizontal ? 0.06 : 0.7),
          mat(0x93c5fd, { transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.1 }),
          false,
          false
        );
        if (horizontal) {
          pane.position.set(-width / 2 + 1.0 + c * ((width - 2) / Math.max(cols - 1, 1)), 1.15 + r * 1.05, 0.06);
        } else {
          pane.position.set(0.06, 1.15 + r * 1.05, -height / 2 + 1.0 + c * ((height - 2) / Math.max(cols - 1, 1)));
        }
        wall.add(pane);
      }
    }
  }

  function makeFloorRoom(floor, index, total, size, hq, hqState) {
    var y = (total - 1 - index) * FLOOR_LIFT;
    var room = new THREE.Group();
    room.position.y = y;
    room.userData.team = floor.team;
    room.userData.index = index;

    var slab = mesh(new THREE.BoxGeometry(size.w + 0.6, 0.18, size.d + 0.6), mat(0xf4f4f6, { roughness: 0.55 }), false, true);
    slab.position.y = -0.09;
    room.add(slab);

    var backWall = mesh(new THREE.BoxGeometry(size.w + 0.6, 3.7, 0.16), mat(0xe7e9ee, { roughness: 0.62 }), false, true);
    backWall.position.set(0, 1.85, size.d / 2);
    room.add(backWall);
    var backWins = new THREE.Group();
    addWindows(backWins, size.w, size.d, true);
    backWins.position.set(0, 0, size.d / 2);
    room.add(backWins);

    var sideWall = mesh(new THREE.BoxGeometry(0.16, 3.7, size.d + 0.6), mat(0xe7e9ee, { roughness: 0.62 }), false, true);
    sideWall.position.set(size.w / 2, 1.85, 0);
    room.add(sideWall);
    var winSide = new THREE.Group();
    addWindows(winSide, size.d, size.d, false);
    winSide.position.set(size.w / 2, 0, 0);
    room.add(winSide);

    var rail = mesh(new THREE.BoxGeometry(0.06, 1.15, size.d * 0.55), mat(0xffffff), false, false);
    rail.position.set(-size.w / 2 + 0.1, 0.7, size.d * 0.12);
    room.add(rail);

    var labelTex = textTexture(floor.team, "#6b7280", 640, 128, 52);
    var label = mesh(new THREE.PlaneGeometry(3.2, 0.64), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
    label.position.set(-size.w * 0.12, 2.35, size.d / 2 - 0.1);
    room.add(label);

    var subTex = textTexture("Floor " + String(total - index), "#9ca3af", 360, 80, 36);
    var sub = mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: subTex, transparent: true }));
    sub.position.set(1.7, 2.28, size.d / 2 - 0.1);
    room.add(sub);

    addThemedProps(room, themeOf(floor.team), size);

    var spots = layoutDesks(floor.bots.length, themeOf(floor.team));
    var bots = [];
    for (var i = 0; i < floor.bots.length; i++) {
      var spot = spots[i] || { x: i * 2, z: 0, rot: 0, round: false };
      var desk = makeDesk(spot.round);
      desk.position.set(spot.x, 0, spot.z);
      desk.rotation.y = spot.rot;
      room.add(desk);

      var chair = makeChair();
      var chairZ = spot.round ? spot.z + 0.95 : spot.z + (spot.rot ? -0.95 : 0.95);
      chair.position.set(spot.x, 0, chairZ);
      chair.rotation.y = spot.rot + (spot.rot ? 0 : Math.PI);
      if (spot.round) chair.rotation.y = Math.PI;
      room.add(chair);

      var look = hq.lookFor(hqState || { looks: {} }, floor.bots[i]);
      var bot = makeBot(look);
      var sit = new THREE.Group();
      sit.position.set(spot.x, 0.62, chairZ + (spot.round ? -0.02 : spot.rot ? 0.02 : -0.02));
      sit.add(bot);
      var badge = makeBadge();
      badge.position.set(0, 1.15, 0);
      sit.add(badge);
      room.add(sit);
      bots.push({
        name: floor.bots[i],
        root: sit,
        bot: bot,
        badge: badge,
        look: look,
        phase: (hexNum(look.color) % 1000) / 1000 * Math.PI * 2
      });
    }

    var fascia = mesh(new THREE.BoxGeometry(size.w + 0.7, 0.12, 0.18), mat(0xe5e7eb), false, true);
    fascia.position.set(0, 3.42, size.d / 2);
    room.add(fascia);
    fascia = mesh(new THREE.BoxGeometry(0.18, 0.12, size.d + 0.7), mat(0xe5e7eb), false, true);
    fascia.position.set(size.w / 2, 3.42, 0);
    room.add(fascia);

    var lamp = new THREE.PointLight(0xffe4b5, 0, 10, 2);
    lamp.position.set(0, 2.6, 0);
    room.add(lamp);

    return { group: room, bots: bots, lamp: lamp, y: y };
  }

  function floorsKey(floors) {
    return floors
      .map(function (floor) {
        return floor.team + ":" + floor.bots.join("\0");
      })
      .join("|");
  }

  function createOffice() {
    var renderer = null;
    var scene = null;
    var camera = null;
    var elapsed = 0;
    var lastTick = 0;
    var stage = null;
    var overlays = null;
    var building = null;
    var floorRows = [];
    var botIndex = {};
    var raf = 0;
    var mounted = false;
    var reducedMotion = false;
    var theme = "day";
    var live = true;
    var currentFloor = 0;
    var lastKey = "";
    var pending = null;
    var speeches = [];
    var az = ISO_AZ;
    var pol = ISO_POL;
    var dist = 26;
    var CLOSE_SIZE = 6.4;
  var MID_SIZE = 15;
  var orthoSize = CLOSE_SIZE;
    var camTarget = new THREE.Vector3(0, 1.2, 0);
    var anim = null;
    var drag = null;
    var hemi = null;
    var ambient = null;
    var sun = null;
    var lightsOn = true;

    function applyTheme() {
      if (!scene) return;
      var night = theme === "night";
      scene.background = new THREE.Color(night ? 0x0e1118 : 0xf3f4f7);
      if (ambient) ambient.intensity = night ? 0.28 : 0.72;
      if (hemi) {
        hemi.color.setHex(night ? 0x334155 : 0xf8fafc);
        hemi.groundColor.setHex(night ? 0x111827 : 0xe7e2d8);
        hemi.intensity = night ? 0.22 : 0.55;
      }
      if (sun) {
        sun.color.setHex(night ? 0x93c5fd : 0xffffff);
        sun.intensity = night ? 0.28 : 1.05;
      }
      for (var i = 0; i < floorRows.length; i++) {
        if (floorRows[i].lamp) floorRows[i].lamp.intensity = night ? 1.15 : 0;
      }
      lightsOn = true;
    }

    function placeCamera() {
      var x = camTarget.x - Math.sin(az) * Math.cos(pol) * dist;
      var y = camTarget.y + Math.sin(pol) * dist;
      var z = camTarget.z - Math.cos(az) * Math.cos(pol) * dist;
      camera.position.set(x, y, z);
      camera.lookAt(camTarget);
      var aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
      camera.left = -orthoSize * aspect;
      camera.right = orthoSize * aspect;
      camera.top = orthoSize;
      camera.bottom = -orthoSize;
      camera.near = 0.1;
      camera.far = 200;
      camera.updateProjectionMatrix();
    }

    function resize() {
      if (!renderer || !stage) return;
      var w = stage.clientWidth || 1;
      var h = stage.clientHeight || 1;
      renderer.setSize(w, h, false);
      placeCamera();
    }

    function rebuild(state, floors) {
      if (building) {
        scene.remove(building);
        disposeObject(building);
      }
      building = new THREE.Group();
      floorRows = [];
      botIndex = {};
      var max = { w: 16, d: 12 };
      var i;
      for (i = 0; i < floors.length; i++) {
        var sized = roomSize(layoutDesks(floors[i].bots.length, themeOf(floors[i].team)));
        max.w = Math.max(max.w, sized.w);
        max.d = Math.max(max.d, sized.d);
      }
      for (i = 0; i < floors.length; i++) {
        var row = makeFloorRoom(floors[i], i, floors.length, max, core(), state);
        building.add(row.group);
        floorRows.push(row);
        for (var b = 0; b < row.bots.length; b++) botIndex[row.bots[b].name] = row.bots[b];
      }
      var ground = mesh(new THREE.BoxGeometry(max.w + 8, 0.4, max.d + 8), mat(0x111827), false, true);
      ground.position.y = -0.55;
      building.add(ground);
      scene.add(building);
      applyTheme();
      if (floors.length) {
        var y = (floors.length - 1 - Math.min(currentFloor, floors.length - 1)) * FLOOR_LIFT;
        camTarget.set(0, y + 1.15, 0);
      }
    }

    function syncBots(state) {
      var hq = core();
      var names = Object.keys(botIndex);
      for (var i = 0; i < names.length; i++) {
        var entry = botIndex[names[i]];
        var status = state.statuses[names[i]];
        var kind = status ? status.status : "";
        setBadgeTone(entry.badge, hq.badgeTone(kind));
        entry.status = kind;
        var look = hq.lookFor(state, names[i]);
        if (look.color !== entry.look.color || look.shape !== entry.look.shape || look.accessory !== entry.look.accessory) {
          entry.root.remove(entry.bot);
          disposeObject(entry.bot);
          entry.bot = makeBot(look);
          entry.root.add(entry.bot);
          entry.look = look;
        }
      }
    }

    function updateOverlays() {
      if (!overlays || !camera || !stage) return;
      var w = stage.clientWidth;
      var h = stage.clientHeight;
      var now = performance.now();
      var next = [];
      for (var i = 0; i < speeches.length; i++) {
        var item = speeches[i];
        var age = now - item.born;
        if (age > item.life) {
          if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
          continue;
        }
        if (age > item.life - 700) item.el.classList.add("is-out");
        var entry = botIndex[item.name];
        if (!entry) {
          item.el.style.display = "none";
          next.push(item);
          continue;
        }
        entry.root.getWorldPosition(tmp);
        tmp.y += 1.35;
        tmp.project(camera);
        if (tmp.z > 1) {
          item.el.style.display = "none";
        } else {
          item.el.style.display = "block";
          item.el.style.left = ((tmp.x * 0.5 + 0.5) * w).toFixed(1) + "px";
          item.el.style.top = ((-tmp.y * 0.5 + 0.5) * h).toFixed(1) + "px";
        }
        next.push(item);
      }
      speeches = next;
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      var nowTick = performance.now();
      var dt = lastTick ? Math.min(0.05, (nowTick - lastTick) / 1000) : 0.016;
      lastTick = nowTick;
      elapsed += dt;
      if (anim) {
        anim.t += dt;
        if (anim.phase === 0) {
          var u = clamp(anim.t / 0.38, 0, 1);
          orthoSize = lerp(anim.fromSize, anim.midSize, ease(u));
          if (u >= 1) {
            anim.phase = 1;
            anim.t = 0;
          }
        } else if (anim.phase === 1) {
          var p = clamp(anim.t / 0.58, 0, 1);
          camTarget.y = lerp(anim.fromY, anim.toY, ease(p));
          if (p >= 1) {
            anim.phase = 2;
            anim.t = 0;
          }
        } else {
          var z = clamp(anim.t / 0.36, 0, 1);
          orthoSize = lerp(anim.midSize, anim.toSize, ease(z));
          if (z >= 1) anim = null;
        }
      }
      if (live && !reducedMotion) {
        var t = elapsed;
        var names = Object.keys(botIndex);
        for (var i = 0; i < names.length; i++) {
          var entry = botIndex[names[i]];
          var working = entry.status === "working" || entry.status === "done";
          var amp = working ? 0.055 : 0.012;
          entry.bot.position.y = Math.sin(t * 2.1 + entry.phase) * amp;
          entry.badge.position.y = 1.15 + Math.sin(t * 1.6 + entry.phase) * 0.03;
        }
      }
      placeCamera();
      updateOverlays();
      renderer.render(scene, camera);
    }

    function onPointerDown(ev) {
      drag = { x: ev.clientX, y: ev.clientY };
      if (stage.setPointerCapture) stage.setPointerCapture(ev.pointerId);
    }

    function onPointerMove(ev) {
      if (!drag) return;
      az -= (ev.clientX - drag.x) * 0.005;
      pol = clamp(pol + (ev.clientY - drag.y) * 0.004, 0.28, 1.15);
      drag = { x: ev.clientX, y: ev.clientY };
    }

    function onPointerUp() {
      drag = null;
    }

    function onWheel(ev) {
      ev.preventDefault();
      orthoSize = clamp(orthoSize + ev.deltaY * 0.01, 6.5, 30);
    }

    function mount(el, opts) {
      if (mounted) return;
      stage = el;
      overlays = document.getElementById("hq-bubbles");
      reducedMotion = !!(opts && opts.reducedMotion);
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      stage.appendChild(renderer.domElement);
      ambient = new THREE.AmbientLight(0xffffff, 0.7);
      hemi = new THREE.HemisphereLight(0xf8fafc, 0xe7e2d8, 0.55);
      sun = new THREE.DirectionalLight(0xffffff, 1.05);
      sun.position.set(12, 22, 8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -22;
      sun.shadow.camera.right = 22;
      sun.shadow.camera.top = 22;
      sun.shadow.camera.bottom = -22;
      scene.add(ambient);
      scene.add(hemi);
      scene.add(sun);
      elapsed = 0;
      lastTick = performance.now();
      applyTheme();
      stage.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      stage.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("resize", resize);
      mounted = true;
      resize();
      if (pending) {
        update(pending.state, pending.floors);
        pending = null;
      }
      tick();
    }

    function update(state, floors) {
      if (!mounted) {
        pending = { state: state, floors: floors };
        return;
      }
      var key = floorsKey(floors || []);
      if (key !== lastKey) {
        lastKey = key;
        rebuild(state, floors || []);
      }
      syncBots(state);
    }

    function focusFloor(index, instant) {
      if (!floorRows.length) {
        currentFloor = index;
        return;
      }
      currentFloor = clamp(index, 0, floorRows.length - 1);
      var destY = floorRows[currentFloor].y + 1.15;
      if (instant || reducedMotion) {
        camTarget.y = destY;
        orthoSize = CLOSE_SIZE;
        az = ISO_AZ;
        pol = ISO_POL;
        anim = null;
        return;
      }
      anim = {
        phase: 0,
        t: 0,
        fromSize: orthoSize,
        midSize: Math.max(orthoSize, MID_SIZE),
        toSize: CLOSE_SIZE,
        fromY: camTarget.y,
        toY: destY
      };
    }

    function speak(name, text) {
      if (!overlays || !text) return;
      var i;
      for (i = speeches.length - 1; i >= 0; i--) {
        if (speeches[i].name === name) {
          if (speeches[i].el.parentNode) speeches[i].el.parentNode.removeChild(speeches[i].el);
          speeches.splice(i, 1);
        }
      }
      var node = document.createElement("div");
      node.className = "speech-bubble";
      node.textContent = text;
      overlays.appendChild(node);
      speeches.push({ name: name, el: node, born: performance.now(), life: 3800 });
    }

    function dispose() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (stage) {
        stage.removeEventListener("pointerdown", onPointerDown);
        stage.removeEventListener("wheel", onWheel);
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", resize);
      if (building) disposeObject(building);
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
      mounted = false;
    }

    return {
      mount: mount,
      update: update,
      focusFloor: focusFloor,
      setTheme: function (next) {
        theme = next === "night" ? "night" : "day";
        applyTheme();
      },
      setLive: function (next) {
        live = !!next;
      },
      setReducedMotion: function (next) {
        reducedMotion = !!next;
      },
      speak: speak,
      dispose: dispose,
      isMounted: function () {
        return mounted;
      },
      currentFloor: function () {
        return currentFloor;
      },
      resize: resize
    };
  }

  var api = createOffice();
  window.HQOffice = api;
  if (window.HQ && typeof window.HQ.attachOffice === "function") {
    window.HQ.attachOffice(api);
  }
})();
