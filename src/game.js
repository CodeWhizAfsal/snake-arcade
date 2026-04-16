export const WORLD_SIZE = 100;
export const INITIAL_DIRECTION = "right";
export const BONUS_START_VALUE = 8;
export const BONUS_DECAY_TICKS = 4;
export const SNAKE_RADIUS = 2.2;
export const FOOD_RADIUS = 1.7;
export const BONUS_RADIUS = 1.95;
export const SEGMENT_SPACING = 1.1;
export const INITIAL_LENGTH = 16;
export const GROWTH_PER_FOOD = 5.5;

export const DIFFICULTIES = {
  easy: {
    label: "Easy",
    tickMs: 26,
    speed: 1.05,
    turnRate: 0.16
  },
  medium: {
    label: "Medium",
    tickMs: 18,
    speed: 1.35,
    turnRate: 0.2
  },
  hard: {
    label: "Hard",
    tickMs: 12,
    speed: 1.72,
    turnRate: 0.24
  }
};

export const MAPS = {
  classic: {
    label: "Classic Stream",
    description: "Open playfield tuned for speed and flow.",
    obstacles: []
  },
  gates: {
    label: "Gate Run",
    description: "Twin barrier lanes force bold turns through narrow gaps.",
    obstacles: [
      createRect(26, 10, 6, 26),
      createRect(26, 58, 6, 26),
      createRect(68, 10, 6, 26),
      createRect(68, 58, 6, 26)
    ]
  },
  cross: {
    label: "Cross Roads",
    description: "A central cross layout rewards smooth cornering.",
    obstacles: [
      createRect(46, 8, 8, 20),
      createRect(46, 72, 8, 20),
      createRect(12, 46, 20, 8),
      createRect(68, 46, 20, 8)
    ]
  },
  pillars: {
    label: "Pulse Pillars",
    description: "Wide-open routes broken up by floating obstruction islands.",
    obstacles: [
      createCircle(26, 26, 5.5),
      createCircle(74, 26, 5.5),
      createCircle(26, 74, 5.5),
      createCircle(74, 74, 5.5),
      createCircle(50, 38, 4.25),
      createCircle(50, 62, 4.25)
    ]
  }
};

export const DIRECTION_ANGLES = {
  up: -Math.PI / 2,
  down: Math.PI / 2,
  left: Math.PI,
  right: 0
};

export const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function createGameState(options = {}) {
  const random = options.random ?? Math.random;
  const mapKey = options.mapKey ?? "classic";
  const difficultyKey = options.difficultyKey ?? "medium";
  const difficulty = getDifficultyConfig(difficultyKey);
  const map = getMapConfig(mapKey);
  const snake = createInitialSnake();
  const food = placeItem({
    snake,
    obstacles: map.obstacles,
    random
  });

  return {
    worldSize: WORLD_SIZE,
    snake,
    direction: INITIAL_DIRECTION,
    angle: DIRECTION_ANGLES[INITIAL_DIRECTION],
    targetAngle: DIRECTION_ANGLES[INITIAL_DIRECTION],
    food,
    bonusFood: null,
    foodsEaten: 0,
    score: 0,
    status: "ready",
    mapKey,
    difficultyKey,
    obstacles: map.obstacles,
    tickMs: difficulty.tickMs,
    speed: difficulty.speed,
    turnRate: difficulty.turnRate,
    bonusValue: 0,
    bonusTicksLeft: 0,
    trailLength: INITIAL_LENGTH
  };
}

export function createInitialSnake() {
  const head = { x: 32, y: 50 };
  const points = [];

  for (let index = 0; index < Math.ceil(INITIAL_LENGTH / SEGMENT_SPACING); index += 1) {
    points.push({
      x: head.x - index * SEGMENT_SPACING,
      y: head.y
    });
  }

  return points;
}

export function queueDirection(state, nextDirection) {
  if (!(nextDirection in DIRECTION_ANGLES)) {
    return state;
  }

  return {
    ...state,
    direction: nextDirection,
    targetAngle: DIRECTION_ANGLES[nextDirection]
  };
}

export function startGame(state) {
  if (state.status === "ready") {
    return {
      ...state,
      status: "running"
    };
  }

  return state;
}

export function togglePause(state) {
  if (state.status === "running") {
    return {
      ...state,
      status: "paused"
    };
  }

  if (state.status === "paused") {
    return {
      ...state,
      status: "running"
    };
  }

  return state;
}

export function changeMap(state, mapKey, random = Math.random) {
  return createGameState({
    random,
    mapKey,
    difficultyKey: state.difficultyKey
  });
}

export function changeDifficulty(state, difficultyKey, random = Math.random) {
  return createGameState({
    random,
    mapKey: state.mapKey,
    difficultyKey
  });
}

export function stepGame(state, random = Math.random) {
  if (state.status !== "running") {
    return state;
  }

  const nextAngle = rotateTowards(state.angle, state.targetAngle, state.turnRate);
  const nextHead = {
    x: state.snake[0].x + Math.cos(nextAngle) * state.speed,
    y: state.snake[0].y + Math.sin(nextAngle) * state.speed
  };

  let nextTrailLength = state.trailLength;
  const ateRegularFood = distance(nextHead, state.food) <= SNAKE_RADIUS + FOOD_RADIUS;
  const ateBonusFood =
    state.bonusFood && distance(nextHead, state.bonusFood) <= SNAKE_RADIUS + BONUS_RADIUS;

  if (ateRegularFood || ateBonusFood) {
    nextTrailLength += GROWTH_PER_FOOD;
  }

  const nextSnake = trimTrail([nextHead, ...state.snake], nextTrailLength);

  if (
    hitsWall(nextHead, state.worldSize, SNAKE_RADIUS) ||
    hitsObstacle(nextHead, state.obstacles, SNAKE_RADIUS) ||
    hitsSelf(nextHead, nextSnake, SNAKE_RADIUS)
  ) {
    return {
      ...state,
      angle: nextAngle,
      status: "over"
    };
  }

  let nextState = {
    ...state,
    snake: nextSnake,
    angle: nextAngle,
    trailLength: nextTrailLength
  };

  if (ateRegularFood) {
    nextState = consumeRegularFood(nextState, random);
  } else if (ateBonusFood) {
    nextState = {
      ...nextState,
      score: nextState.score + nextState.bonusValue,
      bonusFood: null,
      bonusValue: 0,
      bonusTicksLeft: 0
    };
  } else if (nextState.bonusFood) {
    nextState = decayBonus(nextState);
  }

  return nextState;
}

function consumeRegularFood(state, random) {
  const foodsEaten = state.foodsEaten + 1;
  const score = state.score + 1;
  const food = placeItem({
    snake: state.snake,
    obstacles: state.obstacles,
    random,
    blocked: state.bonusFood ? [state.bonusFood] : []
  });

  let nextState = {
    ...state,
    foodsEaten,
    score,
    food
  };

  if (foodsEaten % 4 === 0) {
    const bonusFood = placeItem({
      snake: nextState.snake,
      obstacles: nextState.obstacles,
      random,
      blocked: food ? [food] : []
    });

    nextState = {
      ...nextState,
      bonusFood,
      bonusValue: bonusFood ? BONUS_START_VALUE : 0,
      bonusTicksLeft: bonusFood ? BONUS_DECAY_TICKS : 0
    };
  } else if (nextState.bonusFood) {
    nextState = decayBonus(nextState);
  }

  return nextState;
}

function decayBonus(state) {
  if (!state.bonusFood) {
    return state;
  }

  const bonusTicksLeft = state.bonusTicksLeft - 1;
  if (bonusTicksLeft > 0) {
    return {
      ...state,
      bonusTicksLeft
    };
  }

  const bonusValue = state.bonusValue - 1;
  if (bonusValue <= 0) {
    return {
      ...state,
      bonusFood: null,
      bonusValue: 0,
      bonusTicksLeft: 0
    };
  }

  return {
    ...state,
    bonusValue,
    bonusTicksLeft: BONUS_DECAY_TICKS
  };
}

export function placeFood(snake, worldSize = WORLD_SIZE, random = Math.random) {
  return placeItem({
    snake,
    obstacles: [],
    worldSize,
    random
  });
}

export function placeItem({
  snake,
  obstacles,
  random = Math.random,
  worldSize = WORLD_SIZE,
  blocked = []
}) {
  const maxAttempts = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = {
      x: 8 + random() * (worldSize - 16),
      y: 8 + random() * (worldSize - 16)
    };

    if (
      !hitsObstacle(candidate, obstacles, FOOD_RADIUS + 1) &&
      !blocked.some((item) => distance(item, candidate) < FOOD_RADIUS * 3) &&
      !snake.some((point, index) => {
        const threshold = index === 0 ? SNAKE_RADIUS * 4 : SNAKE_RADIUS * 2.4;
        return distance(point, candidate) < threshold;
      })
    ) {
      return candidate;
    }
  }

  return {
    x: worldSize / 2,
    y: worldSize / 2
  };
}

export function hitsWall(position, worldSize = WORLD_SIZE, radius = SNAKE_RADIUS) {
  return (
    position.x < radius ||
    position.y < radius ||
    position.x > worldSize - radius ||
    position.y > worldSize - radius
  );
}

export function hitsObstacle(position, obstacles, radius = SNAKE_RADIUS) {
  return obstacles.some((obstacle) => {
    if (obstacle.type === "circle") {
      return distance(position, obstacle) <= obstacle.radius + radius;
    }

    const nearestX = clamp(position.x, obstacle.x, obstacle.x + obstacle.width);
    const nearestY = clamp(position.y, obstacle.y, obstacle.y + obstacle.height);
    return distance(position, { x: nearestX, y: nearestY }) <= radius;
  });
}

export function hitsSelf(head, snake, radius = SNAKE_RADIUS) {
  const ignore = Math.max(10, Math.ceil((radius * 5) / SEGMENT_SPACING));
  for (let index = ignore; index < snake.length; index += 1) {
    if (distance(head, snake[index]) < radius * 1.5) {
      return true;
    }
  }

  return false;
}

export function getDifficultyConfig(difficultyKey) {
  return DIFFICULTIES[difficultyKey] ?? DIFFICULTIES.medium;
}

export function getMapConfig(mapKey) {
  return MAPS[mapKey] ?? MAPS.classic;
}

export function trimTrail(points, maxLength) {
  if (points.length <= 1) {
    return points;
  }

  let remaining = maxLength;
  const trimmed = [points[0]];

  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = distance(points[index - 1], points[index]);
    if (remaining <= 0) {
      break;
    }

    if (segmentLength <= remaining) {
      trimmed.push(points[index]);
      remaining -= segmentLength;
      continue;
    }

    const ratio = remaining / segmentLength;
    trimmed.push({
      x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
      y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio
    });
    break;
  }

  return trimmed;
}

export function rotateTowards(current, target, maxStep) {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxStep) {
    return normalizeAngle(target);
  }

  return normalizeAngle(current + Math.sign(delta) * maxStep);
}

export function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  return normalized;
}

export function distance(a, b) {
  if (!a || !b) {
    return Infinity;
  }

  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createRect(x, y, width, height) {
  return {
    type: "rect",
    x,
    y,
    width,
    height
  };
}

function createCircle(x, y, radius) {
  return {
    type: "circle",
    x,
    y,
    radius
  };
}
