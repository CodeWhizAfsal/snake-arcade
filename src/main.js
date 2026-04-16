import {
  DIFFICULTIES,
  FOOD_RADIUS,
  MAPS,
  SNAKE_RADIUS,
  WORLD_SIZE,
  createGameState,
  queueDirection,
  startGame,
  stepGame,
  togglePause
} from "./game.js";

const STORAGE_KEYS = {
  highScore: "snake-arcade-high-score",
  appearance: "snake-arcade-appearance",
  theme: "snake-arcade-theme",
  sound: "snake-arcade-sound"
};

const THEMES = {
  classic: {
    board: "#07111c",
    grid: "rgba(0, 245, 255, 0.08)",
    boardGlow: "rgba(0, 245, 255, 0.12)",
    snakeCore: "#b6ffe2",
    snakeGlow: "#00f5ff",
    snakeTail: "#00ff9c",
    headCore: "#ffffff",
    eye: "#031018",
    food: "#ff5c8a",
    bonus: "#ffe666",
    obstacle: "#263856",
    particle: "#8ffdff"
  },
  neon: {
    board: "#10061b",
    grid: "rgba(255, 77, 184, 0.08)",
    boardGlow: "rgba(124, 77, 255, 0.16)",
    snakeCore: "#ffffff",
    snakeGlow: "#43f3ff",
    snakeTail: "#7c4dff",
    headCore: "#ffe8ff",
    eye: "#12061d",
    food: "#ff4db8",
    bonus: "#8dff3c",
    obstacle: "#3b235c",
    particle: "#74f9ff"
  },
  retro: {
    board: "#16130c",
    grid: "rgba(255, 209, 102, 0.08)",
    boardGlow: "rgba(255, 209, 102, 0.12)",
    snakeCore: "#f8ffd4",
    snakeGlow: "#ffd166",
    snakeTail: "#00ff9c",
    headCore: "#fff8db",
    eye: "#141006",
    food: "#ff8f5a",
    bonus: "#fff067",
    obstacle: "#5d4830",
    particle: "#ffe88a"
  }
};

const introScreen = document.querySelector("#intro-screen");
const gameScreen = document.querySelector("#game-screen");
const canvas = document.querySelector("#game-canvas");
const boardShell = document.querySelector("#board-shell");
const scoreElement = document.querySelector("#score");
const highScoreElement = document.querySelector("#high-score");
const introHighScoreElement = document.querySelector("#intro-high-score");
const statusElement = document.querySelector("#status-text");
const bonusElement = document.querySelector("#bonus-text");
const activeMap = document.querySelector("#active-map");
const activeDifficulty = document.querySelector("#active-difficulty");
const activeTheme = document.querySelector("#active-theme");
const mapPreview = document.querySelector("#map-preview");
const difficultyPreview = document.querySelector("#difficulty-preview");
const overlay = document.querySelector("#overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const overlayButton = document.querySelector("#overlay-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");
const backButton = document.querySelector("#back-button");
const startButton = document.querySelector("#start-button");
const appearanceToggle = document.querySelector("#appearance-toggle");
const soundToggle = document.querySelector("#sound-toggle");
const mapSelect = document.querySelector("#map-select");
const difficultySelect = document.querySelector("#difficulty-select");
const themeSelect = document.querySelector("#theme-select");
const controlButtons = document.querySelectorAll("[data-direction]");

const ctx = canvas.getContext("2d");

let state = createGameState();
let previousState = state;
let currentScreen = "intro";
let highScore = readNumber(STORAGE_KEYS.highScore, 0);
let appearance = readString(STORAGE_KEYS.appearance, "dark");
let selectedTheme = readString(STORAGE_KEYS.theme, "classic");
let soundEnabled = readString(STORAGE_KEYS.sound, "on") !== "off";
let lastFrameTime = performance.now();
let accumulator = 0;
let currentDpr = window.devicePixelRatio || 1;
let boardSize = 0;
let audioContext = null;
let particles = [];
let foodSpawnAt = performance.now();
let bonusSpawnAt = performance.now();
let touchStart = null;

bootstrap();

function bootstrap() {
  applyAppearance();
  populateSelectors();
  updateControlLabels();
  updateSetupPreview();
  resizeCanvas();
  bindEvents();
  renderHud();
  renderOverlay();
  window.requestAnimationFrame(frame);
}

function bindEvents() {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", resizeCanvas);

  startButton.addEventListener("click", startRun);
  restartButton.addEventListener("click", startRun);
  overlayButton.addEventListener("click", startRun);

  pauseButton.addEventListener("click", () => {
    if (currentScreen !== "game") {
      return;
    }

    state = togglePause(state);
    renderHud();
    renderOverlay();
  });

  backButton.addEventListener("click", () => {
    currentScreen = "intro";
    state = createGameState({
      mapKey: mapSelect.value,
      difficultyKey: difficultySelect.value
    });
    previousState = state;
    accumulator = 0;
    particles = [];
    renderHud();
    renderOverlay();
    syncScreens();
  });

  appearanceToggle.addEventListener("click", () => {
    appearance = appearance === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEYS.appearance, appearance);
    applyAppearance();
    updateControlLabels();
  });

  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(STORAGE_KEYS.sound, soundEnabled ? "on" : "off");
    updateControlLabels();
    unlockAudio();
  });

  mapSelect.addEventListener("change", updateSetupPreview);
  difficultySelect.addEventListener("change", updateSetupPreview);
  themeSelect.addEventListener("change", () => {
    selectedTheme = themeSelect.value;
    localStorage.setItem(STORAGE_KEYS.theme, selectedTheme);
    applyAppearance();
    renderHud();
  });

  controlButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (currentScreen !== "game") {
        return;
      }

      queueAndMaybeStart(button.dataset.direction);
      flashControl(button);
    });
  });

  boardShell.addEventListener(
    "touchstart",
    (event) => {
      if (currentScreen !== "game" || event.touches.length === 0) {
        return;
      }

      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    },
    { passive: true }
  );

  boardShell.addEventListener(
    "touchend",
    (event) => {
      if (currentScreen !== "game" || !touchStart) {
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;
      touchStart = null;

      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) {
        return;
      }

      const direction =
        Math.abs(deltaX) > Math.abs(deltaY)
          ? deltaX > 0
            ? "right"
            : "left"
          : deltaY > 0
            ? "down"
            : "up";

      queueAndMaybeStart(direction);
      triggerHaptic(10);
      event.preventDefault();
    },
    { passive: false }
  );
}

function frame(now) {
  const delta = Math.min(now - lastFrameTime, 50);
  lastFrameTime = now;

  if (currentScreen === "game" && state.status === "running") {
    accumulator += delta;

    while (accumulator >= state.tickMs) {
      advanceGame(now);
      accumulator -= state.tickMs;
    }
  }

  renderScene(now);
  window.requestAnimationFrame(frame);
}

function advanceGame(now) {
  const beforeState = state;
  const nextState = stepGame(state);
  const scored = nextState.score > beforeState.score;
  const isGameOver = beforeState.status !== "over" && nextState.status === "over";

  previousState = beforeState;
  state = nextState;

  if (scored) {
    spawnParticles(nextState.snake[0], nextState.bonusFood ? 14 : 10);
    triggerHaptic(22);
    playTone("eat");
  }

  if (!beforeState.bonusFood && nextState.bonusFood) {
    bonusSpawnAt = now;
    spawnParticles(nextState.bonusFood, 18);
  }

  if (beforeState.food && !samePosition(beforeState.food, nextState.food, 0.5)) {
    foodSpawnAt = now;
  }

  if (isGameOver) {
    triggerHaptic(120);
    playTone("gameOver");
  }

  if (state.score > highScore) {
    highScore = state.score;
    localStorage.setItem(STORAGE_KEYS.highScore, String(highScore));
  }

  renderHud();
  renderOverlay();
}

function renderScene(now) {
  syncScreens();
  updateParticles(now);
  resizeCanvasIfNeeded();

  const palette = THEMES[selectedTheme];
  const alpha =
    currentScreen === "game" && state.status === "running"
      ? Math.min(accumulator / state.tickMs, 1)
      : 1;

  ctx.clearRect(0, 0, boardSize, boardSize);
  drawBoard(palette, now);
  drawObstacles(palette);
  drawFood(palette, now);
  drawSnake(palette, alpha);
  drawParticles(palette);
}

function drawBoard(palette, now) {
  const lineCount = 14;
  const spacing = boardSize / lineCount;

  roundedRect(ctx, 0, 0, boardSize, boardSize, 28);
  ctx.fillStyle = palette.board;
  ctx.fill();

  const glow = ctx.createRadialGradient(
    boardSize * 0.5,
    boardSize * 0.5,
    40,
    boardSize * 0.5,
    boardSize * 0.5,
    boardSize * 0.7
  );
  glow.addColorStop(0, palette.boardGlow);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, boardSize, boardSize);

  ctx.save();
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.translate(0, Math.sin(now / 900) * 2);
  for (let index = 0; index <= lineCount; index += 1) {
    const offset = index * spacing;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, boardSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(boardSize, offset);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacles(palette) {
  for (const obstacle of state.obstacles) {
    ctx.save();
    ctx.fillStyle = palette.obstacle;
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 18;

    if (obstacle.type === "circle") {
      const center = toCanvasPoint(obstacle);
      ctx.beginPath();
      ctx.arc(center.x, center.y, toCanvasValue(obstacle.radius), 0, Math.PI * 2);
      ctx.fill();
    } else {
      roundedRect(
        ctx,
        toCanvasValue(obstacle.x),
        toCanvasValue(obstacle.y),
        toCanvasValue(obstacle.width),
        toCanvasValue(obstacle.height),
        12
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawFood(palette, now) {
  if (state.food) {
    const spawnScale = Math.min((now - foodSpawnAt) / 240, 1);
    drawOrb(state.food, FOOD_RADIUS * (0.72 + spawnScale * 0.28), palette.food, true);
  }

  if (state.bonusFood) {
    const pulse = 1 + Math.sin((now - bonusSpawnAt) / 140) * 0.12;
    drawOrb(state.bonusFood, 2.1 * pulse, palette.bonus, false);
  }
}

function drawOrb(position, radius, color, withStem) {
  const point = toCanvasPoint(position);
  const pxRadius = toCanvasValue(radius);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = pxRadius * 1.9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, pxRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(point.x - pxRadius * 0.25, point.y - pxRadius * 0.28, pxRadius * 0.24, 0, Math.PI * 2);
  ctx.fill();

  if (withStem) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#9cffcd";
    ctx.lineWidth = Math.max(2, pxRadius * 0.18);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - pxRadius * 0.95);
    ctx.quadraticCurveTo(
      point.x + pxRadius * 0.25,
      point.y - pxRadius * 1.5,
      point.x + pxRadius * 0.65,
      point.y - pxRadius * 1.12
    );
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = Math.max(2, pxRadius * 0.12);
    ctx.beginPath();
    ctx.arc(point.x, point.y, pxRadius * 1.38, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSnake(palette, alpha) {
  const interpolated = buildInterpolatedSnake(alpha);
  if (interpolated.length < 2) {
    return;
  }

  const smoothed = toSmoothCanvasPoints(interpolated);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = palette.snakeGlow;
  ctx.lineWidth = toCanvasValue(SNAKE_RADIUS * 2.9);
  ctx.shadowColor = palette.snakeGlow;
  ctx.shadowBlur = 30;
  strokeSmoothPath(smoothed);

  ctx.strokeStyle = palette.snakeTail;
  ctx.lineWidth = toCanvasValue(SNAKE_RADIUS * 2.15);
  ctx.shadowBlur = 18;
  strokeSmoothPath(smoothed);

  ctx.strokeStyle = palette.snakeCore;
  ctx.lineWidth = toCanvasValue(SNAKE_RADIUS * 1.25);
  ctx.shadowBlur = 10;
  strokeSmoothPath(smoothed);
  ctx.restore();

  drawHead(interpolated[0], interpolated[1], palette);
}

function drawHead(head, neck, palette) {
  const point = toCanvasPoint(head);
  const neckPoint = toCanvasPoint(neck ?? head);
  const heading = Math.atan2(point.y - neckPoint.y, point.x - neckPoint.x);
  const radius = toCanvasValue(SNAKE_RADIUS * 1.55);

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(heading);
  ctx.shadowColor = palette.snakeGlow;
  ctx.shadowBlur = 22;

  ctx.fillStyle = palette.headCore;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.05, radius * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.eye;
  ctx.beginPath();
  ctx.arc(radius * 0.18, -radius * 0.22, radius * 0.12, 0, Math.PI * 2);
  ctx.arc(radius * 0.18, radius * 0.22, radius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = palette.snakeGlow;
  ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath();
  ctx.moveTo(radius * 0.68, 0);
  ctx.lineTo(radius * 1.05, 0);
  ctx.stroke();
  ctx.restore();
}

function drawParticles(palette) {
  ctx.save();
  for (const particle of particles) {
    const point = toCanvasPoint(particle);
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = palette.particle;
    ctx.shadowColor = palette.particle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(point.x, point.y, toCanvasValue(particle.size), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function updateParticles(now) {
  particles = particles.filter((particle) => {
    const elapsed = now - particle.spawnAt;
    if (elapsed >= particle.life) {
      return false;
    }

    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.alpha = 1 - elapsed / particle.life;
    return true;
  });
}

function spawnParticles(position, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.7;
    const speed = 0.1 + Math.random() * 0.22;
    particles.push({
      x: position.x,
      y: position.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 0.3 + Math.random() * 0.45,
      alpha: 1,
      spawnAt: performance.now(),
      life: 260 + Math.random() * 160
    });
  }
}

function handleKeydown(event) {
  if (currentScreen !== "game") {
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    state = togglePause(state);
    renderHud();
    renderOverlay();
    return;
  }

  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowRight: "right",
    d: "right",
    D: "right"
  };

  const direction = keyMap[event.key];
  if (!direction) {
    return;
  }

  event.preventDefault();
  queueAndMaybeStart(direction);
}

function queueAndMaybeStart(direction) {
  unlockAudio();
  if (state.status === "paused") {
    state = togglePause(state);
  }
  state = queueDirection(state, direction);
  state = startGame(state);
  renderHud();
  renderOverlay();
}

function startRun() {
  unlockAudio();
  state = createGameState({
    mapKey: mapSelect.value,
    difficultyKey: difficultySelect.value
  });
  previousState = state;
  currentScreen = "game";
  accumulator = 0;
  particles = [];
  foodSpawnAt = performance.now();
  bonusSpawnAt = performance.now();
  renderHud();
  renderOverlay();
  syncScreens();
}

function syncScreens() {
  introScreen.classList.toggle("hidden", currentScreen !== "intro");
  gameScreen.classList.toggle("hidden", currentScreen !== "game");
}

function renderHud() {
  scoreElement.textContent = String(state.score);
  highScoreElement.textContent = String(highScore);
  introHighScoreElement.textContent = String(highScore);
  statusElement.textContent = getStatusText();
  bonusElement.textContent = getBonusText();
  activeMap.textContent = MAPS[state.mapKey].label;
  activeDifficulty.textContent = DIFFICULTIES[state.difficultyKey].label;
  activeTheme.textContent = capitalize(selectedTheme);
  pauseButton.textContent = state.status === "paused" ? "Resume" : "Pause";
}

function renderOverlay() {
  overlay.classList.remove("game-over");
  overlayButton.classList.add("hidden");

  if (currentScreen !== "game") {
    overlay.classList.add("hidden");
    return;
  }

  if (state.status === "ready") {
    overlay.classList.remove("hidden");
    overlayKicker.textContent = "Ready";
    overlayTitle.textContent = "Guide the head and let the body flow";
    overlayText.textContent = "Use arrows, WASD, or swipe to begin your run.";
    return;
  }

  if (state.status === "paused") {
    overlay.classList.remove("hidden");
    overlayKicker.textContent = "Paused";
    overlayTitle.textContent = "Momentum is waiting";
    overlayText.textContent = "Press Resume, space, or any direction to glide back in.";
    return;
  }

  if (state.status === "over") {
    overlay.classList.remove("hidden");
    overlay.classList.add("game-over");
    overlayKicker.textContent = "Game Over";
    overlayTitle.textContent = `Score ${state.score} | Foods ${state.foodsEaten}`;
    overlayText.textContent = "Play again with the same setup and push for a cleaner line.";
    overlayButton.classList.remove("hidden");
    return;
  }

  overlay.classList.add("hidden");
}

function resizeCanvasIfNeeded() {
  const nextSize = Math.floor(boardShell.clientWidth);
  const nextDpr = window.devicePixelRatio || 1;
  if (nextSize !== boardSize || nextDpr !== currentDpr) {
    resizeCanvas();
  }
}

function resizeCanvas() {
  boardSize = Math.max(240, Math.floor(boardShell.clientWidth || 0));
  currentDpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(boardSize * currentDpr);
  canvas.height = Math.floor(boardSize * currentDpr);
  canvas.style.width = `${boardSize}px`;
  canvas.style.height = `${boardSize}px`;
  ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
}

function updateSetupPreview() {
  const map = MAPS[mapSelect.value];
  const difficulty = DIFFICULTIES[difficultySelect.value];

  mapPreview.innerHTML = `
    <p class="control-label">Map Preview</p>
    <h3>${map.label}</h3>
    <p>${map.description}</p>
  `;

  difficultyPreview.innerHTML = `
    <p class="control-label">Speed Preview</p>
    <h3>${difficulty.label}</h3>
    <p>Continuous drift tuned at ${difficulty.speed.toFixed(2)} units per tick.</p>
  `;
}

function populateSelectors() {
  mapSelect.innerHTML = Object.entries(MAPS)
    .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
    .join("");
  difficultySelect.innerHTML = Object.entries(DIFFICULTIES)
    .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
    .join("");
  mapSelect.value = state.mapKey;
  difficultySelect.value = state.difficultyKey;
  themeSelect.value = selectedTheme;
}

function updateControlLabels() {
  appearanceToggle.textContent =
    appearance === "dark" ? "Switch to Light" : "Switch to Dark";
  soundToggle.textContent = soundEnabled ? "Sound On" : "Sound Off";
}

function applyAppearance() {
  document.body.dataset.appearance = appearance;
  document.body.dataset.theme = selectedTheme;
}

function getStatusText() {
  if (state.status === "running") {
    return `${MAPS[state.mapKey].label} | ${DIFFICULTIES[state.difficultyKey].label}`;
  }
  if (state.status === "paused") {
    return "Paused";
  }
  if (state.status === "over") {
    return "Game Over";
  }
  return "Ready";
}

function getBonusText() {
  if (!state.bonusFood) {
    return "No bonus";
  }
  return `${state.bonusValue} pts`;
}

function buildInterpolatedSnake(alpha) {
  return state.snake.map((point, index) => {
    const previous = previousState.snake[index] ?? previousState.snake.at(-1) ?? point;
    return {
      x: previous.x + (point.x - previous.x) * alpha,
      y: previous.y + (point.y - previous.y) * alpha
    };
  });
}

function toSmoothCanvasPoints(points) {
  return points.map((point) => toCanvasPoint(point));
}

function strokeSmoothPath(points) {
  if (points.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length - 1; index += 1) {
    const midpoint = {
      x: (points[index].x + points[index + 1].x) / 2,
      y: (points[index].y + points[index + 1].y) / 2
    };
    ctx.quadraticCurveTo(points[index].x, points[index].y, midpoint.x, midpoint.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function toCanvasPoint(point) {
  return {
    x: (point.x / WORLD_SIZE) * boardSize,
    y: (point.y / WORLD_SIZE) * boardSize
  };
}

function toCanvasValue(value) {
  return (value / WORLD_SIZE) * boardSize;
}

function samePosition(a, b, tolerance = 0.0001) {
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

function flashControl(button) {
  button.classList.add("is-active");
  window.setTimeout(() => {
    button.classList.remove("is-active");
  }, 140);
}

function triggerHaptic(duration) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

function unlockAudio() {
  if (!soundEnabled || audioContext) {
    return;
  }

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    return;
  }

  audioContext = new AudioContextConstructor();
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

function playTone(kind) {
  if (!soundEnabled) {
    return;
  }

  unlockAudio();
  if (!audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const config =
    kind === "gameOver"
      ? { freq: 180, duration: 0.35, type: "sawtooth", end: 80 }
      : { freq: 620, duration: 0.08, type: "triangle", end: 920 };

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = config.type;
  oscillator.frequency.setValueAtTime(config.freq, now);
  oscillator.frequency.exponentialRampToValueAtTime(config.end, now + config.duration);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + config.duration);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + config.duration);
}

function readNumber(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(key, fallback) {
  return localStorage.getItem(key) ?? fallback;
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
