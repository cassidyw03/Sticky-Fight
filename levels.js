/* ============================================
   LEVEL CONFIGURATION
   Defines enemy stats for each of the 10 levels.
   Difficulty ramps up through faster reactions,
   higher aggression, more HP, and more enemies.
   ============================================ */

/**
 * Returns the configuration for a given level number.
 * Each level has a display name and an array of enemy configs.
 *
 * Enemy config properties:
 *   maxHP           - How much health the enemy has
 *   speed           - Movement speed (pixels per frame)
 *   damage          - Base damage per hit (kicks do 1.3x this)
 *   aiReactionSpeed - Frames between AI decisions (lower = faster reactions)
 *   aiAggression    - Probability of choosing to attack (0-1, higher = more aggressive)
 *   aiBlockChance   - Probability of choosing to block (0-1)
 *   color           - CSS color for the stick figure
 *   name            - Display name shown on the health bar
 */
function getLevelConfig(level) {
  const configs = {

    // Level 1: A slow, weak opponent to learn the controls
    1: {
      name: 'Training Dummy',
      enemies: [{
        maxHP: 50, speed: 1.5, damage: 5,
        aiReactionSpeed: 40, aiAggression: 0.3, aiBlockChance: 0.0,
        color: '#888888', name: 'Dummy'
      }]
    },

    // Level 2: Slightly faster and hits harder
    2: {
      name: 'Street Thug',
      enemies: [{
        maxHP: 70, speed: 2.5, damage: 8,
        aiReactionSpeed: 30, aiAggression: 0.45, aiBlockChance: 0.05,
        color: '#cc6633', name: 'Thug'
      }]
    },

    // Level 3: First multi-enemy fight — two brawlers at once
    3: {
      name: 'Brawler Duo',
      enemies: [
        {
          maxHP: 60, speed: 2.5, damage: 7,
          aiReactionSpeed: 25, aiAggression: 0.5, aiBlockChance: 0.05,
          color: '#cc3333', name: 'Brawler A'
        },
        {
          maxHP: 60, speed: 2.5, damage: 7,
          aiReactionSpeed: 30, aiAggression: 0.45, aiBlockChance: 0.05,
          color: '#cc5555', name: 'Brawler B'
        }
      ]
    },

    // Level 4: Very fast enemy that reacts quickly
    4: {
      name: 'Quick Fighter',
      enemies: [{
        maxHP: 80, speed: 4, damage: 10,
        aiReactionSpeed: 20, aiAggression: 0.55, aiBlockChance: 0.1,
        color: '#ffaa00', name: 'Speedster'
      }]
    },

    // Level 5: Slow but extremely tanky with high damage
    5: {
      name: 'Heavy Hitter',
      enemies: [{
        maxHP: 150, speed: 2, damage: 18,
        aiReactionSpeed: 25, aiAggression: 0.5, aiBlockChance: 0.15,
        color: '#8844aa', name: 'Bruiser'
      }]
    },

    // Level 6: Two fast, aggressive identical fighters
    6: {
      name: 'The Twins',
      enemies: [
        {
          maxHP: 80, speed: 3.5, damage: 10,
          aiReactionSpeed: 18, aiAggression: 0.55, aiBlockChance: 0.1,
          color: '#44aaff', name: 'Twin A'
        },
        {
          maxHP: 80, speed: 3.5, damage: 10,
          aiReactionSpeed: 18, aiAggression: 0.55, aiBlockChance: 0.1,
          color: '#4488ff', name: 'Twin B'
        }
      ]
    },

    // Level 7: Extremely fast reactions and high aggression
    7: {
      name: 'Ninja',
      enemies: [{
        maxHP: 90, speed: 4.5, damage: 14,
        aiReactionSpeed: 15, aiAggression: 0.6, aiBlockChance: 0.2,
        color: '#333366', name: 'Ninja'
      }]
    },

    // Level 8: Three enemies rushing you at once
    8: {
      name: 'Gang Rush',
      enemies: [
        {
          maxHP: 55, speed: 3, damage: 8,
          aiReactionSpeed: 20, aiAggression: 0.55, aiBlockChance: 0.05,
          color: '#ff3366', name: 'Gang 1'
        },
        {
          maxHP: 55, speed: 3, damage: 8,
          aiReactionSpeed: 22, aiAggression: 0.5, aiBlockChance: 0.05,
          color: '#ff5588', name: 'Gang 2'
        },
        {
          maxHP: 55, speed: 3, damage: 8,
          aiReactionSpeed: 25, aiAggression: 0.5, aiBlockChance: 0.05,
          color: '#ff77aa', name: 'Gang 3'
        }
      ]
    },

    // Level 9: Near-instant reactions, very aggressive, blocks often
    9: {
      name: 'Shadow Master',
      enemies: [{
        maxHP: 130, speed: 4, damage: 16,
        aiReactionSpeed: 12, aiAggression: 0.65, aiBlockChance: 0.25,
        color: '#220033', name: 'Shadow'
      }]
    },

    // Level 10: The final boss — highest HP, damage, and skill
    10: {
      name: 'Final Boss',
      enemies: [{
        maxHP: 200, speed: 3.5, damage: 20,
        aiReactionSpeed: 10, aiAggression: 0.7, aiBlockChance: 0.3,
        color: '#ff0000', name: 'Champion'
      }]
    }
  };

  return configs[level];
}
