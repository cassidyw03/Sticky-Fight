/* ============================================
   UI & DRAWING FUNCTIONS
   Everything that gets drawn on screen:
   - Ground/arena
   - Health bars and HUD
   - Menu screens (title, game over, victory)
   - The jump kick logo
   - In-game messages
   ============================================ */

// ──────────────────────────────────────────
// GROUND
// Draws the floor line and subtle detail marks
// ──────────────────────────────────────────
function drawGround() {
  // Main ground line
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND + 24);
  ctx.lineTo(canvas.width, GROUND + 24);
  ctx.stroke();

  // Small dashes along the ground for texture
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, GROUND + 26);
    ctx.lineTo(i + 20, GROUND + 26);
    ctx.stroke();
  }
}

// ──────────────────────────────────────────
// HEALTH BAR
// Reusable function to draw a labeled health
// bar at any position. Used for both the
// player and all enemies.
// ──────────────────────────────────────────
/**
 * @param {number} x      - Left edge X position
 * @param {number} y      - Top edge Y position
 * @param {number} w      - Width of the bar
 * @param {number} h      - Height of the bar
 * @param {number} hp     - Current health points
 * @param {number} maxHP  - Maximum health points
 * @param {string} color  - Bar color when above 50% HP
 * @param {string} name   - Label displayed above the bar
 */
function drawHealthBar(x, y, w, h, hp, maxHP, color, name) {
  // Dark background
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, w, h);

  // Colored fill — changes color as HP drops:
  // Green/custom > 50%, yellow 25-50%, red < 25%
  const ratio = hp / maxHP;
  ctx.fillStyle = ratio > 0.5 ? color : ratio > 0.25 ? '#ffaa00' : '#ff3333';
  ctx.fillRect(x + 1, y + 1, (w - 2) * ratio, h - 2);

  // Border
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Fighter name above the bar
  ctx.fillStyle = '#fff';
  ctx.font = '12px monospace';
  ctx.fillText(name, x, y - 4);

  // HP numbers centered inside the bar (e.g. "85/100")
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${hp}/${maxHP}`, x + w / 2, y + h - 3);
  ctx.textAlign = 'left';
}

// ──────────────────────────────────────────
// HUD (Heads-Up Display)
// Shows health bars, level info, status
// indicators, and control hints during gameplay
// ──────────────────────────────────────────
function drawHUD() {
  // Player health bar (top-left corner)
  drawHealthBar(20, 20, 220, 20, player.hp, player.maxHP, '#00ff88', 'You');

  // Enemy health bars (top-right corner, stacked vertically)
  enemies.forEach((e, i) => {
    if (!e.dead) {
      drawHealthBar(canvas.width - 240, 20 + i * 32, 220, 20, e.hp, e.maxHP, e.color, e.name);
    }
  });

  // Current level indicator (top-center)
  ctx.fillStyle = '#888';
  ctx.font = '15px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Level ${currentLevel} / ${MAX_LEVEL}`, canvas.width / 2, 22);
  ctx.textAlign = 'left';

  // Block status indicator (shows what type of block is active)
  if (player.blocking) {
    ctx.fillStyle = '#4488ff';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(
      player.crouching ? 'CROUCH BLOCK (stops kicks)' : 'STAND BLOCK (stops punches)',
      20, 60
    );
  }

  // Parry status indicator
  if (player.parrying) {
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('PARRY READY', 20, 60);
  }

  // Heavy attack charge bar (fills up as you hold J or K)
  if (player.chargingPunch || player.chargingKick) {
    const progress = Math.min(player.chargeTime / HEAVY_CHARGE_TIME, 1);
    // Bar background
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 68, 110, 10);
    // Fill color transitions from yellow to red as charge builds
    ctx.fillStyle = `rgb(255, ${Math.floor(255 - progress * 255)}, 0)`;
    ctx.fillRect(20, 68, 110 * progress, 10);
    // Bar border
    ctx.strokeStyle = '#666';
    ctx.strokeRect(20, 68, 110, 10);
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.fillText('HEAVY CHARGE', 20, 66);
  }

  // Controls reminder at the bottom of the screen
  ctx.fillStyle = '#444';
  ctx.font = '10px monospace';
  ctx.fillText(
    'WASD: Move/Jump/Crouch | J: Punch | K: Kick | SPACE: Block | U: Parry | Hold J/K: Heavy',
    20, canvas.height - 12
  );
}

// ──────────────────────────────────────────
// IN-GAME MESSAGES
// Fading text shown for level names,
// parry announcements, etc.
// ──────────────────────────────────────────
function drawMessage() {
  if (messageTimer > 0) {
    messageTimer--;
    // Fade out over the last 20 frames
    ctx.globalAlpha = messageTimer > 20 ? 1 : messageTimer / 20;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(messageText, canvas.width / 2, canvas.height / 2 - 70);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

// ──────────────────────────────────────────
// JUMP KICK LOGO
// A stick figure in a flying jump kick pose,
// used as the logo on the title screen
// ──────────────────────────────────────────
/**
 * @param {number} x     - Center X position
 * @param {number} y     - Center Y position
 * @param {number} scale - Size multiplier (1.0 = normal)
 * @param {string} color - Color for the stick figure
 */
function drawJumpKickLogo(x, y, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.5 * scale;
  ctx.lineCap = 'round';

  const s = scale;

  // Head
  ctx.beginPath();
  ctx.arc(0, -50 * s, 10 * s, 0, Math.PI * 2);
  ctx.stroke();

  // Fierce eye
  ctx.fillRect(3 * s, -52 * s, 3 * s, 3 * s);

  // Body — leaning forward for momentum
  ctx.beginPath();
  ctx.moveTo(0, -40 * s);
  ctx.lineTo(-5 * s, -5 * s);
  ctx.stroke();

  // Back arm — pulled back behind the body
  ctx.beginPath();
  ctx.moveTo(-3 * s, -32 * s);
  ctx.lineTo(-22 * s, -20 * s);
  ctx.stroke();

  // Front arm — punching forward
  ctx.beginPath();
  ctx.moveTo(-2 * s, -32 * s);
  ctx.lineTo(20 * s, -35 * s);
  ctx.stroke();

  // Fist on the punching arm
  ctx.beginPath();
  ctx.arc(22 * s, -35 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();

  // Back leg — trailing upward behind
  ctx.beginPath();
  ctx.moveTo(-5 * s, -5 * s);
  ctx.lineTo(-25 * s, -15 * s);
  ctx.stroke();

  // Front leg — extended in a flying kick
  ctx.beginPath();
  ctx.moveTo(-5 * s, -5 * s);
  ctx.lineTo(30 * s, 5 * s);
  ctx.stroke();

  // Foot on the kicking leg
  ctx.beginPath();
  ctx.arc(32 * s, 5 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ──────────────────────────────────────────
// TITLE SCREEN / MAIN MENU
// Shown when the game first loads and after
// pressing ESC from the game over screen
// ──────────────────────────────────────────
function drawMenu() {
  // Dark background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Game title
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 56px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STICKY FIGHT', canvas.width / 2, 130);

  // Creator credit
  ctx.fillStyle = '#887744';
  ctx.font = 'italic 18px monospace';
  ctx.fillText('Created by Reece and Cass', canvas.width / 2, 165);

  // Jump kick stick figure logo
  drawJumpKickLogo(canvas.width / 2, 300, 1.8, '#00ff88');

  // Start prompt
  ctx.fillStyle = '#aaa';
  ctx.font = '17px monospace';
  ctx.fillText('Press ENTER to start', canvas.width / 2, 440);

  // Controls guide
  ctx.font = '13px monospace';
  ctx.fillStyle = '#666';
  ctx.fillText('WASD - Move / Jump / Crouch', canvas.width / 2, 485);
  ctx.fillText('J - Punch  |  K - Kick  |  SPACE - Block', canvas.width / 2, 510);
  ctx.fillText('U - Parry (time it to grab & slam!)', canvas.width / 2, 535);
  ctx.fillText('Hold J or K for 3s - HEAVY HIT (unblockable!)', canvas.width / 2, 560);
  ctx.fillText('Stand Block = stops punches | Crouch Block = stops kicks', canvas.width / 2, 585);
  ctx.fillText('Kicks go through standing block!', canvas.width / 2, 610);
  ctx.textAlign = 'left';
}

// ──────────────────────────────────────────
// LEVEL COMPLETE OVERLAY
// Shown after defeating all enemies in a level
// ──────────────────────────────────────────
function drawLevelComplete() {
  // Semi-transparent dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, canvas.height / 2 - 30);

  ctx.fillStyle = '#aaa';
  ctx.font = '20px monospace';
  ctx.fillText(`Level ${currentLevel} cleared!`, canvas.width / 2, canvas.height / 2 + 15);
  ctx.fillText('Press ENTER for next level', canvas.width / 2, canvas.height / 2 + 55);
  ctx.textAlign = 'left';
}

// ──────────────────────────────────────────
// GAME OVER OVERLAY
// Shown when the player's HP reaches 0
// ──────────────────────────────────────────
function drawGameOver() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ff3333';
  ctx.font = 'bold 44px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DEFEATED', canvas.width / 2, canvas.height / 2 - 30);

  ctx.fillStyle = '#aaa';
  ctx.font = '20px monospace';
  ctx.fillText(`Fell on Level ${currentLevel}`, canvas.width / 2, canvas.height / 2 + 15);
  ctx.fillText('Press ENTER to retry', canvas.width / 2, canvas.height / 2 + 55);
  ctx.fillText('Press ESC for menu', canvas.width / 2, canvas.height / 2 + 90);
  ctx.textAlign = 'left';
}

// ──────────────────────────────────────────
// VICTORY OVERLAY
// Shown after beating all 10 levels
// ──────────────────────────────────────────
function drawVictory() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffaa00';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CHAMPION!', canvas.width / 2, canvas.height / 2 - 40);

  ctx.fillStyle = '#00ff88';
  ctx.font = '24px monospace';
  ctx.fillText('You defeated all 10 levels!', canvas.width / 2, canvas.height / 2 + 15);

  ctx.fillStyle = '#aaa';
  ctx.font = '18px monospace';
  ctx.fillText('Press ENTER to play again', canvas.width / 2, canvas.height / 2 + 65);
  ctx.textAlign = 'left';
}
