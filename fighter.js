/* ============================================
   FIGHTER CLASS
   Represents both the player and all enemies.
   Handles movement, physics, combat, AI behavior,
   and drawing the stick figure on screen.
   ============================================ */

class Fighter {
  /**
   * @param {number} x       - Starting X position
   * @param {number} y       - Starting Y position
   * @param {boolean} isPlayer - true for the human-controlled fighter
   * @param {object} config  - Stats like maxHP, speed, damage, AI params, color, name
   */
  constructor(x, y, isPlayer, config = {}) {
    // ── Position & Movement ──
    this.x = x;
    this.y = y;
    this.vx = 0;  // Horizontal velocity
    this.vy = 0;  // Vertical velocity (affected by gravity)
    this.isPlayer = isPlayer;
    this.facing = isPlayer ? 1 : -1; // 1 = facing right, -1 = facing left

    // ── Stats ──
    this.maxHP = config.maxHP || 100;
    this.hp = this.maxHP;
    this.speed = config.speed || 3;       // Movement speed in pixels per frame
    this.damage = config.damage || 10;    // Base punch damage (kicks do 1.3x)
    this.color = config.color || (isPlayer ? '#00ff88' : '#ff4444');
    this.name = config.name || (isPlayer ? 'You' : 'Enemy');

    // ── Combat States ──
    this.grounded = false;    // True when standing on the ground
    this.crouching = false;   // True when holding crouch (S key)
    this.punching = false;    // True during a punch animation
    this.kicking = false;     // True during a kick animation
    this.blocking = false;    // True when holding block (spacebar)
    this.hit = false;         // True during hit stun (can't act)
    this.dead = false;        // True when HP reaches 0
    this.attackTimer = 0;     // Counts down during an attack animation
    this.hitTimer = 0;        // Counts down during hit stun
    this.attackCooldown = 0;  // Prevents spamming attacks too fast
    this.isHeavyAttack = false; // True if current attack is a charged heavy

    // ── Heavy Attack Charging ──
    // Hold J or K for 3 seconds to charge a heavy hit (unblockable, 3x damage)
    this.chargingPunch = false;
    this.chargingKick = false;
    this.chargeTime = 0; // How many frames the key has been held

    // ── Parry System ──
    // Press U right before an enemy attack connects to grab and slam them
    this.parryTimer = 0;       // Countdown frames where parry can catch an attack
    this.parrying = false;     // True while in the parry window
    this.slamming = false;     // True while performing the slam throw animation
    this.slamTimer = 0;        // Countdown for slam animation
    this.slamTarget = null;    // Reference to the enemy being slammed
    this.slamCaughtPunch = true; // Whether we caught a punch (true) or kick (false)

    // ── Being Slammed (victim side) ──
    this.beingSlammed = false;  // True while being thrown by a parry
    this.slamAnimTimer = 0;     // Countdown for the being-slammed animation
    this.slammedFromX = 0;      // X position of the parrier (for knockback direction)

    // ── Animation ──
    this.walkFrame = 0;   // Current frame in the walk cycle (0-3)
    this.walkTimer = 0;   // Counter to advance walk frames
    this.idleTimer = 0;   // Continuously incrementing timer for breathing animation

    // ── AI Configuration (enemies only) ──
    this.aiTimer = 0;                                    // Frame counter for AI decisions
    this.aiAction = 'idle';                              // Current AI behavior
    this.aiReactionSpeed = config.aiReactionSpeed || 60; // Frames between decisions (lower = smarter)
    this.aiAggression = config.aiAggression || 0.3;      // Attack probability (0-1)
    this.aiBlockChance = config.aiBlockChance || 0.1;    // Block probability (0-1)
  }

  // ──────────────────────────────────────────
  // HELPER: Find the closest living enemy
  // Used by the player to auto-face opponents
  // ──────────────────────────────────────────
  getClosestEnemy() {
    let closest = null;
    let closestDist = Infinity;
    // Player looks at enemies list; enemies look at the player
    const targets = this.isPlayer ? enemies : [player];
    for (const t of targets) {
      if (t.dead) continue;
      const d = Math.abs(this.x - t.x);
      if (d < closestDist) {
        closestDist = d;
        closest = t;
      }
    }
    return closest;
  }

  // ──────────────────────────────────────────
  // UPDATE: Called once per frame
  // Handles state machines, physics, collisions
  // ──────────────────────────────────────────
  update(target) {
    if (this.dead) return;

    // --- Being slammed: just count down the animation ---
    // When it finishes, apply the parry slam damage directly
    if (this.beingSlammed) {
      this.slamAnimTimer--;
      if (this.slamAnimTimer <= 0) {
        this.beingSlammed = false;
        // Apply slam damage now that animation is done
        this.hp -= PARRY_SLAM_DAMAGE;
        this.hit = true;
        this.hitTimer = 25;
        // Knock the fighter away from whoever slammed them
        this.vx = (this.x > (this.slammedFromX || this.x) ? 1 : -1) * 10;
        this.vy = -6;
        // Screen shake for impact
        shakeTimer = 20;
        shakeIntensity = 8;
        // Burst of orange particles on slam impact
        for (let i = 0; i < 15; i++) {
          particles.push(new Particle(this.x, this.y - 12, '#ffaa00'));
        }
        // Check if slam killed them
        if (this.hp <= 0) {
          this.hp = 0;
          this.dead = true;
          for (let i = 0; i < 20; i++) {
            particles.push(new Particle(this.x, this.y - 35, this.color));
          }
        }
      }
      return; // Skip all other logic while being slammed
    }

    // --- Slamming animation (the player doing the throw) ---
    if (this.slamming) {
      this.slamTimer--;
      if (this.slamTimer <= 0) {
        this.slamming = false;
        this.slamTarget = null;
      }
      return; // Can't act while performing slam
    }

    // --- Player always faces nearest enemy ---
    if (this.isPlayer) {
      const nearest = this.getClosestEnemy();
      if (nearest) this.facing = nearest.x > this.x ? 1 : -1;
      this.handleInput();
    } else {
      this.handleAI(target);
    }

    // --- Physics ---
    this.vy += GRAVITY;    // Apply gravity each frame
    this.x += this.vx;     // Move horizontally
    this.y += this.vy;     // Move vertically

    // --- Ground collision ---
    if (this.y >= GROUND) {
      this.y = GROUND;
      this.vy = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // --- Keep fighter within screen bounds ---
    this.x = Math.max(20, Math.min(canvas.width - 20, this.x));

    // --- Fighter-to-fighter collision ---
    // Grounded fighters push each other apart so they can't overlap.
    // You must jump over enemies to get past them.
    if (this.grounded) {
      const allFighters = [player, ...enemies];
      for (const other of allFighters) {
        if (other === this || other.dead) continue;
        const dist = Math.abs(this.x - other.x);
        const minDist = 32; // Minimum pixel gap between fighters
        if (dist < minDist && other.grounded) {
          // Push both fighters apart equally
          const push = (minDist - dist) / 2;
          if (this.x < other.x) {
            this.x -= push;
            other.x += push;
          } else {
            this.x += push;
            other.x -= push;
          }
          // Re-clamp both to screen bounds after pushing
          this.x = Math.max(20, Math.min(canvas.width - 20, this.x));
          other.x = Math.max(20, Math.min(canvas.width - 20, other.x));
        }
      }
    }

    // --- Timer countdowns ---
    // Attack animation timer: when it hits 0, the attack ends
    if (this.attackTimer > 0) {
      this.attackTimer--;
      if (this.attackTimer === 0) {
        this.punching = false;
        this.kicking = false;
        this.isHeavyAttack = false;
      }
    }
    // Hit stun timer: when it hits 0, the fighter can act again
    if (this.hitTimer > 0) {
      this.hitTimer--;
      if (this.hitTimer === 0) this.hit = false;
    }
    // Attack cooldown: prevents attacking again too quickly
    if (this.attackCooldown > 0) this.attackCooldown--;
    // Parry window timer: when it hits 0, the parry opportunity expires
    if (this.parryTimer > 0) {
      this.parryTimer--;
      if (this.parryTimer === 0) this.parrying = false;
    }

    // --- Walk animation ---
    // Cycle through walk frames when moving on the ground
    if (Math.abs(this.vx) > 0.5 && this.grounded) {
      this.walkTimer++;
      if (this.walkTimer > 8) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }
    } else {
      this.walkFrame = 0;
      this.walkTimer = 0;
    }

    // Breathing animation (subtle idle movement)
    this.idleTimer += 0.05;

    // --- Friction ---
    // Slow fighters down when on the ground so they don't slide forever
    if (this.grounded && !this.isPlayer) {
      this.vx *= 0.85;  // Enemies have slightly less friction
    } else if (this.grounded) {
      this.vx *= 0.8;   // Player stops a bit faster
    }
  }

  // ──────────────────────────────────────────
  // PLAYER INPUT HANDLING
  // Reads keyboard state and sets fighter actions
  // ──────────────────────────────────────────
  handleInput() {
    // Can't do anything while in hit stun
    if (this.hit) return;

    // ── Block (Spacebar) ──
    // Can only block while grounded and not doing other actions.
    // Standing block stops punches; crouch block stops kicks.
    this.blocking = keys[' '] && this.grounded &&
      !this.chargingPunch && !this.chargingKick &&
      !this.punching && !this.kicking && !this.parrying;

    // ── Parry (U key) ──
    // Must be a fresh press (not held). Opens a short window
    // where catching an incoming attack triggers a grab-and-slam.
    if (keyJustPressed['u'] && !this.punching && !this.kicking &&
        !this.chargingPunch && !this.chargingKick && !this.blocking) {
      this.parrying = true;
      this.parryTimer = PARRY_WINDOW;
    }

    // ── Track how long J and K have been held (for heavy attacks) ──
    if (keys['j'] && keyDownTime['j'] !== undefined) keyDownTime['j']++;
    if (keys['k'] && keyDownTime['k'] !== undefined) keyDownTime['k']++;

    // ── Punch / Heavy Punch (J key) ──
    // Tap J for a normal punch. Hold J for 3 seconds for a heavy punch.
    if (keys['j'] && !this.punching && !this.kicking &&
        this.attackCooldown === 0 && !this.parrying) {
      this.chargingPunch = true;
      this.chargingKick = false;
      this.chargeTime = keyDownTime['j'] || 0;

      // Full charge reached — release heavy punch automatically
      if (this.chargeTime >= HEAVY_CHARGE_TIME) {
        this.punching = true;
        this.isHeavyAttack = true;
        this.attackTimer = 20;
        this.attackCooldown = 30;
        this.chargingPunch = false;
        this.chargeTime = 0;
        delete keyDownTime['j'];
        keys['j'] = false;
        // Red particles burst from the fist
        for (let i = 0; i < 6; i++) {
          particles.push(new Particle(this.x + this.facing * 20, this.y - 45, '#ff3333'));
        }
      }
    } else if (!keys['j'] && this.chargingPunch) {
      // Released J before full charge — do a normal punch
      if (this.attackCooldown === 0 && !this.punching && !this.kicking) {
        this.punching = true;
        this.isHeavyAttack = false;
        this.attackTimer = 15;
        this.attackCooldown = 20;
      }
      this.chargingPunch = false;
      this.chargeTime = 0;
    }

    // ── Kick / Heavy Kick (K key) ──
    // Same charge mechanic as punches but with slightly longer animation
    if (keys['k'] && !this.punching && !this.kicking &&
        this.attackCooldown === 0 && !this.chargingPunch && !this.parrying) {
      this.chargingKick = true;
      this.chargingPunch = false;
      this.chargeTime = keyDownTime['k'] || 0;

      if (this.chargeTime >= HEAVY_CHARGE_TIME) {
        this.kicking = true;
        this.isHeavyAttack = true;
        this.attackTimer = 25;
        this.attackCooldown = 35;
        this.chargingKick = false;
        this.chargeTime = 0;
        delete keyDownTime['k'];
        keys['k'] = false;
        for (let i = 0; i < 6; i++) {
          particles.push(new Particle(this.x + this.facing * 20, this.y - 20, '#ff3333'));
        }
      }
    } else if (!keys['k'] && this.chargingKick) {
      if (this.attackCooldown === 0 && !this.punching && !this.kicking) {
        this.kicking = true;
        this.isHeavyAttack = false;
        this.attackTimer = 20;
        this.attackCooldown = 25;
      }
      this.chargingKick = false;
      this.chargeTime = 0;
    }

    // ── Movement (A/D keys) ──
    // Player always faces the nearest enemy (set in update()),
    // so pressing away from the enemy results in a back-shuffle.
    const charging = this.chargingPunch || this.chargingKick;
    if (keys['a'] && !this.crouching && !charging && !this.parrying) {
      this.vx = -this.speed;
    } else if (keys['d'] && !this.crouching && !charging && !this.parrying) {
      this.vx = this.speed;
    }

    // ── Jump (W key) ──
    if (keys['w'] && this.grounded && !this.crouching && !charging && !this.parrying) {
      this.vy = -13;
      this.grounded = false;
    }

    // ── Crouch (S key) ──
    this.crouching = keys['s'] && this.grounded;
  }

  // ──────────────────────────────────────────
  // AI BEHAVIOR (enemies only)
  // Simple decision-making based on distance
  // to the player and random rolls
  // ──────────────────────────────────────────
  handleAI(target) {
    if (!target || target.dead || this.hit) return;

    this.aiTimer++;
    const dist = Math.abs(this.x - target.x);
    const dir = target.x > this.x ? 1 : -1; // Direction toward player
    this.facing = dir; // Always face the player

    // Make a new decision every N frames (based on aiReactionSpeed)
    if (this.aiTimer % Math.max(10, this.aiReactionSpeed) === 0) {
      const r = Math.random();

      if (dist > 140) {
        // Far away: almost always walk toward the player
        this.aiAction = r < 0.9 ? 'approach' : 'jumpAttack';
      } else if (dist < 75) {
        // Close range: mostly attack, sometimes block
        if (r < this.aiAggression * 1.5) {
          this.aiAction = Math.random() < 0.5 ? 'punch' : 'kick';
        } else if (r < this.aiAggression * 1.5 + this.aiBlockChance) {
          this.aiAction = 'crouchBlock';
        } else {
          this.aiAction = 'approach';
        }
      } else {
        // Mid range: mix of approach and attacks
        if (r < 0.6) this.aiAction = 'approach';
        else if (r < 0.6 + this.aiAggression) {
          this.aiAction = Math.random() < 0.5 ? 'punch' : 'kick';
        } else {
          this.aiAction = Math.random() < 0.3 ? 'jumpAttack' : 'approach';
        }
      }
    }

    // Execute the chosen action
    switch (this.aiAction) {
      case 'approach':
        // Walk toward the player
        this.vx = dir * this.speed;
        this.blocking = false;
        this.crouching = false;
        break;

      case 'retreat':
        // Back away from the player
        this.vx = -dir * this.speed * 0.6;
        this.blocking = false;
        this.crouching = false;
        break;

      case 'punch':
        this.blocking = false;
        this.crouching = false;
        if (dist > 75) {
          // Too far to punch — close the gap first
          this.vx = dir * this.speed;
        } else if (this.attackCooldown === 0) {
          // In range and off cooldown — throw a punch
          this.punching = true;
          this.isHeavyAttack = false;
          this.attackTimer = 15;
          this.attackCooldown = 18;
          this.aiAction = 'approach'; // Go back to approaching after
        }
        break;

      case 'kick':
        this.blocking = false;
        this.crouching = false;
        if (dist > 85) {
          this.vx = dir * this.speed;
        } else if (this.attackCooldown === 0) {
          this.kicking = true;
          this.isHeavyAttack = false;
          this.attackTimer = 20;
          this.attackCooldown = 22;
          this.aiAction = 'approach';
        }
        break;

      case 'jumpAttack':
        // Jump toward the player, then punch on landing
        this.blocking = false;
        this.crouching = false;
        if (this.grounded) {
          this.vy = -11;
          this.vx = dir * this.speed;
        }
        this.aiAction = 'punch';
        break;

      case 'crouchBlock':
        // Crouch and block (only crouch block is used by AI since it stops kicks)
        this.blocking = true;
        this.crouching = true;
        // Only block for a short time before going back to fighting
        if (this.aiTimer % 30 === 0) {
          this.aiAction = 'approach';
          this.crouching = false;
          this.blocking = false;
        }
        break;

      default:
        // Idle: drift toward player if far away
        if (dist > 120) this.vx = dir * this.speed * 0.4;
        break;
    }
  }

  // ──────────────────────────────────────────
  // ATTACK HITBOX
  // Returns the rectangle where an active
  // attack can hit opponents, or null if not attacking
  // ──────────────────────────────────────────
  getAttackBox() {
    // Heavy attacks have a larger hitbox
    const heavyBonus = this.isHeavyAttack ? 12 : 0;

    if (this.punching) {
      return {
        x: this.x + this.facing * 25,           // Extends in front of fighter
        y: this.y - (this.crouching ? 30 : 48),  // Higher when standing
        w: 35 + heavyBonus,
        h: 12 + heavyBonus
      };
    }
    if (this.kicking) {
      return {
        x: this.x + this.facing * 20,
        y: this.y - (this.crouching ? 12 : 18), // Kicks hit lower than punches
        w: 40 + heavyBonus,
        h: 14 + heavyBonus
      };
    }
    return null; // Not attacking
  }

  // ──────────────────────────────────────────
  // HURT BOX
  // The rectangle where this fighter can be hit.
  // Smaller when crouching.
  // ──────────────────────────────────────────
  getHurtBox() {
    const h = this.crouching ? 38 : 72;
    return {
      x: this.x - 14,
      y: this.y - h,
      w: 28,
      h: h
    };
  }

  // ──────────────────────────────────────────
  // TAKE DAMAGE
  // Called when an attack connects. Handles
  // blocking logic, HP reduction, knockback,
  // screen shake, particles, and death.
  // ──────────────────────────────────────────
  takeDamage(amount, fromX, isHeavy, isPunch) {
    // Can't be hit again while already in hit stun or being slammed
    if (this.hit || this.beingSlammed) return;

    // ── Block Check ──
    // Heavy hits go through ALL blocks.
    // Standing block only stops punches (kicks go through).
    // Crouching block only stops kicks (punches go through).
    if (this.blocking && !isHeavy) {
      if (this.crouching && !isPunch) {
        // Crouching + block + incoming kick = BLOCKED
        for (let i = 0; i < 4; i++) {
          particles.push(new Particle(this.x, this.y - 20, '#4488ff'));
        }
        return; // No damage taken
      } else if (!this.crouching && isPunch) {
        // Standing + block + incoming punch = BLOCKED
        for (let i = 0; i < 4; i++) {
          particles.push(new Particle(this.x, this.y - 40, '#4488ff'));
        }
        return;
      }
      // If standing and kicked, or crouching and punched: block fails, damage goes through
    }

    // ── Apply Damage ──
    this.hp -= amount;
    this.hit = true;
    this.hitTimer = isHeavy ? 25 : 15; // Heavy hits stun longer

    // Knockback: push away from the attacker
    this.vx = (this.x > fromX ? 1 : -1) * (isHeavy ? 10 : 5);
    this.vy = isHeavy ? -6 : -3; // Pop up slightly

    // Screen shake proportional to damage
    shakeTimer = isHeavy ? 15 : 8;
    shakeIntensity = isHeavy ? amount / 2 : amount / 3;

    // Hit particles (red for heavy, fighter color for normal)
    const pCount = isHeavy ? 15 : 8;
    for (let i = 0; i < pCount; i++) {
      particles.push(new Particle(this.x, this.y - 35, isHeavy ? '#ff0000' : this.color));
    }

    // ── Death Check ──
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      // Death explosion particles
      for (let i = 0; i < 20; i++) {
        particles.push(new Particle(this.x, this.y - 35, this.color));
      }
    }
  }

  // ──────────────────────────────────────────
  // DRAW: Render the stick figure on screen
  // Uses canvas line drawing for all body parts
  // ──────────────────────────────────────────
  draw() {
    if (this.dead) return;

    ctx.save();
    ctx.translate(this.x, this.y); // Draw relative to fighter position

    // ── Body proportions ──
    const headR = 10;                          // Head radius
    const bodyLen = this.crouching ? 22 : 40;  // Torso length (shorter when crouching)
    const armLen = 20;                         // Arm length
    const legLen = 24;                         // Leg length

    // ── Color selection ──
    // White flash when hit, blue when blocking, yellow when parrying
    const col = this.hit && this.hitTimer % 4 < 2 ? '#ffffff' : this.color;
    const drawCol = this.blocking ? '#4488ff' : (this.parrying ? '#ffff00' : col);

    ctx.strokeStyle = drawCol;
    ctx.fillStyle = drawCol;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    // Head Y position sits on top of the body
    const headY = -bodyLen - headR - 2;
    // Subtle breathing movement
    const breathOffset = Math.sin(this.idleTimer) * 1.2;

    // ════════════════════════════════════════
    // SLAM ANIMATION (player performing the throw)
    // ════════════════════════════════════════
    if (this.slamming && this.slamTarget) {
      const progress = 1 - (this.slamTimer / 30); // 0 to 1 over 30 frames
      // Head
      ctx.beginPath(); ctx.arc(0, headY + breathOffset, headR, 0, Math.PI * 2); ctx.stroke();
      ctx.fillRect(this.facing * 3 - 1, headY - 2 + breathOffset, 3, 3); // Eye
      // Body
      ctx.beginPath(); ctx.moveTo(0, -bodyLen + breathOffset); ctx.lineTo(0, 0); ctx.stroke();
      // Grabbing arm arcs overhead as the slam progresses
      const grabAngle = -Math.PI * 0.3 + progress * Math.PI * 1.0;
      const handX = this.facing * Math.cos(grabAngle) * (armLen + 5);
      const handY = -bodyLen + 10 + Math.sin(grabAngle) * (armLen + 5) + breathOffset;
      ctx.beginPath(); ctx.moveTo(0, -bodyLen + 10 + breathOffset); ctx.lineTo(handX, handY); ctx.stroke();
      // Other arm hangs
      ctx.beginPath(); ctx.moveTo(0, -bodyLen + 10 + breathOffset); ctx.lineTo(-this.facing * 10, -bodyLen + 22 + breathOffset); ctx.stroke();
      // Wide stance legs
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-10, legLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, legLen); ctx.stroke();
      ctx.restore();
      return;
    }

    // ════════════════════════════════════════
    // BEING SLAMMED ANIMATION (victim spinning)
    // ════════════════════════════════════════
    if (this.beingSlammed) {
      const progress = 1 - (this.slamAnimTimer / 30);
      // Rotate the entire body as they get flipped through the air
      ctx.rotate(progress * Math.PI * 1.5);
      // Draw a limp ragdoll body
      ctx.beginPath(); ctx.arc(0, headY, headR, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -bodyLen); ctx.lineTo(0, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -bodyLen + 10); ctx.lineTo(-8, -bodyLen + 25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -bodyLen + 10); ctx.lineTo(8, -bodyLen + 25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, legLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, legLen); ctx.stroke();
      ctx.restore();
      return;
    }

    // ════════════════════════════════════════
    // NORMAL DRAWING
    // ════════════════════════════════════════

    // ── Head ──
    ctx.beginPath();
    ctx.arc(0, headY + breathOffset, headR, 0, Math.PI * 2);
    ctx.stroke();

    // ── Eye (small square dot facing the direction of movement) ──
    ctx.fillStyle = drawCol;
    ctx.fillRect(this.facing * 4 - 1, headY - 2 + breathOffset, 3, 3);

    // ── Body (vertical line from neck to hips) ──
    ctx.beginPath();
    ctx.moveTo(0, -bodyLen + breathOffset);
    ctx.lineTo(0, 0);
    ctx.stroke();

    // ── Arms ──
    const shoulderY = -bodyLen + 10 + breathOffset; // Where arms attach

    if (this.blocking && !this.punching && !this.kicking) {
      // BLOCKING POSE: arms crossed in front for protection
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(this.facing * 8, shoulderY - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(this.facing * 12, shoulderY - 5); ctx.stroke();

    } else if (this.parrying && !this.punching && !this.kicking) {
      // PARRY STANCE: arms extended forward, ready to grab
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(this.facing * (armLen - 2), shoulderY - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(this.facing * (armLen - 4), shoulderY + 4); ctx.stroke();

    } else if (this.punching && this.attackTimer > 5) {
      // PUNCH: one arm fully extended with fist, other arm pulled back
      const fistX = this.facing * (armLen + 12);
      const fistY = shoulderY - 2;
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(fistX, fistY); ctx.stroke();
      // Fist circle (bigger and red for heavy attacks)
      ctx.fillStyle = this.isHeavyAttack ? '#ff0000' : drawCol;
      ctx.beginPath(); ctx.arc(fistX + this.facing * 2, fistY, this.isHeavyAttack ? 7 : 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = drawCol;
      // Trailing arm
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(-this.facing * armLen * 0.5, shoulderY + 10); ctx.stroke();

    } else if (this.chargingPunch) {
      // CHARGING PUNCH: arm pulled back with growing red energy ball on fist
      const chargeProgress = Math.min(this.chargeTime / HEAVY_CHARGE_TIME, 1);
      const ballRadius = 3 + chargeProgress * 12; // Ball grows as charge fills
      const fistX = -this.facing * (armLen * 0.7);
      const fistY = shoulderY - 5;
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(fistX, fistY); ctx.stroke();
      // Three-layer glowing ball: outer glow, inner ball, bright core
      ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + chargeProgress * 0.3})`;
      ctx.beginPath(); ctx.arc(fistX, fistY, ballRadius + 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, ${Math.floor(50 - chargeProgress * 50)}, 0, ${0.5 + chargeProgress * 0.5})`;
      ctx.beginPath(); ctx.arc(fistX, fistY, ballRadius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 255, ${Math.floor(200 - chargeProgress * 200)}, ${chargeProgress})`;
      ctx.beginPath(); ctx.arc(fistX, fistY, ballRadius * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = drawCol;
      // Guard arm
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(this.facing * armLen * 0.4, shoulderY + 8); ctx.stroke();

    } else if (this.chargingKick) {
      // CHARGING KICK: normal arm pose (the red ball is on the foot, drawn in legs section)
      const armSwing = this.grounded ? Math.sin(this.walkFrame * 1.5) * 6 : 0;
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(-this.facing * armLen * 0.6, shoulderY + 12 + armSwing); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(this.facing * armLen * 0.6, shoulderY + 12 - armSwing); ctx.stroke();

    } else {
      // IDLE / WALKING: arms swing opposite to legs
      const armSwing = this.grounded ? Math.sin(this.walkFrame * 1.5) * 6 : 0;
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(-this.facing * armLen * 0.6, shoulderY + 12 + armSwing); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, shoulderY); ctx.lineTo(this.facing * armLen * 0.6, shoulderY + 12 - armSwing); ctx.stroke();
    }

    // ── Legs ──
    if (this.kicking && this.attackTimer > 5) {
      // KICK: one leg extended forward with foot circle
      const footX = this.facing * (legLen + 12);
      const footY = -10;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(footX, footY); ctx.stroke();
      ctx.fillStyle = this.isHeavyAttack ? '#ff0000' : drawCol;
      ctx.beginPath(); ctx.arc(footX + this.facing * 2, footY, this.isHeavyAttack ? 7 : 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = drawCol;
      // Standing leg
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-this.facing * 8, legLen * 0.6); ctx.stroke();

    } else if (this.chargingKick) {
      // CHARGING KICK: leg pulled back with growing red energy ball on foot
      const chargeProgress = Math.min(this.chargeTime / HEAVY_CHARGE_TIME, 1);
      const ballRadius = 3 + chargeProgress * 12;
      const footX = -this.facing * 14;
      const footY = legLen * 0.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(footX, footY); ctx.stroke();
      // Three-layer glowing ball on foot
      ctx.fillStyle = `rgba(255, 0, 0, ${0.2 + chargeProgress * 0.3})`;
      ctx.beginPath(); ctx.arc(footX, footY, ballRadius + 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, ${Math.floor(50 - chargeProgress * 50)}, 0, ${0.5 + chargeProgress * 0.5})`;
      ctx.beginPath(); ctx.arc(footX, footY, ballRadius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 255, ${Math.floor(200 - chargeProgress * 200)}, ${chargeProgress})`;
      ctx.beginPath(); ctx.arc(footX, footY, ballRadius * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = drawCol;
      // Standing leg
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, legLen); ctx.stroke();

    } else if (this.crouching) {
      // CROUCHING: legs bent outward
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, legLen * 0.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, legLen * 0.4); ctx.stroke();

    } else if (!this.grounded) {
      // JUMPING: legs tucked at different angles
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, legLen * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, legLen * 0.5); ctx.stroke();

    } else {
      // WALKING / IDLE: legs swing back and forth
      const legSwing = Math.sin(this.walkFrame * 1.5) * 10;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5 + legSwing, legLen); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(5 - legSwing, legLen); ctx.stroke();
    }

    ctx.restore();
  }
}
