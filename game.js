/* ============================================
   GAME.JS — Main Game Loop & Core Systems
   Sets up the canvas, handles keyboard input,
   manages game state transitions, runs the
   update/draw loop, and handles combat logic.
   ============================================ */

// ──────────────────────────────────────────
// CANVAS SETUP
// Get the canvas element and its 2D drawing
// context. All rendering goes through ctx.
// ──────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = 1200;
canvas.height = 600;

// ──────────────────────────────────────────
// GAME CONSTANTS
// Tuning values that control physics and
// combat mechanics across the whole game
// ──────────────────────────────────────────
const GROUND = canvas.height - 60;     // Y position of the floor
const GRAVITY = 0.6;                   // Downward acceleration per frame
const HEAVY_CHARGE_TIME = 180;         // Frames to hold J/K for heavy attack (3 sec at 60fps)
const HEAVY_DAMAGE_MULT = 3;           // Heavy attacks deal 3x base damage
const PARRY_WINDOW = 10;               // Frames after pressing U where parry can catch
const PARRY_SLAM_DAMAGE = 50;          // Damage dealt by a successful parry slam
                                        // (heavier than heavy punch: 12*3=36, heavy kick: ~47)

// ──────────────────────────────────────────
// INPUT TRACKING
// Three objects work together to track keys:
// - keys: which keys are currently held down
// - keyDownTime: how many frames each key has been held
// - keyJustPressed: true only on the first frame of a press
// ──────────────────────────────────────────
const keys = {};
const keyDownTime = {};
const keyJustPressed = {};

// When a key is pressed down
window.addEventListener('keydown', e => {
  // Normalize key names (space bar is stored as ' ')
  const k = e.key === ' ' ? ' ' : e.key.toLowerCase();

  // Only trigger "just pressed" on the initial press, not repeats
  if (!keys[k]) {
    keyDownTime[k] = 0;
    keyJustPressed[k] = true;
  }
  keys[k] = true;
  e.preventDefault(); // Prevent browser default actions (scrolling, etc.)
});

// When a key is released
window.addEventListener('keyup', e => {
  const k = e.key === ' ' ? ' ' : e.key.toLowerCase();
  keys[k] = false;
  delete keyDownTime[k]; // Stop tracking hold time
  e.preventDefault();
});

// ──────────────────────────────────────────
// GAME STATE VARIABLES
// These control what the game is currently
// doing and track all active game objects
// ──────────────────────────────────────────
let gameState = 'menu';     // Current state: 'menu', 'fighting', 'levelComplete', 'gameOver', 'victory'
let currentLevel = 1;       // Which level the player is on (1-10)
const MAX_LEVEL = 10;       // Total number of levels
let enemies = [];           // Array of enemy Fighter objects for the current level
let particles = [];         // Array of active Particle objects (hit effects, etc.)
let shakeTimer = 0;         // Frames remaining of screen shake
let shakeIntensity = 0;     // How violently the screen shakes
let levelStartTimer = 0;    // Countdown before a level starts (lets player read the level name)
let messageTimer = 0;       // Frames remaining for the current on-screen message
let messageText = '';       // Text of the current message

// ──────────────────────────────────────────
// PLAYER SETUP
// Create the player fighter with starting stats.
// The player is re-created when starting a new game.
// ──────────────────────────────────────────
let player = new Fighter(200, GROUND, true, {
  maxHP: 100,
  speed: 4,
  damage: 12
});

// ──────────────────────────────────────────
// START LEVEL
// Resets the arena for a new level: spawns
// enemies, heals the player, resets positions
// ──────────────────────────────────────────
function startLevel(level) {
  // Get enemy configs for this level
  const config = getLevelConfig(level);

  // Spawn enemies on the right side of the screen, spaced apart
  enemies = [];
  config.enemies.forEach((ec, i) => {
    const ex = canvas.width - 250 - i * 90;
    enemies.push(new Fighter(ex, GROUND, false, ec));
  });

  // Reset player to full health and starting position
  player.hp = player.maxHP;
  player.dead = false;
  player.x = 180;
  player.y = GROUND;
  player.vx = 0;
  player.vy = 0;

  // Clear all combat states
  player.hit = false;
  player.hitTimer = 0;
  player.punching = false;
  player.kicking = false;
  player.blocking = false;
  player.chargingPunch = false;
  player.chargingKick = false;
  player.chargeTime = 0;
  player.isHeavyAttack = false;
  player.attackTimer = 0;
  player.attackCooldown = 0;
  player.parrying = false;
  player.parryTimer = 0;
  player.slamming = false;
  player.slamTimer = 0;
  player.slamTarget = null;

  // Set game state and show level name
  gameState = 'fighting';
  levelStartTimer = 90; // 1.5 second pause before fighting starts
  messageText = `Level ${level}: ${config.name}`;
  messageTimer = 90;
  particles = [];
}

// ──────────────────────────────────────────
// COLLISION DETECTION
// Checks if two rectangles (hitboxes) overlap.
// Used for attack-to-hurtbox collision checks.
// ──────────────────────────────────────────
function boxOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// ──────────────────────────────────────────
// ATTACK CHECKING
// Runs every frame during combat to see if
// any active attacks are connecting with
// their targets. Also handles parry detection.
// ──────────────────────────────────────────
function checkAttacks() {
  // ── Player attacking enemies ──
  const pAtk = player.getAttackBox();
  // Attacks only connect on a specific frame of the animation
  // (punch hits on frame 12 of its timer, kick on frame 16)
  if (pAtk && player.attackTimer === (player.punching ? 12 : 16)) {
    enemies.forEach(e => {
      if (e.dead) return;
      const hBox = e.getHurtBox();
      if (boxOverlap(pAtk, hBox)) {
        // Calculate damage: kicks do 1.3x, heavy attacks do 3x on top
        let dmg = player.kicking ? player.damage * 1.3 : player.damage;
        if (player.isHeavyAttack) dmg *= HEAVY_DAMAGE_MULT;
        e.takeDamage(Math.round(dmg), player.x, player.isHeavyAttack, player.punching);
      }
    });
  }

  // ── Enemies attacking player ──
  enemies.forEach(e => {
    if (e.dead) return;
    const eAtk = e.getAttackBox();
    const hitFrame = e.punching ? 12 : 16;

    if (eAtk && e.attackTimer === hitFrame) {
      const hBox = player.getHurtBox();
      if (boxOverlap(eAtk, hBox)) {
        // ── Parry check ──
        // If the player is in their parry window when the attack connects,
        // instead of taking damage, they grab and slam the attacker
        if (player.parrying && player.parryTimer > 0) {
          performSlam(player, e, e.punching);
          return; // Skip normal damage
        }

        // Normal hit
        let dmg = e.kicking ? e.damage * 1.3 : e.damage;
        if (e.isHeavyAttack) dmg *= HEAVY_DAMAGE_MULT;
        player.takeDamage(Math.round(dmg), e.x, e.isHeavyAttack, e.punching);
      }
    }
  });
}

// ──────────────────────────────────────────
// PERFORM SLAM (Parry Success)
// Called when a parry successfully catches
// an incoming attack. The parrier grabs the
// attacker and slams them into the ground.
// ──────────────────────────────────────────
/**
 * @param {Fighter} parrier      - The fighter who parried (always the player)
 * @param {Fighter} attacker     - The enemy whose attack was caught
 * @param {boolean} caughtPunch  - true if a punch was caught, false for kick
 */
function performSlam(parrier, attacker, caughtPunch) {
  // Put the parrier into slam animation
  parrier.parrying = false;
  parrier.parryTimer = 0;
  parrier.slamming = true;
  parrier.slamTimer = 30; // 30 frames = 0.5 seconds
  parrier.slamTarget = attacker;
  parrier.slamCaughtPunch = caughtPunch;

  // Cancel the attacker's attack and start their "being slammed" animation
  attacker.punching = false;
  attacker.kicking = false;
  attacker.attackTimer = 0;
  attacker.beingSlammed = true;
  attacker.slamAnimTimer = 30;
  attacker.slammedFromX = parrier.x; // Used for knockback direction

  // Show what happened
  messageText = caughtPunch ? 'PARRY! Caught the fist!' : 'PARRY! Caught the foot!';
  messageTimer = 60;

  // Yellow particles burst on the catch
  for (let i = 0; i < 12; i++) {
    particles.push(new Particle(attacker.x, attacker.y - 35, '#ffff00'));
  }
  // Note: The actual damage (PARRY_SLAM_DAMAGE) is applied in Fighter.update()
  // when the beingSlammed animation timer reaches 0
}

// ──────────────────────────────────────────
// STATE TRANSITION TRACKING
// These prevent a single key press from
// triggering multiple state transitions
// ──────────────────────────────────────────
let enterPressed = false;
let escPressed = false;

// ──────────────────────────────────────────
// UPDATE (called once per frame)
// Handles state transitions, updates all
// game objects, checks combat, cleans up
// ──────────────────────────────────────────
function update() {
  // ── Handle ENTER key for menu/screen transitions ──
  if (keys['enter'] && !enterPressed) {
    enterPressed = true;

    if (gameState === 'menu') {
      // Start a new game from level 1
      currentLevel = 1;
      player = new Fighter(200, GROUND, true, { maxHP: 100, speed: 4, damage: 12 });
      startLevel(currentLevel);

    } else if (gameState === 'levelComplete') {
      // Advance to next level (player gets +5 max HP per level as a reward)
      currentLevel++;
      player.maxHP = 100 + (currentLevel - 1) * 5;
      startLevel(currentLevel);

    } else if (gameState === 'gameOver') {
      // Retry the current level
      startLevel(currentLevel);

    } else if (gameState === 'victory') {
      // Return to menu after beating all levels
      currentLevel = 1;
      player = new Fighter(200, GROUND, true, { maxHP: 100, speed: 4, damage: 12 });
      gameState = 'menu';
    }
  }
  if (!keys['enter']) enterPressed = false;

  // ── Handle ESC key (return to menu from game over) ──
  if (keys['escape'] && !escPressed) {
    escPressed = true;
    if (gameState === 'gameOver') gameState = 'menu';
  }
  if (!keys['escape']) escPressed = false;

  // Only run game logic while fighting
  if (gameState !== 'fighting') return;

  // Wait for level intro to finish before starting combat
  if (levelStartTimer > 0) {
    levelStartTimer--;
    return;
  }

  // ── Update all fighters ──
  player.update(null);                    // Player doesn't need a target (auto-faces nearest)
  enemies.forEach(e => e.update(player)); // Enemies target the player

  // ── Check if any attacks connected ──
  checkAttacks();

  // ── Clear "just pressed" flags at end of frame ──
  // This ensures keyJustPressed is only true for exactly one frame
  for (const k in keyJustPressed) {
    delete keyJustPressed[k];
  }

  // ── Update and remove dead particles ──
  particles.forEach(p => p.update());
  particles = particles.filter(p => p.life > 0);

  // ── Check win/lose conditions ──
  if (player.dead) {
    gameState = 'gameOver';
  } else if (enemies.every(e => e.dead)) {
    // All enemies defeated — check if this was the final level
    gameState = currentLevel >= MAX_LEVEL ? 'victory' : 'levelComplete';
  }
}

// ──────────────────────────────────────────
// DRAW (called once per frame after update)
// Renders everything to the canvas
// ──────────────────────────────────────────
function draw() {
  ctx.save();

  // ── Screen shake effect ──
  // Offsets the entire canvas by random amounts for impact feel
  if (shakeTimer > 0) {
    shakeTimer--;
    ctx.translate(
      (Math.random() - 0.5) * shakeIntensity,
      (Math.random() - 0.5) * shakeIntensity
    );
  }

  // Clear the screen with the background color
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

  // ── Menu screen ──
  if (gameState === 'menu') {
    drawMenu();
    ctx.restore();
    return;
  }

  // ── Game screen ──
  drawGround();

  // Draw all fighters (enemies first so player renders on top)
  enemies.forEach(e => e.draw());
  player.draw();

  // Draw particles (hit effects, block sparks, etc.)
  particles.forEach(p => p.draw());

  // Draw HUD elements (health bars, level indicator, controls)
  drawHUD();
  drawMessage();

  // Draw overlay screens on top of the game
  if (gameState === 'levelComplete') drawLevelComplete();
  if (gameState === 'gameOver') drawGameOver();
  if (gameState === 'victory') drawVictory();

  ctx.restore();
}

// ──────────────────────────────────────────
// GAME LOOP
// Runs update() then draw() every frame
// (approximately 60 times per second)
// ──────────────────────────────────────────
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop); // Schedule the next frame
}

// Start the game!
gameLoop();
