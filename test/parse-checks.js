"use strict";

var assert = require("assert");
var core = require("../core.js");
var samples = require("./sample-messages.js");

function pass(name) {
  console.log("ok  " + name);
}

var state = core.createState();
var seen = core.createSeen();
assert.strictEqual(Object.prototype.hasOwnProperty.call(state, "topic"), false);
core.ingestNdjson(state, seen, samples.ndjson());
assert.strictEqual(Object.prototype.hasOwnProperty.call(state, "topic"), false);
pass("state never stores a topic");

assert.ok(state.roster.indexOf("สมชาย") !== -1);
assert.ok(state.roster.indexOf('Bo"ss') !== -1);
assert.strictEqual(state.groups["น้องบอท"], "Engineering");
pass("Thai names and quoted names survive");

assert.strictEqual(state.looks.Ada.shape, "flower");
assert.strictEqual(state.looks.Ada.color, "#E8A0BF");
assert.strictEqual(state.looks.Ada.accessory, "bow");
pass("looks merge across split lines");

assert.strictEqual(state.statuses.Ada.status, "working");
assert.strictEqual(state.statuses.Nok.status, "error");
assert.ok(core.isStale(state.statuses.Oldie, Date.now()));
assert.ok(!state.statuses.Quiet);
pass("status, stale, and no-report");

var later = core.createState();
core.applyPayload(later, { roster: ["Ada"] }, 1);
core.applyPayload(later, { roster: ["Rex", "Mia"] }, 2);
assert.deepStrictEqual(later.roster, ["Rex", "Mia"]);
pass("later roster replaces earlier");

var floors = core.buildFloors(state);
var names = floors.map(function (floor) { return floor.team; });
assert.strictEqual(names[names.length - 1], "Ops");
assert.ok(names.indexOf("Studio") !== -1);
assert.ok(names.indexOf("Lobby") === -1);
pass("Ops is the bottom floor and extra teams appear");

assert.strictEqual(core.safeChatHref("grokbot://app/v1/agent?id=ada-demo"), "grokbot://app/v1/agent?id=ada-demo");
assert.strictEqual(core.safeChatHref("javascript:alert(1)"), "");
assert.strictEqual(core.safeChatHref("https://example.com"), "");
pass("only grokbot chat links are kept");

assert.strictEqual(core.ingestNtfyLine(state, seen, "{not json"), false);
assert.strictEqual(core.ingestNtfyLine(state, seen, JSON.stringify({ event: "keepalive", message: "{}" })), false);
assert.strictEqual(core.ingestNtfyLine(state, seen, JSON.stringify({ event: "message", message: "hello" })), false);
assert.strictEqual(core.ingestNtfyLine(state, seen, JSON.stringify({ event: "message", message: "{\"not\":\"known\"}" })), false);
pass("unknown and non-JSON messages are ignored");

var parsed = core.parseTopicFromHash("#demo-hq-preview-not-a-real-topic");
assert.strictEqual(parsed.topic, "demo-hq-preview-not-a-real-topic");
assert.strictEqual(core.parseTopicFromHash("").reason, "missing");
assert.strictEqual(core.parseTopicFromHash("#has space").reason, "invalid");
pass("topic is read only from the hash");

var poll = core.ntfyPollUrl("demo-hq-preview-not-a-real-topic");
var sse = core.ntfySseUrl("demo-hq-preview-not-a-real-topic");
assert.ok(poll.indexOf("https://ntfy.sh/") === 0);
assert.ok(sse.indexOf("https://ntfy.sh/") === 0);
assert.ok(poll.indexOf("demo-hq-preview-not-a-real-topic") !== -1);
pass("outgoing URLs stay on ntfy.sh");

var check = core.checkStateFor(state, "Ada");
assert.ok(check && check.checkedIn);
assert.ok(core.checkStateFor(state, "Quiet") && !core.checkStateFor(state, "Quiet").checkedIn);
pass("health check marks later status posts");

var counts = core.countStatuses(state, Date.now());
assert.ok(counts.working >= 1);
assert.ok(counts.waiting_user >= 1);
assert.ok(counts.error >= 1);
assert.ok(counts.stale >= 1);
assert.ok(counts.no_report >= 1);
pass("status counts include every badge");

console.log("\nAll parse checks passed.");
