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
assert.strictEqual(state.groups["น้องบอท"], "Game");
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
assert.ok(names.indexOf("Who paid?") !== -1);
assert.ok(names.indexOf("Game") !== -1);
assert.ok(names.indexOf("Homerun") !== -1);
assert.ok(names.indexOf("Research") !== -1);
assert.ok(names.indexOf("Lobby") === -1);
assert.ok(names.indexOf("Other") === -1);
assert.strictEqual(floors.length, 5);
var botTotal = floors.reduce(function (sum, floor) { return sum + floor.bots.length; }, 0);
assert.ok(botTotal >= 14);
pass("five product floors, Ops at the bottom, about 14 bots");

var extra = core.createState();
core.applyPayload(extra, { roster: ["Ada", "Rex", "Zoe"] });
core.applyPayload(extra, { groups: { Ada: "Who paid?", Rex: "Studio" } });
var extraNames = core.buildFloors(extra).map(function (floor) { return floor.team; });
assert.ok(extraNames.indexOf("Studio") !== -1);
assert.ok(extraNames.indexOf("Other") !== -1);
assert.ok(extra.groups.Zoe === undefined);
pass("extra teams appear and ungrouped bots go to Other");

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

assert.strictEqual(core.speechFor("working", "coding"), "Working: coding");
assert.strictEqual(core.speechFor("waiting_user", "review"), "Needs you");
assert.strictEqual(core.speechFor("done", "ship"), "Done");
assert.strictEqual(core.speechFor("idle", "<script>alert(1)</script>"), "Idle");
assert.strictEqual(core.speechFor("error", "retry"), "Error");
assert.strictEqual(core.genericStep("<img src=x>"), "");
assert.strictEqual(core.genericStep("play-test_1"), "play-test_1");
assert.strictEqual(core.badgeTone("working"), "ok");
assert.strictEqual(core.badgeTone("done"), "ok");
assert.strictEqual(core.badgeTone("waiting_user"), "wait");
pass("speech text is only status plus a generic step word");

console.log("\nAll parse checks passed.");
