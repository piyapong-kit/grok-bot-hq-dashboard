(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.HQSamples = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function hoursAgo(hours) {
    return Math.floor(Date.now() / 1000) - Math.round(hours * 3600);
  }

  function minutesAgo(mins) {
    return Math.floor(Date.now() / 1000) - mins * 60;
  }

  function nextHourIso() {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  function fridayResetIso() {
    return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  }

  function payloads() {
    return [
      {
        roster: [
          "Ada",
          'Bo"ss',
          "สมชาย",
          "น้องบอท",
          "Nok",
          "Rex",
          "Mia",
          "Uno",
          "Pip",
          "Kai",
          "Oldie",
          "Quiet",
          '<img src=x onerror=alert(1)>'
        ]
      },
      {
        groups: {
          Ada: "Product",
          'Bo"ss': "Product",
          สมชาย: "Engineering",
          น้องบอท: "Engineering",
          Nok: "Research",
          Rex: "Game",
          Mia: "Homerun",
          Uno: "Ops",
          Pip: "Ops",
          Kai: "Studio",
          Oldie: "Research",
          Quiet: "Product",
          '<img src=x onerror=alert(1)>': "Ops"
        }
      },
      { looks: { Ada: { shape: "flower" } } },
      { looks: { Ada: { color: "#E8A0BF" } } },
      { looks: { Ada: { accessory: "bow" } } },
      { looks: { 'Bo"ss': { shape: "star4", color: "#7C9CFF", accessory: "glasses" } } },
      { looks: { สมชาย: { shape: "hexagon", color: "#67E8F9", accessory: "antenna" } } },
      { looks: { น้องบอท: { shape: "cloud", color: "#A78BFA", accessory: "stem" } } },
      { looks: { Nok: { shape: "drop", color: "#7DCEA0", accessory: "none" } } },
      { looks: { Rex: { shape: "triangle", color: "#F5C16C", accessory: "antenna" } } },
      { looks: { Mia: { shape: "clover", color: "#FCA5A5", accessory: "bow" } } },
      { looks: { Uno: { shape: "rounded_square", color: "#8B93A7", accessory: "glasses" } } },
      { looks: { Pip: { shape: "pill", color: "#FDE68A", accessory: "none" } } },
      { looks: { Kai: { shape: "star6", color: "#67E8F9", accessory: "stem" } } },
      { looks: { Oldie: { shape: "cone", color: "#C08A5A", accessory: "none" } } },
      { looks: { Quiet: { shape: "bubble", color: "#9CA3AF", accessory: "none" } } },
      { looks: { '<img src=x onerror=alert(1)>': { shape: "trio", color: "#EF6B73", accessory: "none" } } },
      { chat: { Ada: "grokbot://app/v1/agent?id=ada-demo" } },
      { chat: { Rex: "javascript:alert(1)" } },
      { chat: { Mia: "https://example.com" } },
      { bot: 'Bo"ss', status: "done", step: "ship" },
      { bot: "สมชาย", status: "idle", step: "standby" },
      { bot: "Nok", status: "error", step: "retry" },
      { bot: "Mia", status: "done", step: "score" },
      { bot: "Uno", status: "idle", step: "watch" },
      { bot: "Pip", status: "working", step: "cleanup" },
      { bot: "Kai", status: "done", step: "render" },
      { bot: "Oldie", status: "done", step: "archive" },
      { bot: '<img src=x onerror=alert(1)>', status: "idle", step: "<script>alert(1)</script>" },
      { not: "a-real-kind" },
      "plain text",
      { check: { bots: ["Ada", "Rex", "Quiet", "น้องบอท", "Oldie"] } },
      { bot: "Ada", status: "working", step: "planning" },
      { bot: "Rex", status: "working", step: "playtest" },
      { bot: "น้องบอท", status: "waiting_user", step: "review" },
      {
        routines: {
          bot: "Uno",
          items: [
            { name: "Night sweep", schedule: "Every day 02:00", next_run: nextHourIso() },
            { name: "Inbox triage", schedule: "Weekdays 09:00", next_run: nextHourIso() }
          ]
        }
      },
      {
        routines: {
          bot: "น้องบอท",
          items: [{ name: "Daily brief", schedule: "Every morning", next_run: nextHourIso() }]
        }
      },
      {
        type: "usage",
        total_used_pct: 62,
        resets_at: fridayResetIso(),
        bots: { Ada: 18, Rex: 14, สมชาย: 11, Mia: 9, Nok: 6 }
      }
    ];
  }

  function timedEvents() {
    var list = payloads();
    var events = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var payload = list[i];
      var time = minutesAgo(list.length - i);
      if (payload && payload.bot === "Oldie") time = hoursAgo(13);
      if (payload && payload.check) time = minutesAgo(8);
      if (payload && payload.bot === "Ada") time = minutesAgo(2);
      if (payload && payload.bot === "Rex") time = minutesAgo(3);
      if (payload && payload.bot === "น้องบอท") time = minutesAgo(4);
      if (payload && payload.bot && time < minutesAgo(8) && payload.bot !== "Oldie") {
        time = minutesAgo(6);
      }
      events.push({
        id: "demo" + i,
        time: time,
        event: "message",
        topic: "demo-hq-preview-not-a-real-topic",
        message: typeof payload === "string" ? payload : JSON.stringify(payload)
      });
    }
    return events;
  }

  function ndjson() {
    return timedEvents()
      .map(function (ev) {
        return JSON.stringify(ev);
      })
      .join("\n");
  }

  return {
    FAKE_TOPIC: "demo-hq-preview-not-a-real-topic",
    payloads: payloads,
    timedEvents: timedEvents,
    ndjson: ndjson
  };
});
