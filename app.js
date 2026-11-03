(function () {
  "use strict";

  var core = window.HQCore;
  var SVG_NS = "http://www.w3.org/2000/svg";

  var state = core.createState();
  var seen = core.createSeen();
  var connection = "idle";
  var lastId = "";
  var activeTopic = "";
  var eventSource = null;
  var pollTimer = null;
  var reconnectTimer = null;
  var tickTimer = null;
  var backoffMs = 1000;
  var sseFailCount = 0;
  var root = null;
  var viewMode = "cards";
  var themeMode = "day";
  var liveOn = true;
  var officeApi = null;
  var officeWanted = false;
  var activeFloor = 0;
  var activityLog = [];
  var lastStatusKey = {};
  var drawerOpen = false;
  var viewReady = false;
  var officeIntroduced = false;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== "") node.textContent = text;
    return node;
  }

  function svg(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    if (attrs) {
      var keys = Object.keys(attrs);
      for (var i = 0; i < keys.length; i++) {
        node.setAttribute(keys[i], String(attrs[keys[i]]));
      }
    }
    return node;
  }

  function polygonPoints(cx, cy, r, n, rot) {
    var pts = [];
    var start = rot === undefined ? -Math.PI / 2 : rot;
    for (var i = 0; i < n; i++) {
      var a = start + (i * 2 * Math.PI) / n;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }

  function starPoints(cx, cy, outer, inner, n) {
    var pts = [];
    for (var i = 0; i < n * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var a = -Math.PI / 2 + (i * Math.PI) / n;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + "," + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(" ");
  }

  function shade(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amount));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    var b = Math.max(0, Math.min(255, (n & 255) + amount));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function appendFace(g) {
    g.appendChild(svg("ellipse", { cx: "26", cy: "34", rx: "2.4", ry: "2.8", fill: "#1b1f2a" }));
    g.appendChild(svg("ellipse", { cx: "38", cy: "34", rx: "2.4", ry: "2.8", fill: "#1b1f2a" }));
    g.appendChild(
      svg("path", {
        d: "M28 41.5c2.2 2.2 5.8 2.2 8 0",
        fill: "none",
        stroke: "#1b1f2a",
        "stroke-width": "1.6",
        "stroke-linecap": "round"
      })
    );
  }

  function appendAccessory(g, accessory, color) {
    if (accessory === "glasses") {
      g.appendChild(
        svg("rect", {
          x: "20.5",
          y: "30",
          width: "10",
          height: "8",
          rx: "2.4",
          fill: "none",
          stroke: "#1b1f2a",
          "stroke-width": "1.7"
        })
      );
      g.appendChild(
        svg("rect", {
          x: "33.5",
          y: "30",
          width: "10",
          height: "8",
          rx: "2.4",
          fill: "none",
          stroke: "#1b1f2a",
          "stroke-width": "1.7"
        })
      );
      g.appendChild(
        svg("path", {
          d: "M30.5 33.5h3",
          stroke: "#1b1f2a",
          "stroke-width": "1.6",
          "stroke-linecap": "round"
        })
      );
    } else if (accessory === "antenna") {
      g.appendChild(
        svg("path", {
          d: "M32 16v-8",
          stroke: shade(color, -40),
          "stroke-width": "2",
          "stroke-linecap": "round"
        })
      );
      g.appendChild(svg("circle", { cx: "32", cy: "6.5", r: "2.6", fill: "#f0b429" }));
    } else if (accessory === "stem") {
      g.appendChild(
        svg("path", {
          d: "M32 16c0-5 3-8 7-8",
          fill: "none",
          stroke: "#4caf7a",
          "stroke-width": "2",
          "stroke-linecap": "round"
        })
      );
      g.appendChild(
        svg("ellipse", {
          cx: "41",
          cy: "10",
          rx: "5",
          ry: "2.6",
          fill: "#5ecf8d",
          transform: "rotate(-25 41 10)"
        })
      );
    } else if (accessory === "bow") {
      g.appendChild(
        svg("path", {
          d: "M24 50 L32 47 L32 53 Z",
          fill: "#ef6b73"
        })
      );
      g.appendChild(
        svg("path", {
          d: "M40 50 L32 47 L32 53 Z",
          fill: "#ef6b73"
        })
      );
      g.appendChild(svg("circle", { cx: "32", cy: "50", r: "2", fill: "#f4c6c9" }));
    }
  }

  function appendBody(g, shape, color) {
    var dark = shade(color, -28);
    if (shape === "cloud") {
      g.appendChild(svg("ellipse", { cx: "24", cy: "36", rx: "11", ry: "9", fill: color }));
      g.appendChild(svg("ellipse", { cx: "40", cy: "37", rx: "12", ry: "10", fill: color }));
      g.appendChild(svg("ellipse", { cx: "32", cy: "28", rx: "11", ry: "10", fill: color }));
    } else if (shape === "rounded_square") {
      g.appendChild(svg("rect", { x: "14", y: "16", width: "36", height: "36", rx: "11", fill: color }));
    } else if (shape === "star4") {
      g.appendChild(svg("polygon", { points: starPoints(32, 34, 22, 9, 4), fill: color }));
    } else if (shape === "star6") {
      g.appendChild(svg("polygon", { points: starPoints(32, 34, 22, 10, 6), fill: color }));
    } else if (shape === "clover") {
      g.appendChild(svg("circle", { cx: "32", cy: "24", r: "9", fill: color }));
      g.appendChild(svg("circle", { cx: "23", cy: "34", r: "9", fill: color }));
      g.appendChild(svg("circle", { cx: "41", cy: "34", r: "9", fill: color }));
      g.appendChild(svg("circle", { cx: "32", cy: "42", r: "8", fill: color }));
    } else if (shape === "bubble") {
      g.appendChild(svg("circle", { cx: "32", cy: "32", r: "18", fill: color }));
      g.appendChild(svg("polygon", { points: "24,48 20,58 34,48", fill: color }));
    } else if (shape === "flower") {
      for (var i = 0; i < 6; i++) {
        var a = (i * Math.PI) / 3;
        g.appendChild(
          svg("ellipse", {
            cx: (32 + Math.cos(a) * 10).toFixed(1),
            cy: (34 + Math.sin(a) * 10).toFixed(1),
            rx: "8",
            ry: "6.5",
            fill: color,
            transform: "rotate(" + ((a * 180) / Math.PI).toFixed(1) + " " + (32 + Math.cos(a) * 10).toFixed(1) + " " + (34 + Math.sin(a) * 10).toFixed(1) + ")"
          })
        );
      }
      g.appendChild(svg("circle", { cx: "32", cy: "34", r: "8", fill: dark }));
    } else if (shape === "drop") {
      g.appendChild(
        svg("path", {
          d: "M32 12 C44 28 46 40 32 50 C18 40 20 28 32 12 Z",
          fill: color
        })
      );
    } else if (shape === "pill") {
      g.appendChild(svg("rect", { x: "16", y: "20", width: "32", height: "28", rx: "14", fill: color }));
    } else if (shape === "triangle") {
      g.appendChild(svg("polygon", { points: polygonPoints(32, 36, 20, 3), fill: color }));
    } else if (shape === "pentagon") {
      g.appendChild(svg("polygon", { points: polygonPoints(32, 34, 20, 5), fill: color }));
    } else if (shape === "hexagon") {
      g.appendChild(svg("polygon", { points: polygonPoints(32, 34, 20, 6, 0), fill: color }));
    } else if (shape === "cone") {
      g.appendChild(svg("polygon", { points: "32,14 50,44 14,44", fill: color }));
      g.appendChild(svg("ellipse", { cx: "32", cy: "44", rx: "18", ry: "6", fill: dark }));
    } else if (shape === "trio") {
      g.appendChild(svg("circle", { cx: "32", cy: "24", r: "9", fill: color }));
      g.appendChild(svg("circle", { cx: "23", cy: "40", r: "9", fill: color }));
      g.appendChild(svg("circle", { cx: "41", cy: "40", r: "9", fill: color }));
    } else {
      g.appendChild(svg("circle", { cx: "32", cy: "34", r: "18", fill: color }));
    }
  }

  function createAvatar(look) {
    var wrap = el("span", "avatar");
    var image = svg("svg", {
      viewBox: "0 0 64 64",
      width: "56",
      height: "56",
      "aria-hidden": "true"
    });
    var g = svg("g");
    appendBody(g, look.shape, look.color);
    appendFace(g);
    appendAccessory(g, look.accessory, look.color);
    image.appendChild(g);
    wrap.appendChild(image);
    return wrap;
  }

  function hasWebGL() {
    try {
      var canvas = document.createElement("canvas");
      return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch (err) {
      return false;
    }
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function defaultView() {
    if (prefersReducedMotion() || !hasWebGL()) return "cards";
    return "office";
  }

  function statusKey(status) {
    if (!status) return "";
    return status.status + "|" + status.step + "|" + status.time;
  }

  function noteActivity() {
    var names = core.collectNames(state);
    var i;
    for (i = 0; i < names.length; i++) {
      var name = names[i];
      var cur = state.statuses[name];
      var key = statusKey(cur);
      if (!cur || key === lastStatusKey[name]) {
        lastStatusKey[name] = key;
        continue;
      }
      var seenBefore = Object.prototype.hasOwnProperty.call(lastStatusKey, name);
      lastStatusKey[name] = key;
      activityLog.unshift({
        name: name,
        status: cur.status,
        step: cur.step,
        time: cur.time
      });
      if (activityLog.length > 40) activityLog.length = 40;
      if (officeApi && viewMode === "office") {
        officeApi.speak(name, core.speechFor(cur.status, cur.step));
      }
      if (seenBefore && liveOn && viewMode === "office") {
        var floors = core.buildFloors(state);
        for (var f = 0; f < floors.length; f++) {
          if (floors[f].bots.indexOf(name) !== -1) {
            setActiveFloor(f, false);
            break;
          }
        }
      }
    }
  }

  function applyBodyMode() {
    document.body.classList.toggle("view-office", viewMode === "office");
    document.body.classList.toggle("view-cards", viewMode === "cards");
    document.body.classList.toggle("theme-night", themeMode === "night");
    document.body.classList.toggle("theme-day", themeMode === "day");
    document.body.classList.toggle("drawer-open", drawerOpen);
  }

  function setActiveFloor(index, instant) {
    var floors = core.buildFloors(state);
    if (!floors.length) {
      activeFloor = 0;
      return;
    }
    activeFloor = Math.max(0, Math.min(index, floors.length - 1));
    if (officeApi && viewMode === "office") officeApi.focusFloor(activeFloor, instant);
  }

  function startOffice() {
    if (!officeApi || viewMode !== "office") return;
    var stage = document.getElementById("hq-stage");
    if (!stage) return;
    try {
      if (!officeApi.isMounted()) {
        officeApi.mount(stage, { reducedMotion: prefersReducedMotion() });
      }
      officeApi.setTheme(themeMode);
      officeApi.setLive(liveOn);
      officeApi.setReducedMotion(prefersReducedMotion());
      officeApi.update(state, core.buildFloors(state));
      officeApi.focusFloor(activeFloor, true);
      officeApi.resize();
      if (!officeIntroduced) {
        officeIntroduced = true;
        var names = core.collectNames(state);
        for (var i = 0; i < names.length; i++) {
          var st = state.statuses[names[i]];
          if (!st) continue;
          if (st.status === "idle" || st.status === "done") continue;
          officeApi.speak(names[i], core.speechFor(st.status, st.step));
        }
      }
    } catch (err) {
      setView("cards");
    }
  }

  function setView(next) {
    var wanted = next === "office" ? "office" : "cards";
    if (wanted === "office" && !hasWebGL()) wanted = "cards";
    if (wanted === "office" && !officeApi) {
      officeWanted = true;
      wanted = "cards";
    } else {
      officeWanted = wanted === "office";
    }
    viewMode = wanted;
    applyBodyMode();
    var chrome = document.getElementById("hq-chrome");
    var layout = document.querySelector("#app .layout");
    var topbar = document.querySelector("#app .topbar");
    var banner = document.getElementById("check-banner");
    if (chrome) chrome.hidden = viewMode !== "office";
    if (layout) layout.hidden = viewMode === "office";
    if (topbar) topbar.hidden = viewMode === "office";
    if (banner && viewMode === "office") banner.hidden = true;
    syncViewButtons();
    if (viewMode === "office") startOffice();
  }

  function setTheme(next) {
    themeMode = next === "night" ? "night" : "day";
    applyBodyMode();
    if (officeApi) officeApi.setTheme(themeMode);
    syncViewButtons();
  }

  function setLive(next) {
    liveOn = !!next;
    if (officeApi) officeApi.setLive(liveOn);
    syncViewButtons();
  }

  function syncViewButtons() {
    var officeBtn = document.getElementById("view-office-btn");
    var cardsBtn = document.getElementById("view-cards-btn");
    var officeBtn2 = document.getElementById("hq-view-office");
    var cardsBtn2 = document.getElementById("hq-view-cards");
    function mark(btn, on) {
      if (!btn) return;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    mark(officeBtn, viewMode === "office");
    mark(cardsBtn, viewMode === "cards");
    mark(officeBtn2, viewMode === "office");
    mark(cardsBtn2, viewMode === "cards");
    var dayBtn = document.getElementById("hq-day");
    var nightBtn = document.getElementById("hq-night");
    var liveBtn = document.getElementById("hq-live");
    mark(dayBtn, themeMode === "day");
    mark(nightBtn, themeMode === "night");
    if (liveBtn) {
      liveBtn.classList.toggle("is-active", liveOn);
      liveBtn.setAttribute("aria-pressed", liveOn ? "true" : "false");
    }
    if (officeBtn && !hasWebGL()) officeBtn.disabled = true;
    if (officeBtn2 && !hasWebGL()) officeBtn2.disabled = true;
  }

  function attachOffice(api) {
    officeApi = api;
    if (officeWanted || viewMode === "office") setView("office");
    else if (!viewReady) setView(defaultView());
    render();
  }

  function setConnection(next) {
    connection = next;
    var text = "offline";
    if (next === "connecting") text = "connecting";
    else if (next === "live") text = "live";
    else if (next === "reconnecting") text = "reconnecting";
    else if (next === "polling") text = "polling";
    else if (next === "error") text = "error";
    var ids = [
      ["conn-led", "conn-label"],
      ["hq-conn-led", "hq-conn-label"]
    ];
    for (var i = 0; i < ids.length; i++) {
      var led = document.getElementById(ids[i][0]);
      var label = document.getElementById(ids[i][1]);
      if (led) led.className = "led led-" + next;
      if (label) label.textContent = text;
    }
  }

  function renderGate(reason) {
    var gate = document.getElementById("gate");
    var app = document.getElementById("app");
    if (!gate || !app) return;
    app.hidden = true;
    gate.hidden = false;
    gate.replaceChildren();
    var card = el("section", "gate-card");
    var skyline = el("div", "gate-skyline");
    skyline.appendChild(el("span", "tower t1"));
    skyline.appendChild(el("span", "tower t2"));
    skyline.appendChild(el("span", "tower t3"));
    card.appendChild(skyline);
    card.appendChild(el("p", "eyebrow", "Private HQ board"));
    card.appendChild(el("h1", "gate-title", "Add your topic after # in the URL"));
    var help = el("p", "gate-copy");
    help.appendChild(
      document.createTextNode(
        "Open this page as your GitHub Pages URL, then put the ntfy topic in the fragment. The topic stays in the browser and is only sent to ntfy.sh."
      )
    );
    card.appendChild(help);
    var sample = el("p", "gate-sample");
    sample.appendChild(el("code", "", "https://piyapong-kit.github.io/grok-bot-hq-dashboard/#your-topic"));
    card.appendChild(sample);
    if (reason === "invalid") {
      card.appendChild(el("p", "gate-note", "That fragment does not look like a valid topic. Check the characters and try again."));
    }
    gate.appendChild(card);
  }

  function btn(id, className, text) {
    var node = el("button", className, text);
    node.id = id;
    node.type = "button";
    return node;
  }

  function ensureOfficeChrome(app) {
    if (document.getElementById("hq-chrome")) return;
    var chrome = el("div", "hq-chrome");
    chrome.id = "hq-chrome";
    chrome.hidden = true;

    var stage = el("div", "hq-stage");
    stage.id = "hq-stage";
    var bubbles = el("div", "hq-bubbles");
    bubbles.id = "hq-bubbles";
    stage.appendChild(bubbles);
    chrome.appendChild(stage);

    var top = el("div", "hq-top");
    var brand = el("div", "glass hq-brand");
    brand.appendChild(el("strong", "hq-title", "Bot HQ"));
    var liveBtn = btn("hq-live", "hq-toggle is-active", "Live");
    var dayBtn = btn("hq-day", "hq-toggle is-active", "Day");
    var nightBtn = btn("hq-night", "hq-toggle", "Night");
    brand.appendChild(liveBtn);
    brand.appendChild(dayBtn);
    brand.appendChild(nightBtn);
    top.appendChild(brand);

    var counts = el("div", "glass hq-counts");
    counts.id = "hq-counts";
    top.appendChild(counts);

    var tools = el("div", "glass hq-tools");
    var viewOffice = btn("hq-view-office", "view-btn", "3D");
    var viewCards = btn("hq-view-cards", "view-btn", "2D");
    tools.appendChild(viewOffice);
    tools.appendChild(viewCards);
    var conn = el("div", "conn");
    var led = el("span", "led led-idle");
    led.id = "hq-conn-led";
    var label = el("span", "conn-label", "idle");
    label.id = "hq-conn-label";
    conn.appendChild(led);
    conn.appendChild(label);
    tools.appendChild(conn);
    top.appendChild(tools);
    chrome.appendChild(top);

    var panels = el("div", "hq-panels");
    panels.id = "hq-panels";

    var left = el("div", "hq-left");
    var floors = el("section", "glass hq-panel");
    floors.appendChild(el("h2", "", "Floors"));
    var floorBox = el("div", "hq-floor-list");
    floorBox.id = "hq-floor-list";
    floors.appendChild(floorBox);
    left.appendChild(floors);

    var waiting = el("section", "glass hq-panel");
    waiting.appendChild(el("h2", "", "Waiting on me"));
    var waitBox = el("div", "");
    waitBox.id = "hq-waiting";
    waiting.appendChild(waitBox);
    left.appendChild(waiting);

    var activity = el("section", "glass hq-panel");
    activity.appendChild(el("h2", "", "Activity"));
    var actBox = el("div", "hq-activity");
    actBox.id = "hq-activity";
    activity.appendChild(actBox);
    left.appendChild(activity);
    panels.appendChild(left);

    var right = el("aside", "glass hq-right hq-panel");
    right.id = "hq-floor-bots";
    panels.appendChild(right);

    var usage = el("aside", "glass hq-usage hq-panel");
    usage.id = "hq-usage";
    panels.appendChild(usage);
    chrome.appendChild(panels);

    var drawerBtn = btn("hq-drawer-btn", "glass hq-drawer-btn", "Panels");
    chrome.appendChild(drawerBtn);
    app.appendChild(chrome);

    liveBtn.addEventListener("click", function () {
      setLive(!liveOn);
    });
    dayBtn.addEventListener("click", function () {
      setTheme("day");
    });
    nightBtn.addEventListener("click", function () {
      setTheme("night");
    });
    viewOffice.addEventListener("click", function () {
      setView("office");
      render();
    });
    viewCards.addEventListener("click", function () {
      setView("cards");
      render();
    });
    drawerBtn.addEventListener("click", function () {
      drawerOpen = !drawerOpen;
      var box = document.getElementById("hq-panels");
      if (box) box.classList.toggle("is-open", drawerOpen);
      drawerBtn.classList.toggle("is-active", drawerOpen);
      applyBodyMode();
    });
  }

  function ensureAppShell() {
    var app = document.getElementById("app");
    if (!app) return null;
    if (app.dataset.ready === "1") return app;
    app.replaceChildren();

    var header = el("header", "topbar");
    var brand = el("div", "brand");
    brand.appendChild(el("p", "eyebrow", "Grok Bot HQ"));
    brand.appendChild(el("h1", "title", "Live office"));
    header.appendChild(brand);

    var counts = el("div", "counts");
    counts.id = "counts";
    header.appendChild(counts);

    var usage = el("div", "usage");
    usage.id = "usage";
    header.appendChild(usage);

    var meta = el("div", "meta");
    var views = el("div", "view-switch");
    var officeBtn = el("button", "view-btn", "3D");
    officeBtn.id = "view-office-btn";
    officeBtn.type = "button";
    var cardsBtn = el("button", "view-btn is-active", "2D");
    cardsBtn.id = "view-cards-btn";
    cardsBtn.type = "button";
    views.appendChild(officeBtn);
    views.appendChild(cardsBtn);
    meta.appendChild(views);
    var conn = el("div", "conn");
    var led = el("span", "led led-idle");
    led.id = "conn-led";
    var label = el("span", "conn-label", "idle");
    label.id = "conn-label";
    conn.appendChild(led);
    conn.appendChild(label);
    var updated = el("div", "updated");
    updated.id = "updated";
    meta.appendChild(conn);
    meta.appendChild(updated);
    header.appendChild(meta);
    app.appendChild(header);
    ensureOfficeChrome(app);
    officeBtn.addEventListener("click", function () {
      setView("office");
      render();
    });
    cardsBtn.addEventListener("click", function () {
      setView("cards");
      render();
    });

    var check = el("section", "check-banner");
    check.id = "check-banner";
    check.hidden = true;
    app.appendChild(check);

    var layout = el("div", "layout");
    var building = el("section", "building");
    var roof = el("div", "roof");
    roof.appendChild(el("div", "sign", "GROK BOT HQ"));
    building.appendChild(roof);
    var floors = el("div", "floors");
    floors.id = "floors";
    building.appendChild(floors);
    building.appendChild(el("div", "ground"));
    layout.appendChild(building);

    var routines = el("aside", "routines");
    routines.id = "routines";
    layout.appendChild(routines);
    app.appendChild(layout);

    app.dataset.ready = "1";
    return app;
  }

  function renderCounts(now) {
    var box = document.getElementById("counts");
    if (!box) return;
    box.replaceChildren();
    var counts = core.countStatuses(state, now);
    var items = [
      ["working", "Working", counts.working],
      ["done", "Done", counts.done],
      ["idle", "Idle", counts.idle],
      ["waiting_user", "Needs me", counts.waiting_user],
      ["error", "Error", counts.error],
      ["no_report", "No report", counts.no_report],
      ["stale", "Stale", counts.stale]
    ];
    for (var i = 0; i < items.length; i++) {
      var chip = el("span", "chip chip-" + items[i][0]);
      chip.appendChild(el("strong", "", String(items[i][2])));
      chip.appendChild(el("span", "", items[i][1]));
      box.appendChild(chip);
    }
  }

  function renderUsage() {
    var box = document.getElementById("usage");
    if (!box) return;
    box.replaceChildren();
    box.appendChild(el("p", "usage-label", "Weekly usage"));
    if (!state.usage) {
      box.appendChild(el("p", "muted", "No usage report yet"));
      return;
    }
    var pct = Math.max(0, Math.min(100, state.usage.total_used_pct));
    var track = el("div", "usage-track");
    var names = Object.keys(state.usage.bots);
    var usedShare = 0;
    var i;
    for (i = 0; i < names.length; i++) {
      var share = Math.max(0, state.usage.bots[names[i]]);
      if (!share) continue;
      var seg = el("span", "usage-seg");
      seg.style.width = share + "%";
      var look = core.lookFor(state, names[i]);
      seg.style.background = look.color;
      seg.title = names[i] + " " + share + "%";
      track.appendChild(seg);
      usedShare += share;
    }
    var remainder = Math.max(0, pct - usedShare);
    if (remainder > 0.2) {
      var extra = el("span", "usage-seg usage-unknown");
      extra.style.width = remainder + "%";
      track.appendChild(extra);
    }
    box.appendChild(track);
    var foot = el("div", "usage-foot");
    foot.appendChild(el("strong", "", Math.round(pct) + "% used"));
    if (state.usage.resets_at) {
      var reset = core.formatBangkok(state.usage.resets_at);
      foot.appendChild(el("span", "muted", reset ? "Resets " + reset : "Resets " + state.usage.resets_at));
    }
    box.appendChild(foot);
    if (names.length) {
      var list = el("div", "usage-bots");
      names.sort(function (a, b) {
        return state.usage.bots[b] - state.usage.bots[a];
      });
      for (i = 0; i < names.length; i++) {
        var item = el("span", "usage-bot");
        var swatch = el("i", "swatch");
        swatch.style.background = core.lookFor(state, names[i]).color;
        item.appendChild(swatch);
        item.appendChild(el("span", "", names[i]));
        item.appendChild(el("em", "", Math.round(state.usage.bots[names[i]]) + "%"));
        list.appendChild(item);
      }
      box.appendChild(list);
    }
  }

  function renderUpdated() {
    var box = document.getElementById("updated");
    if (!box) return;
    box.replaceChildren();
    box.appendChild(el("span", "muted", "Last update"));
    if (!state.lastEventTime) {
      box.appendChild(el("strong", "", "waiting"));
      return;
    }
    box.appendChild(el("strong", "", core.formatBangkok(state.lastEventTime * 1000)));
    box.appendChild(el("span", "muted", "Asia/Bangkok"));
  }

  function renderCheckBanner() {
    var box = document.getElementById("check-banner");
    if (!box) return;
    if (viewMode === "office") {
      box.hidden = true;
      return;
    }
    if (!state.check || !state.check.bots.length) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    box.hidden = false;
    box.replaceChildren();
    var inCount = 0;
    var i;
    for (i = 0; i < state.check.bots.length; i++) {
      var info = core.checkStateFor(state, state.check.bots[i]);
      if (info && info.checkedIn) inCount += 1;
    }
    box.appendChild(
      el(
        "p",
        "check-title",
        "Health check · " +
          inCount +
          "/" +
          state.check.bots.length +
          " checked in · started " +
          (state.check.time ? core.formatBangkok(state.check.time * 1000) : "recently")
      )
    );
    var list = el("div", "check-list");
    for (i = 0; i < state.check.bots.length; i++) {
      var name = state.check.bots[i];
      var checked = core.checkStateFor(state, name);
      var pill = el("span", checked && checked.checkedIn ? "check-pill in" : "check-pill wait");
      pill.appendChild(el("span", "", name));
      pill.appendChild(el("em", "", checked && checked.checkedIn ? "in" : "awaiting"));
      list.appendChild(pill);
    }
    box.appendChild(list);
  }

  function renderCard(name, now) {
    var status = state.statuses[name];
    var stale = core.isStale(status, now);
    var kind = status ? status.status : "no_report";
    var href = core.safeChatHref(state.chat[name]);
    var card = el(href ? "a" : "article", "bot-card status-" + kind + (stale ? " is-stale" : ""));
    if (href) {
      card.setAttribute("href", href);
      card.setAttribute("rel", "noreferrer");
    }
    card.appendChild(createAvatar(core.lookFor(state, name)));
    var body = el("div", "bot-body");
    body.appendChild(el("h3", "bot-name", name));
    var meta = el("div", "bot-meta");
    var badge = el("span", "badge badge-" + kind, stale ? "stale · " + core.statusLabel(kind) : core.statusLabel(kind));
    meta.appendChild(badge);
    if (status && status.step) meta.appendChild(el("span", "step", status.step));
    body.appendChild(meta);
    var time = el("p", "bot-time", status ? core.formatRelative(status.time, now) : "no report");
    body.appendChild(time);
    var check = core.checkStateFor(state, name);
    if (check) {
      body.appendChild(el("p", check.checkedIn ? "bot-check in" : "bot-check wait", check.checkedIn ? "checked in" : "awaiting check"));
    }
    card.appendChild(body);
    return card;
  }

  function renderFloors(now) {
    var box = document.getElementById("floors");
    if (!box) return;
    box.replaceChildren();
    var floors = core.buildFloors(state);
    if (!floors.length) {
      box.appendChild(el("p", "empty-floor", "Waiting for the first roster or status note."));
      return;
    }
    for (var i = 0; i < floors.length; i++) {
      var floor = el("section", "floor" + (floors[i].team === "Ops" ? " floor-ops" : ""));
      var plaque = el("div", "plaque");
      plaque.appendChild(el("span", "floor-index", String(floors.length - i)));
      plaque.appendChild(el("h2", "floor-name", floors[i].team));
      floor.appendChild(plaque);
      var plate = el("div", "floor-plate");
      for (var b = 0; b < floors[i].bots.length; b++) {
        plate.appendChild(renderCard(floors[i].bots[b], now));
      }
      floor.appendChild(plate);
      box.appendChild(floor);
    }
  }

  function renderRoutines() {
    var box = document.getElementById("routines");
    if (!box) return;
    box.replaceChildren();
    box.appendChild(el("h2", "", "Routines"));
    var names = Object.keys(state.routines);
    if (!names.length) {
      box.appendChild(el("p", "muted", "No routines posted yet."));
      return;
    }
    names.sort(function (a, b) {
      return a.localeCompare(b, "th");
    });
    for (var i = 0; i < names.length; i++) {
      var group = el("section", "routine-group");
      var head = el("div", "routine-head");
      head.appendChild(createAvatar(core.lookFor(state, names[i])));
      head.appendChild(el("h3", "", names[i]));
      group.appendChild(head);
      var items = state.routines[names[i]] || [];
      if (!items.length) {
        group.appendChild(el("p", "muted", "No items"));
      }
      for (var j = 0; j < items.length; j++) {
        var row = el("div", "routine-item");
        row.appendChild(el("p", "routine-name", items[j].name));
        if (items[j].schedule) row.appendChild(el("p", "muted", items[j].schedule));
        if (items[j].next_run) {
          var next = core.formatBangkok(items[j].next_run);
          row.appendChild(el("p", "routine-next", next ? "Next " + next : "Next " + items[j].next_run));
        }
        group.appendChild(row);
      }
      box.appendChild(group);
    }
  }

  function countActiveOnFloor(floor, now) {
    var n = 0;
    for (var i = 0; i < floor.bots.length; i++) {
      var status = state.statuses[floor.bots[i]];
      if (status && (status.status === "working" || status.status === "done") && !core.isStale(status, now)) n += 1;
    }
    return n;
  }

  function renderHqCounts(now) {
    var box = document.getElementById("hq-counts");
    if (!box) return;
    box.replaceChildren();
    var counts = core.countStatuses(state, now);
    var items = [
      ["working", "working", counts.working],
      ["waiting_user", "waiting", counts.waiting_user],
      ["error", "errors", counts.error],
      ["idle", "idle", counts.idle]
    ];
    for (var i = 0; i < items.length; i++) {
      var chip = el("span", "hq-chip chip-" + items[i][0]);
      chip.appendChild(el("i", "dot"));
      chip.appendChild(el("strong", "", String(items[i][2])));
      chip.appendChild(el("span", "", items[i][1]));
      box.appendChild(chip);
    }
  }

  function renderHqFloors(now) {
    var box = document.getElementById("hq-floor-list");
    if (!box) return;
    box.replaceChildren();
    var floors = core.buildFloors(state);
    if (!floors.length) {
      box.appendChild(el("p", "muted", "No floors yet"));
      return;
    }
    if (activeFloor >= floors.length) activeFloor = 0;
    for (var i = 0; i < floors.length; i++) {
      var item = btn("", "hq-floor" + (i === activeFloor ? " is-active" : ""), "");
      item.removeAttribute("id");
      var index = el("span", "hq-floor-num", String(floors.length - i));
      var body = el("span", "hq-floor-body");
      body.appendChild(el("strong", "", floors[i].team));
      body.appendChild(el("em", "", countActiveOnFloor(floors[i], now) + "/" + floors[i].bots.length));
      item.appendChild(index);
      item.appendChild(body);
      item.addEventListener(
        "click",
        (function (idx) {
          return function () {
            setActiveFloor(idx, false);
            renderHqFloors(Date.now());
            renderHqFloorBots(Date.now());
          };
        })(i)
      );
      box.appendChild(item);
    }
  }

  function renderHqWaiting() {
    var box = document.getElementById("hq-waiting");
    if (!box) return;
    box.replaceChildren();
    var names = core.collectNames(state).filter(function (name) {
      return state.statuses[name] && state.statuses[name].status === "waiting_user";
    });
    if (!names.length) {
      box.appendChild(el("p", "muted", "Nothing needs you"));
      return;
    }
    for (var i = 0; i < names.length; i++) {
      var href = core.safeChatHref(state.chat[names[i]]);
      var row = el(href ? "a" : "div", "hq-wait-row");
      if (href) {
        row.setAttribute("href", href);
        row.setAttribute("rel", "noreferrer");
      }
      row.appendChild(createAvatar(core.lookFor(state, names[i])));
      var copy = el("div", "hq-wait-copy");
      copy.appendChild(el("strong", "", names[i]));
      copy.appendChild(el("span", "", "Needs you"));
      row.appendChild(copy);
      box.appendChild(row);
    }
  }

  function renderHqActivity(now) {
    var box = document.getElementById("hq-activity");
    if (!box) return;
    box.replaceChildren();
    if (!activityLog.length) {
      box.appendChild(el("p", "muted", "No status changes yet"));
      return;
    }
    var limit = Math.min(activityLog.length, 12);
    for (var i = 0; i < limit; i++) {
      var item = activityLog[i];
      var row = el("div", "hq-act-row");
      row.appendChild(el("span", "hq-act-time", item.time ? core.formatBangkokClock(item.time * 1000) : ""));
      var line = el("span", "hq-act-copy");
      line.appendChild(el("strong", "", item.name));
      line.appendChild(document.createTextNode(" · " + core.speechFor(item.status, item.step)));
      row.appendChild(line);
      box.appendChild(row);
    }
    void now;
  }

  function renderHqFloorBots(now) {
    var box = document.getElementById("hq-floor-bots");
    if (!box) return;
    box.replaceChildren();
    var floors = core.buildFloors(state);
    var floor = floors[activeFloor];
    if (!floor) {
      box.appendChild(el("h2", "", "Floor"));
      box.appendChild(el("p", "muted", "No bots on this floor"));
      return;
    }
    var head = el("div", "hq-right-head");
    head.appendChild(el("h2", "", floor.team));
    var working = countActiveOnFloor(floor, now);
    var pill = el("span", "hq-working-pill", working + " working");
    head.appendChild(el("span", "muted", "Floor " + (floors.length - activeFloor) + " · " + floor.bots.length + " bots"));
    box.appendChild(head);
    box.appendChild(pill);
    for (var i = 0; i < floor.bots.length; i++) {
      var name = floor.bots[i];
      var status = state.statuses[name];
      var kind = status ? status.status : "no_report";
      var href = core.safeChatHref(state.chat[name]);
      var row = el(href ? "a" : "div", "hq-bot-row");
      if (href) {
        row.setAttribute("href", href);
        row.setAttribute("rel", "noreferrer");
      }
      row.appendChild(createAvatar(core.lookFor(state, name)));
      var copy = el("div", "hq-bot-copy");
      copy.appendChild(el("strong", "", name));
      var speech = status ? core.speechFor(kind, status.step) : "No report";
      copy.appendChild(el("span", "badge badge-" + kind, speech || core.statusLabel(kind)));
      row.appendChild(copy);
      box.appendChild(row);
    }
  }

  function renderHqUsage() {
    var box = document.getElementById("hq-usage");
    if (!box) return;
    box.replaceChildren();
    var head = el("div", "hq-usage-head");
    head.appendChild(el("h2", "", "Usage"));
    box.appendChild(head);
    if (!state.usage) {
      box.appendChild(el("p", "muted", "No usage report yet"));
      return;
    }
    var pct = Math.max(0, Math.min(100, state.usage.total_used_pct));
    var track = el("div", "usage-track");
    var names = Object.keys(state.usage.bots);
    var usedShare = 0;
    var i;
    for (i = 0; i < names.length; i++) {
      var share = Math.max(0, state.usage.bots[names[i]]);
      if (!share) continue;
      var seg = el("span", "usage-seg");
      seg.style.width = share + "%";
      seg.style.background = core.lookFor(state, names[i]).color;
      seg.title = names[i] + " " + share + "%";
      track.appendChild(seg);
      usedShare += share;
    }
    var remainder = Math.max(0, pct - usedShare);
    if (remainder > 0.2) {
      var extra = el("span", "usage-seg usage-unknown");
      extra.style.width = remainder + "%";
      track.appendChild(extra);
    }
    box.appendChild(track);
    var foot = el("div", "usage-foot");
    foot.appendChild(el("strong", "", Math.round(pct) + "% used"));
    if (state.usage.resets_at) {
      var reset = core.formatBangkok(state.usage.resets_at);
      foot.appendChild(el("span", "muted", reset ? "Resets " + reset : "Resets " + state.usage.resets_at));
    }
    box.appendChild(foot);
    if (names.length) {
      var list = el("div", "usage-bots");
      names.sort(function (a, b) {
        return state.usage.bots[b] - state.usage.bots[a];
      });
      for (i = 0; i < names.length; i++) {
        var item = el("span", "usage-bot");
        var swatch = el("i", "swatch");
        swatch.style.background = core.lookFor(state, names[i]).color;
        item.appendChild(swatch);
        item.appendChild(el("span", "", names[i]));
        item.appendChild(el("em", "", Math.round(state.usage.bots[names[i]]) + "%"));
        list.appendChild(item);
      }
      box.appendChild(list);
    }
  }

  function renderOfficeChrome(now) {
    renderHqCounts(now);
    renderHqFloors(now);
    renderHqWaiting();
    renderHqActivity(now);
    renderHqFloorBots(now);
    renderHqUsage();
    var led = document.getElementById("hq-conn-led");
    var label = document.getElementById("hq-conn-label");
    if (led) led.className = "led led-" + connection;
    if (label) {
      var text = "offline";
      if (connection === "connecting") text = "connecting";
      else if (connection === "live") text = "live";
      else if (connection === "reconnecting") text = "reconnecting";
      else if (connection === "polling") text = "polling";
      else if (connection === "error") text = "error";
      label.textContent = text;
    }
    if (officeApi && officeApi.isMounted()) {
      officeApi.update(state, core.buildFloors(state));
    }
    syncViewButtons();
  }

  function render() {
    var gate = document.getElementById("gate");
    var app = ensureAppShell();
    if (!app) return;
    if (gate) gate.hidden = true;
    app.hidden = false;
    if (!viewReady) {
      viewReady = true;
      setView(defaultView());
    }
    noteActivity();
    var now = Date.now();
    renderCounts(now);
    renderUsage();
    renderUpdated();
    renderCheckBanner();
    renderFloors(now);
    renderRoutines();
    renderOfficeChrome(now);
    setConnection(connection);
    applyBodyMode();
  }

  function stopTimers() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function handleLine(line) {
    var before = lastId;
    var trimmed = typeof line === "string" ? line.trim() : "";
    if (!trimmed) return;
    var ev;
    try {
      ev = JSON.parse(trimmed);
    } catch (err) {
      return;
    }
    if (ev && ev.id) lastId = ev.id;
    if (core.ingestNtfyLine(state, seen, trimmed) || ev.id !== before) {
      render();
    }
  }

  function pollOnce(topic) {
    var url = lastId ? core.ntfyPollSinceUrl(topic, lastId) : core.ntfyPollUrl(topic);
    return fetch(url, { cache: "no-store", referrerPolicy: "no-referrer" })
      .then(function (res) {
        if (!res.ok) throw new Error("poll-failed");
        return res.text();
      })
      .then(function (text) {
        core.ingestNdjson(state, seen, text);
        var lines = text.split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line) continue;
          try {
            var ev = JSON.parse(line);
            if (ev && ev.id) lastId = ev.id;
          } catch (err) {}
        }
        render();
      });
  }

  function startPolling(topic) {
    if (pollTimer) return;
    setConnection("polling");
    pollTimer = setInterval(function () {
      if (activeTopic !== topic) return;
      pollOnce(topic).catch(function () {
        setConnection("error");
      });
    }, core.POLL_MS);
  }

  function connectSse(topic) {
    if (activeTopic !== topic) return;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    setConnection(connection === "polling" ? "reconnecting" : "connecting");
    var source;
    try {
      source = new EventSource(core.ntfySseUrl(topic));
    } catch (err) {
      sseFailCount += 1;
      fallbackOrRetry(topic);
      return;
    }
    eventSource = source;
    source.onopen = function () {
      if (activeTopic !== topic) return;
      backoffMs = 1000;
      sseFailCount = 0;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      setConnection("live");
    };
    source.onmessage = function (event) {
      if (activeTopic !== topic) return;
      handleLine(event.data);
    };
    source.onerror = function () {
      if (activeTopic !== topic) return;
      source.close();
      if (eventSource === source) eventSource = null;
      sseFailCount += 1;
      fallbackOrRetry(topic);
    };
  }

  function fallbackOrRetry(topic) {
    if (sseFailCount >= 3) {
      startPolling(topic);
      reconnectTimer = setTimeout(function () {
        if (activeTopic !== topic) return;
        connectSse(topic);
      }, 60000);
      return;
    }
    setConnection("reconnecting");
    reconnectTimer = setTimeout(function () {
      if (activeTopic !== topic) return;
      connectSse(topic);
    }, backoffMs);
    backoffMs = Math.min(backoffMs * 2, 30000);
  }

  function startStream(topic) {
    stopTimers();
    activeTopic = topic;
    setConnection("connecting");
    pollOnce(topic)
      .catch(function () {
        setConnection("error");
      })
      .then(function () {
        if (activeTopic !== topic) return;
        connectSse(topic);
      });
  }

  function resetBoard() {
    stopTimers();
    state = core.createState();
    seen = core.createSeen();
    lastId = "";
    activeTopic = "";
    connection = "idle";
    backoffMs = 1000;
    sseFailCount = 0;
    activityLog = [];
    lastStatusKey = {};
    activeFloor = 0;
  }

  function boot() {
    var parsed = core.parseTopicFromHash(window.location.hash);
    if (!parsed.topic) {
      resetBoard();
      renderGate(parsed.reason);
      return;
    }
    if (parsed.topic !== activeTopic) {
      resetBoard();
      startStream(parsed.topic);
    }
    render();
  }

  function startTicks() {
    if (tickTimer) return;
    tickTimer = setInterval(function () {
      if (!activeTopic) return;
      var app = document.getElementById("app");
      if (app && !app.hidden) render();
    }, 15000);
  }

  window.HQ = {
    render: render,
    boot: boot,
    startStream: startStream,
    resetBoard: resetBoard,
    attachOffice: attachOffice,
    setView: setView,
    setTheme: setTheme,
    applyPayload: function (payload, time) {
      core.applyPayload(state, payload, time);
      if (time && time > state.lastEventTime) state.lastEventTime = time;
    },
    ingestNdjson: function (text) {
      core.ingestNdjson(state, seen, text);
    },
    getState: function () {
      return state;
    },
    setState: function (next) {
      state = next;
    }
  };

  if (!window.HQ_MANUAL_START) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        boot();
        startTicks();
      });
    } else {
      boot();
      startTicks();
    }
    window.addEventListener("hashchange", function () {
      boot();
    });
  }

  root = document.documentElement;
  void root;
})();
