(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.HQCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TZ = "Asia/Bangkok";
  var STALE_MS = 12 * 60 * 60 * 1000;
  var POLL_MS = 30000;
  var MAX_NAME = 80;
  var MAX_STEP = 80;
  var MAX_TEAM = 48;
  var MAX_SEEN = 2500;
  var VALID_STATUSES = {
    working: true,
    done: true,
    idle: true,
    waiting_user: true,
    error: true
  };
  var VALID_SHAPES = {
    sphere: true,
    cloud: true,
    rounded_square: true,
    star4: true,
    star6: true,
    clover: true,
    bubble: true,
    flower: true,
    drop: true,
    pill: true,
    triangle: true,
    pentagon: true,
    hexagon: true,
    cone: true,
    trio: true
  };
  var VALID_ACCESSORIES = {
    none: true,
    glasses: true,
    antenna: true,
    stem: true,
    bow: true
  };
  var UNGROUPED_FLOOR = "Other";
  var KNOWN_FLOORS = ["Who paid?", "Game", "Homerun", "Research", "Product", "Engineering"];
  var GENERIC_STEP = /^[a-z][a-z0-9_-]{0,23}$/;
  var SPEECH_STATUS = {
    working: "Working",
    done: "Done",
    idle: "Idle",
    waiting_user: "Needs you",
    error: "Error"
  };
  var FALLBACK_COLORS = [
    "#7C9CFF",
    "#E8A0BF",
    "#7DCEA0",
    "#F5C16C",
    "#A78BFA",
    "#67E8F9",
    "#FCA5A5",
    "#FDE68A"
  ];

  function createState() {
    return {
      roster: [],
      groups: {},
      chat: {},
      looks: {},
      statuses: {},
      routines: {},
      usage: null,
      check: null,
      lastEventTime: 0
    };
  }

  function createSeen() {
    return new Set();
  }

  function clipText(value, max) {
    if (typeof value !== "string") return "";
    var trimmed = value.trim();
    if (!trimmed) return "";
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function validColor(value) {
    return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
  }

  function nameHash(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function fallbackColor(name) {
    return FALLBACK_COLORS[nameHash(name) % FALLBACK_COLORS.length];
  }

  function lookFor(state, name) {
    var look = state.looks[name] || {};
    return {
      shape: VALID_SHAPES[look.shape] ? look.shape : "sphere",
      color: validColor(look.color) ? look.color : fallbackColor(name),
      accessory: VALID_ACCESSORIES[look.accessory] ? look.accessory : "none"
    };
  }

  function applyRoster(state, roster) {
    if (!Array.isArray(roster)) return false;
    var next = [];
    var seen = {};
    for (var i = 0; i < roster.length; i++) {
      var name = clipText(roster[i], MAX_NAME);
      if (!name || seen[name]) continue;
      seen[name] = true;
      next.push(name);
    }
    state.roster = next;
    return true;
  }

  function applyGroups(state, groups) {
    if (!isPlainObject(groups)) return false;
    var changed = false;
    var keys = Object.keys(groups);
    for (var i = 0; i < keys.length; i++) {
      var name = clipText(keys[i], MAX_NAME);
      var team = clipText(groups[keys[i]], MAX_TEAM);
      if (!name || !team) continue;
      state.groups[name] = team;
      changed = true;
    }
    return changed;
  }

  function applyChat(state, chat) {
    if (!isPlainObject(chat)) return false;
    var changed = false;
    var keys = Object.keys(chat);
    for (var i = 0; i < keys.length; i++) {
      var name = clipText(keys[i], MAX_NAME);
      var href = chat[keys[i]];
      if (!name || typeof href !== "string") continue;
      state.chat[name] = href.trim();
      changed = true;
    }
    return changed;
  }

  function applyLooks(state, looks) {
    if (!isPlainObject(looks)) return false;
    var changed = false;
    var keys = Object.keys(looks);
    for (var i = 0; i < keys.length; i++) {
      var name = clipText(keys[i], MAX_NAME);
      var piece = looks[keys[i]];
      if (!name || !isPlainObject(piece)) continue;
      var prev = state.looks[name] || {};
      var next = {
        shape: prev.shape,
        color: prev.color,
        accessory: prev.accessory
      };
      if (VALID_SHAPES[piece.shape]) next.shape = piece.shape;
      if (validColor(piece.color)) next.color = piece.color;
      if (VALID_ACCESSORIES[piece.accessory]) next.accessory = piece.accessory;
      state.looks[name] = next;
      changed = true;
    }
    return changed;
  }

  function applyRoutines(state, routines) {
    if (!isPlainObject(routines)) return false;
    var bot = clipText(routines.bot, MAX_NAME);
    if (!bot || !Array.isArray(routines.items)) return false;
    var items = [];
    for (var i = 0; i < routines.items.length; i++) {
      var item = routines.items[i];
      if (!isPlainObject(item)) continue;
      var name = clipText(item.name, MAX_NAME);
      if (!name) continue;
      items.push({
        name: name,
        schedule: clipText(item.schedule, 80),
        next_run: clipText(item.next_run, 80)
      });
    }
    state.routines[bot] = items;
    return true;
  }

  function applyUsage(state, payload) {
    if (!isPlainObject(payload) || payload.type !== "usage") return false;
    if (typeof payload.total_used_pct !== "number" || !isFinite(payload.total_used_pct)) {
      return false;
    }
    var bots = {};
    if (isPlainObject(payload.bots)) {
      var keys = Object.keys(payload.bots);
      for (var i = 0; i < keys.length; i++) {
        var name = clipText(keys[i], MAX_NAME);
        var pct = payload.bots[keys[i]];
        if (!name || typeof pct !== "number" || !isFinite(pct)) continue;
        bots[name] = pct;
      }
    }
    state.usage = {
      total_used_pct: payload.total_used_pct,
      resets_at: clipText(payload.resets_at, 80),
      bots: bots
    };
    return true;
  }

  function applyCheck(state, check, time) {
    if (!isPlainObject(check) || !Array.isArray(check.bots)) return false;
    var bots = [];
    var seen = {};
    for (var i = 0; i < check.bots.length; i++) {
      var name = clipText(check.bots[i], MAX_NAME);
      if (!name || seen[name]) continue;
      seen[name] = true;
      bots.push(name);
    }
    state.check = { time: typeof time === "number" ? time : 0, bots: bots };
    return true;
  }

  function applyStatus(state, payload, time) {
    if (!isPlainObject(payload)) return false;
    var bot = clipText(payload.bot, MAX_NAME);
    var status = typeof payload.status === "string" ? payload.status : "";
    if (!bot || !VALID_STATUSES[status]) return false;
    state.statuses[bot] = {
      status: status,
      step: clipText(payload.step, MAX_STEP),
      time: typeof time === "number" ? time : 0
    };
    return true;
  }

  function applyPayload(state, payload, time) {
    if (!isPlainObject(payload)) return false;
    var changed = false;
    if (Object.prototype.hasOwnProperty.call(payload, "roster")) {
      changed = applyRoster(state, payload.roster) || changed;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "groups")) {
      changed = applyGroups(state, payload.groups) || changed;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "chat")) {
      changed = applyChat(state, payload.chat) || changed;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "looks")) {
      changed = applyLooks(state, payload.looks) || changed;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "routines")) {
      changed = applyRoutines(state, payload.routines) || changed;
    }
    if (payload.type === "usage") {
      changed = applyUsage(state, payload) || changed;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "check")) {
      changed = applyCheck(state, payload.check, time) || changed;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "bot") && Object.prototype.hasOwnProperty.call(payload, "status")) {
      changed = applyStatus(state, payload, time) || changed;
    }
    return changed;
  }

  function rememberId(seen, id) {
    if (!id) return;
    seen.add(id);
    if (seen.size > MAX_SEEN) {
      var first = seen.values().next().value;
      seen.delete(first);
    }
  }

  function ingestNtfyLine(state, seen, line) {
    if (typeof line !== "string") return false;
    var trimmed = line.trim();
    if (!trimmed) return false;
    var ev;
    try {
      ev = JSON.parse(trimmed);
    } catch (err) {
      return false;
    }
    if (!isPlainObject(ev)) return false;
    if (ev.event && ev.event !== "message") return false;
    if (ev.id && seen.has(ev.id)) return false;
    if (typeof ev.message !== "string") return false;
    var payload;
    try {
      payload = JSON.parse(ev.message);
    } catch (err) {
      return false;
    }
    if (!isPlainObject(payload)) return false;
    rememberId(seen, ev.id);
    var time = typeof ev.time === "number" && isFinite(ev.time) ? ev.time : 0;
    var changed = applyPayload(state, payload, time);
    if (time > state.lastEventTime) state.lastEventTime = time;
    return changed;
  }

  function ingestNdjson(state, seen, text) {
    if (typeof text !== "string" || !text) return false;
    var changed = false;
    var lines = text.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      if (ingestNtfyLine(state, seen, lines[i])) changed = true;
    }
    return changed;
  }

  function collectNames(state) {
    var names = [];
    var seen = {};
    function add(name) {
      var clean = clipText(name, MAX_NAME);
      if (!clean || seen[clean]) return;
      seen[clean] = true;
      names.push(clean);
    }
    var i;
    for (i = 0; i < state.roster.length; i++) add(state.roster[i]);
    var maps = [state.groups, state.chat, state.looks, state.statuses, state.routines];
    for (i = 0; i < maps.length; i++) {
      var keys = Object.keys(maps[i]);
      for (var k = 0; k < keys.length; k++) add(keys[k]);
    }
    if (state.usage && state.usage.bots) {
      var usageKeys = Object.keys(state.usage.bots);
      for (i = 0; i < usageKeys.length; i++) add(usageKeys[i]);
    }
    if (state.check && state.check.bots) {
      for (i = 0; i < state.check.bots.length; i++) add(state.check.bots[i]);
    }
    return names;
  }

  function nameSorter(state) {
    var index = {};
    for (var i = 0; i < state.roster.length; i++) index[state.roster[i]] = i;
    return function (a, b) {
      var ia = Object.prototype.hasOwnProperty.call(index, a) ? index[a] : 10000;
      var ib = Object.prototype.hasOwnProperty.call(index, b) ? index[b] : 10000;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, "th");
    };
  }

  function floorRank(team) {
    if (team === "Lobby") return 0;
    var known = KNOWN_FLOORS.indexOf(team);
    if (known >= 0) return known + 1;
    if (team === UNGROUPED_FLOOR) return 800;
    if (team === "Ops") return 1000;
    return 100;
  }

  function buildFloors(state) {
    var names = collectNames(state);
    var buckets = {};
    var i;
    for (i = 0; i < names.length; i++) {
      var name = names[i];
      var team = state.groups[name] || UNGROUPED_FLOOR;
      if (!buckets[team]) buckets[team] = [];
      buckets[team].push(name);
    }
    var teams = Object.keys(buckets);
    var sortNames = nameSorter(state);
    teams.sort(function (a, b) {
      var ra = floorRank(a);
      var rb = floorRank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b, "th");
    });
    var floors = [];
    for (i = 0; i < teams.length; i++) {
      var bots = buckets[teams[i]].slice().sort(sortNames);
      floors.push({ team: teams[i], bots: bots });
    }
    return floors;
  }

  function isStale(status, now) {
    if (!status || !status.time) return false;
    var clock = typeof now === "number" ? now : Date.now();
    return clock - status.time * 1000 > STALE_MS;
  }

  function checkStateFor(state, name) {
    if (!state.check || !state.check.bots || state.check.bots.indexOf(name) === -1) {
      return null;
    }
    var status = state.statuses[name];
    var checkedIn = !!(status && status.time && status.time > state.check.time);
    return { checkedIn: checkedIn, checkTime: state.check.time };
  }

  function countStatuses(state, now) {
    var counts = {
      working: 0,
      done: 0,
      idle: 0,
      waiting_user: 0,
      error: 0,
      no_report: 0,
      stale: 0
    };
    var names = collectNames(state);
    for (var i = 0; i < names.length; i++) {
      var status = state.statuses[names[i]];
      if (!status) {
        counts.no_report += 1;
        continue;
      }
      if (VALID_STATUSES[status.status]) counts[status.status] += 1;
      if (isStale(status, now)) counts.stale += 1;
    }
    return counts;
  }

  function safeChatHref(href) {
    if (typeof href !== "string" || !href) return "";
    try {
      var parsed = new URL(href);
      if (parsed.protocol === "grokbot:") return href;
    } catch (err) {
      return "";
    }
    return "";
  }

  function formatBangkok(date) {
    var when = date instanceof Date ? date : new Date(date);
    if (isNaN(when.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(when);
  }

  function formatBangkokClock(date) {
    var when = date instanceof Date ? date : new Date(date);
    if (isNaN(when.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(when);
  }

  function formatRelative(unixSec, now) {
    if (!unixSec) return "";
    var clock = typeof now === "number" ? now : Date.now();
    var diff = clock - unixSec * 1000;
    if (diff < 0) diff = 0;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins === 1) return "1 min ago";
    if (mins < 60) return mins + " min ago";
    var hours = Math.floor(mins / 60);
    if (hours === 1) return "1h ago";
    if (hours < 48) return hours + "h ago";
    var days = Math.floor(hours / 24);
    return days === 1 ? "1d ago" : days + "d ago";
  }

  function parseTopicFromHash(hash) {
    var raw = typeof hash === "string" ? hash : "";
    if (raw.charAt(0) === "#") raw = raw.slice(1);
    if (!raw) return { topic: "", reason: "missing" };
    try {
      raw = decodeURIComponent(raw);
    } catch (err) {
      return { topic: "", reason: "invalid" };
    }
    raw = raw.trim();
    if (!raw) return { topic: "", reason: "missing" };
    if (raw.length > 128) return { topic: "", reason: "invalid" };
    if (/[\s\u0000-\u001f]/.test(raw)) return { topic: "", reason: "invalid" };
    return { topic: raw, reason: "" };
  }

  function ntfyPollUrl(topic) {
    return "https://ntfy.sh/" + encodeURIComponent(topic) + "/json?poll=1&since=12h";
  }

  function ntfySseUrl(topic) {
    return "https://ntfy.sh/" + encodeURIComponent(topic) + "/sse";
  }

  function ntfyPollSinceUrl(topic, since) {
    return (
      "https://ntfy.sh/" +
      encodeURIComponent(topic) +
      "/json?poll=1&since=" +
      encodeURIComponent(since)
    );
  }

  function statusLabel(status) {
    if (status === "waiting_user") return "needs me";
    if (status === "working") return "working";
    if (status === "done") return "done";
    if (status === "idle") return "idle";
    if (status === "error") return "error";
    return "no report";
  }

  function genericStep(step) {
    if (typeof step !== "string") return "";
    var word = step.trim().toLowerCase();
    return GENERIC_STEP.test(word) ? word : "";
  }

  function speechFor(status, step) {
    var label = SPEECH_STATUS[status];
    if (!label) return "";
    if (status !== "working") return label;
    var word = genericStep(step);
    return word ? "Working: " + word : label;
  }

  function badgeTone(status) {
    if (status === "working" || status === "done") return "ok";
    if (status === "waiting_user") return "wait";
    if (status === "error") return "error";
    return "idle";
  }

  return {
    TZ: TZ,
    STALE_MS: STALE_MS,
    POLL_MS: POLL_MS,
    VALID_STATUSES: VALID_STATUSES,
    VALID_SHAPES: VALID_SHAPES,
    VALID_ACCESSORIES: VALID_ACCESSORIES,
    KNOWN_FLOORS: KNOWN_FLOORS,
    UNGROUPED_FLOOR: UNGROUPED_FLOOR,
    createState: createState,
    createSeen: createSeen,
    applyPayload: applyPayload,
    ingestNtfyLine: ingestNtfyLine,
    ingestNdjson: ingestNdjson,
    collectNames: collectNames,
    buildFloors: buildFloors,
    isStale: isStale,
    checkStateFor: checkStateFor,
    countStatuses: countStatuses,
    safeChatHref: safeChatHref,
    formatBangkok: formatBangkok,
    formatBangkokClock: formatBangkokClock,
    formatRelative: formatRelative,
    parseTopicFromHash: parseTopicFromHash,
    ntfyPollUrl: ntfyPollUrl,
    ntfySseUrl: ntfySseUrl,
    ntfyPollSinceUrl: ntfyPollSinceUrl,
    statusLabel: statusLabel,
    genericStep: genericStep,
    speechFor: speechFor,
    badgeTone: badgeTone,
    lookFor: lookFor,
    validColor: validColor,
    clipText: clipText
  };
});
