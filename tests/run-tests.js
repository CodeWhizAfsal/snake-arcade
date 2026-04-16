import assert from "node:assert/strict";

import {
  BONUS_DECAY_TICKS,
  DIFFICULTIES,
  WORLD_SIZE,
  changeDifficulty,
  changeMap,
  createGameState,
  distance,
  hitsObstacle,
  hitsWall,
  placeItem,
  queueDirection,
  rotateTowards,
  startGame,
  stepGame,
  trimTrail
} from "../src/game.js";

const tests = [
  {
    name: "moves the head forward continuously when running",
    run() {
      let state = createGameState({ random: () => 0.5 });
      const startX = state.snake[0].x;
      state = startGame(state);
      state = stepGame(state, () => 0.5);

      assert.ok(state.snake[0].x > startX);
      assert.equal(state.score, 0);
    }
  },
  {
    name: "turns smoothly toward a queued direction instead of teleporting",
    run() {
      let state = createGameState({ random: () => 0.5 });
      state = startGame(queueDirection(state, "down"));
      state = stepGame(state, () => 0.5);

      assert.ok(state.angle > 0);
      assert.ok(state.angle < Math.PI / 2);
      assert.ok(state.snake[0].y > 50);
    }
  },
  {
    name: "grows and increments score when food is eaten",
    run() {
      let state = createGameState({ random: () => 0.5 });
      state = {
        ...state,
        status: "running",
        food: {
          x: state.snake[0].x + state.speed,
          y: state.snake[0].y
        }
      };

      const priorLength = state.trailLength;
      state = stepGame(state, () => 0.25);

      assert.equal(state.score, 1);
      assert.ok(state.trailLength > priorLength);
      assert.ok(state.food);
    }
  },
  {
    name: "changes map and difficulty through fresh deterministic state",
    run() {
      let state = createGameState({ random: () => 0.5 });
      state = changeMap(state, "gates", () => 0.5);
      state = changeDifficulty(state, "hard", () => 0.5);

      assert.equal(state.mapKey, "gates");
      assert.equal(state.difficultyKey, "hard");
      assert.equal(state.tickMs, DIFFICULTIES.hard.tickMs);
      assert.ok(state.obstacles.length > 0);
    }
  },
  {
    name: "detects wall collision in the continuous playfield",
    run() {
      const result = hitsWall({ x: WORLD_SIZE - 0.5, y: 50 });
      assert.equal(result, true);
    }
  },
  {
    name: "sets game over when the head reaches an obstacle",
    run() {
      let state = createGameState({
        random: () => 0.5,
        mapKey: "pillars"
      });
      state = {
        ...state,
        status: "running",
        snake: [{ x: 19.4, y: 26 }, ...state.snake.slice(1)],
        angle: 0,
        targetAngle: 0
      };
      state = stepGame(state, () => 0.5);

      assert.equal(state.status, "over");
    }
  },
  {
    name: "places items away from snake points and obstacles",
    run() {
      const samples = [0.5, 0.15, 0.8, 0.22, 0.74, 0.31];
      let index = 0;
      const item = placeItem({
        snake: [{ x: 20, y: 20 }, { x: 19, y: 20 }],
        obstacles: [{ type: "circle", x: 50, y: 50, radius: 8 }],
        random: () => {
          const value = samples[index % samples.length];
          index += 1;
          return value;
        }
      });

      assert.ok(distance(item, { x: 50, y: 50 }) > 8);
      assert.ok(distance(item, { x: 20, y: 20 }) > 4);
    }
  },
  {
    name: "trimTrail limits the snake trail to the requested length",
    run() {
      const trail = trimTrail(
        [
          { x: 10, y: 10 },
          { x: 8, y: 10 },
          { x: 6, y: 10 },
          { x: 4, y: 10 }
        ],
        3
      );

      assert.ok(trail.length >= 2);
      assert.ok(distance(trail[0], trail.at(-1)) <= 3.01);
    }
  },
  {
    name: "spawns bonus food after the fourth regular food",
    run() {
      let state = createGameState({ random: () => 0.2 });
      state = {
        ...state,
        status: "running",
        foodsEaten: 3,
        food: {
          x: state.snake[0].x + state.speed,
          y: state.snake[0].y
        }
      };
      state = stepGame(state, () => 0.1);

      assert.equal(state.foodsEaten, 4);
      assert.ok(state.bonusFood);
      assert.equal(state.bonusValue, 8);
      assert.equal(state.bonusTicksLeft, BONUS_DECAY_TICKS);
    }
  },
  {
    name: "bonus food value decays and eventually disappears",
    run() {
      let state = createGameState({ random: () => 0.1 });
      state = {
        ...state,
        status: "running",
        bonusFood: { x: 70, y: 70 },
        bonusValue: 2,
        bonusTicksLeft: 1
      };

      state = stepGame(state, () => 0.1);
      assert.equal(state.bonusValue, 1);
      assert.equal(state.bonusTicksLeft, BONUS_DECAY_TICKS);

      state = {
        ...state,
        bonusTicksLeft: 1
      };
      state = stepGame(state, () => 0.1);
      assert.equal(state.bonusFood, null);
      assert.equal(state.bonusValue, 0);
    }
  },
  {
    name: "eating bonus food awards its current value",
    run() {
      let state = createGameState({ random: () => 0.3 });
      state = {
        ...state,
        status: "running",
        score: 7,
        bonusFood: {
          x: state.snake[0].x + state.speed,
          y: state.snake[0].y
        },
        bonusValue: 5,
        food: { x: 80, y: 80 }
      };

      const previousLength = state.trailLength;
      state = stepGame(state, () => 0.3);

      assert.equal(state.score, 12);
      assert.equal(state.bonusFood, null);
      assert.ok(state.trailLength > previousLength);
    }
  },
  {
    name: "rotateTowards clamps turning to a maximum step",
    run() {
      const angle = rotateTowards(0, Math.PI / 2, 0.2);
      assert.ok(angle > 0 && angle <= 0.2);
    }
  },
  {
    name: "hitsObstacle supports rectangle and circle obstacles",
    run() {
      const rectHit = hitsObstacle(
        { x: 12, y: 12 },
        [{ type: "rect", x: 10, y: 10, width: 10, height: 10 }],
        1
      );
      const circleHit = hitsObstacle(
        { x: 50, y: 58 },
        [{ type: "circle", x: 50, y: 50, radius: 8 }],
        1
      );

      assert.equal(rectHit, true);
      assert.equal(circleHit, true);
    }
  }
];

let failures = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${test.name}`);
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`All ${tests.length} tests passed.`);
}
