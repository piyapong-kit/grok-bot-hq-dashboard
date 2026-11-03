(function () {
  "use strict";

  var topicInput = document.getElementById("topic");
  var publishBtn = document.getElementById("publish");
  var openLink = document.getElementById("open");
  var logBox = document.getElementById("log");

  function fakeTopic() {
    return "demo-hq-local-fake-topic";
  }

  function syncLink() {
    var topic = (topicInput.value || "").trim() || fakeTopic();
    openLink.href = "../index.html#" + encodeURIComponent(topic);
  }

  function log(line) {
    logBox.textContent += line + "\n";
  }

  topicInput.value = fakeTopic();
  syncLink();
  topicInput.addEventListener("input", syncLink);

  publishBtn.addEventListener("click", function () {
    var topic = (topicInput.value || "").trim();
    if (!topic) {
      log("Need a fake topic.");
      return;
    }
    if (topic.length > 80 || /\s/.test(topic)) {
      log("That topic looks invalid. Use a short fake token.");
      return;
    }
    publishBtn.disabled = true;
    logBox.textContent = "";
    log("Publishing sample payloads to a fake topic...");
    var payloads = window.HQSamples.payloads();
    var index = 0;

    function next() {
      if (index >= payloads.length) {
        log("Done. Open the dashboard with the same fake topic in the fragment.");
        publishBtn.disabled = false;
        return;
      }
      var payload = payloads[index];
      var body = typeof payload === "string" ? payload : JSON.stringify(payload);
      fetch("https://ntfy.sh/" + encodeURIComponent(topic), {
        method: "POST",
        body: body,
        referrerPolicy: "no-referrer"
      })
        .then(function (res) {
          if (!res.ok) throw new Error("http " + res.status);
          log("sent " + (index + 1) + "/" + payloads.length);
          index += 1;
          setTimeout(next, 120);
        })
        .catch(function () {
          log("publish failed; check the network and try again");
          publishBtn.disabled = false;
        });
    }

    next();
  });
})();
