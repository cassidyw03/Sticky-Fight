/* ============================================
   PARTICLE CLASS
   Creates small colored squares that fly outward
   and fade away. Used for hit effects, block
   sparks, parry flashes, and death explosions.
   ============================================ */

class Particle {
  /**
   * @param {number} x - Starting X position (world coordinates)
   * @param {number} y - Starting Y position (world coordinates)
   * @param {string} color - CSS color string for the particle
   */
  constructor(x, y, color) {
    this.x = x;
    this.y = y;

    // Random velocity so particles scatter in all directions
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8;

    // How many frames this particle will live before disappearing
    this.life = 20 + Math.random() * 15;
    this.maxLife = this.life; // Store original life for fade calculation

    this.color = color;

    // Random size between 2-5 pixels for visual variety
    this.size = 2 + Math.random() * 3;
  }

  /** Move the particle and apply gravity. Called once per frame. */
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.2; // Light gravity so particles arc downward
    this.life--;
  }

  /** Draw the particle as a fading square on the canvas. */
  draw() {
    // Fade out as life decreases (1.0 = fully visible, 0.0 = invisible)
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(
      this.x - this.size / 2,
      this.y - this.size / 2,
      this.size,
      this.size
    );
    // Reset alpha so other draw calls aren't affected
    ctx.globalAlpha = 1;
  }
}
