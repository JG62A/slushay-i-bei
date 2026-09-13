var TOTAL_ROUNDS = 5;
var MIN_WAIT = 1000;
var MAX_WAIT = 4000;

var els = {
  start: document.getElementById("start-screen"),
  play: document.getElementById("play-screen"),
  result: document.getElementById("result-screen"),
  status: document.getElementById("status"),
  chip: document.getElementById("round-chip"),
  ball: document.getElementById("ball"),
  pitch: document.getElementById("pitch"),
  soundStart: document.getElementById("sound-start-btn"),
  soundPlay: document.getElementById("sound-play-btn"),
  best: document.getElementById("result-best"),
  avg: document.getElementById("result-avg"),
  list: document.getElementById("result-list"),
  whistle: document.getElementById("whistle-el"),
  kick: document.getElementById("kick-el"),
  error: document.getElementById("error-el"),
  clap: document.getElementById("applause-el"),
};

var sound = { enabled: true, unlocked: false };
var waitTimer = null;
var nextTimer = null;
var round = 0;
var times = [];
var phase = "idle";
var whistleAt = 0;

function bindTap(el, fn) {
  if (!el) return;
  var locked = false;
  var lastTouch = 0;
  function run(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (locked) return;
    locked = true;
    fn(event);
    setTimeout(function () {
      locked = false;
    }, el === els.ball ? 80 : 220);
  }
  el.addEventListener(
    "touchstart",
    function (event) {
      lastTouch = Date.now();
      run(event);
    },
    false
  );
  el.addEventListener(
    "click",
    function (event) {
      if (Date.now() - lastTouch < 700) return;
      run(event);
    },
    false
  );
}

function show(screen) {
  [els.start, els.play, els.result].forEach(function (node) {
    node.classList.remove("is-active");
    node.hidden = true;
  });
  screen.hidden = false;
  screen.classList.add("is-active");
}

function setStatus(text, cls) {
  els.status.textContent = text;
  els.status.className = "status" + (cls ? " " + cls : "");
}

function playEl(el) {
  if (!sound.enabled || !el) return;
  try {
    el.pause();
    el.currentTime = 0;
    var result = el.play();
    if (result && result.catch) result.catch(function () {});
  } catch (error) {}
}

function unlockAudio() {
  ["whistle", "kick", "error", "clap"].forEach(function (key) {
    var el = els[key];
    if (!el) return;
    try {
      el.muted = true;
      var result = el.play();
      if (result && result.then) {
        result
          .then(function () {
            el.pause();
            el.currentTime = 0;
            el.muted = false;
          })
          .catch(function () {
            el.muted = false;
          });
      }
    } catch (error) {}
  });
  sound.unlocked = true;
  updateSoundButtons();
}

function updateSoundButtons() {
  if (els.soundStart) {
    if (!sound.enabled) els.soundStart.textContent = "🔇 Звук выключен";
    else if (sound.unlocked) els.soundStart.textContent = "🔊 Звук включён";
    else els.soundStart.textContent = "🔊 Нажмите, чтобы включить звук";
  }
  if (els.soundPlay) els.soundPlay.textContent = sound.enabled ? "🔊" : "🔇";
}

function toggleSound() {
  if (sound.enabled && !sound.unlocked) {
    unlockAudio();
    return;
  }
  sound.enabled = !sound.enabled;
  if (sound.enabled) unlockAudio();
  updateSoundButtons();
}

function grade(ms) {
  if (ms < 300) return "🔥 Супер!";
  if (ms < 500) return "⚡ Отлично!";
  if (ms < 800) return "👍 Хорошо!";
  return "Попробуй ещё!";
}

function clearTimers() {
  if (waitTimer) {
    clearTimeout(waitTimer);
    waitTimer = null;
  }
  if (nextTimer) {
    clearTimeout(nextTimer);
    nextTimer = null;
  }
}

function resetBall() {
  els.ball.classList.remove("is-kicked", "is-early", "is-ready");
  els.pitch.classList.remove("is-goal");
  void els.ball.offsetWidth;
  var goal = els.pitch.querySelector(".goal");
  if (!goal) return;
  var pitchBox = els.pitch.getBoundingClientRect();
  var ballBox = els.ball.getBoundingClientRect();
  var goalBox = goal.getBoundingClientRect();
  var from = ballBox.top + ballBox.height / 2 - pitchBox.top;
  var to = goalBox.top + goalBox.height * 0.55 - pitchBox.top;
  els.ball.style.setProperty("--fly-y", to - from + "px");
}

function startGame() {
  unlockAudio();
  round = 0;
  times = [];
  show(els.play);
  startRound();
}

function startRound() {
  clearTimers();
  resetBall();
  phase = "wait";
  els.chip.textContent = "Раунд " + (round + 1) + " / " + TOTAL_ROUNDS;
  setStatus("Жди сигнал...", "is-wait");
  var delay = MIN_WAIT + Math.floor(Math.random() * (MAX_WAIT - MIN_WAIT + 1));
  waitTimer = setTimeout(blowWhistle, delay);
}

function blowWhistle() {
  if (phase !== "wait") return;
  phase = "go";
  whistleAt = performance.now();
  els.ball.classList.add("is-ready");
  setStatus("Бей!", "is-go");
  playEl(els.whistle);
}

function onBall() {
  if (phase === "wait") {
    falseStart();
    return;
  }
  if (phase !== "go") return;

  var ms = Math.max(0, Math.round(performance.now() - whistleAt));
  times.push(ms);
  phase = "shot";
  els.ball.classList.remove("is-ready");
  els.ball.classList.add("is-kicked");
  els.pitch.classList.add("is-goal");
  playEl(els.kick);
  setTimeout(function () {
    playEl(els.clap);
  }, 180);
  setStatus(ms + " мс · " + grade(ms), "is-good");

  nextTimer = setTimeout(function () {
    round += 1;
    if (round >= TOTAL_ROUNDS) finishGame();
    else startRound();
  }, 1600);
}

function falseStart() {
  phase = "early";
  clearTimers();
  els.ball.classList.remove("is-ready");
  els.ball.classList.add("is-early");
  playEl(els.error);
  setStatus("Слишком рано! 😄", "is-early");
  nextTimer = setTimeout(startRound, 1100);
}

function finishGame() {
  phase = "done";
  var best = Math.min.apply(null, times);
  var avg = Math.round(times.reduce(function (a, b) {
    return a + b;
  }, 0) / times.length);
  els.best.textContent = "Лучший: " + best + " мс";
  els.avg.textContent = "Средний: " + avg + " мс";
  els.list.innerHTML = times
    .map(function (ms, i) {
      return "<p>" + (i + 1) + ") " + ms + " мс — " + grade(ms) + "</p>";
    })
    .join("");
  show(els.result);
}

function goHome() {
  clearTimers();
  phase = "idle";
  resetBall();
  show(els.start);
}

bindTap(els.soundStart, toggleSound);
bindTap(els.soundPlay, toggleSound);
bindTap(document.getElementById("play-btn"), startGame);
bindTap(document.getElementById("home-btn"), goHome);
bindTap(document.getElementById("replay-btn"), startGame);
bindTap(document.getElementById("menu-btn"), goHome);
bindTap(els.ball, onBall);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./service-worker.js").catch(function () {});
  });
}

updateSoundButtons();
