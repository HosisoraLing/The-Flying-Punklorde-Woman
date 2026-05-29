// Boss battle tuning constants
const DIALOGUE_CHAR_INTERVAL = 50; // ms per typewriter character
const BOSS_VICTORY_PARTICLES = 40;
const PUPPET_VICTORY_PARTICLES = 12;
const BULLET_HIT_PARTICLES = 4;
const LASER_HIT_PARTICLES = 2;
const POWERUP_COLLECT_PARTICLES = 8;
const BULLET_TRACKING_STRENGTH = 0.35;
const BULLET_MAX_SPEED = 12;
const LASER_BEAM_HIT_INTERVAL = 100; // ms between laser damage ticks
const LASER_BEAM_DAMAGE = 3;
const BULLET_DAMAGE_NORMAL = 2;
const BULLET_DAMAGE_SPLIT = 1;
const BULLET_DAMAGE_LASER = 5;

function resetDialogueState() {
  bossDialogueIndex = 0;
  bossDialogueLineIndex = 0;
  bossDialogueCharTimer = 0;
  bossDialogueFullText = '';
  bossDialogueDisplayedText = '';
  bossDialogueAdvanceReady = false;
}

function triggerBossVictory() {
  boss.hp = 0;
  bossPhase = 'victory';
  resetDialogueState();
  bossProjectiles = [];
  puppets = [];
  laserWarnings = [];
  // Victory particles explosion
  for (let k = 0; k < BOSS_VICTORY_PARTICLES; k++) {
    const angle = (k / BOSS_VICTORY_PARTICLES) * Math.PI * 2;
    particles.push({
      x: boss.x, y: boss.y,
      vx: Math.cos(angle) * (2 + Math.random() * 3),
      vy: Math.sin(angle) * (2 + Math.random() * 3),
      size: 6 + Math.random() * 6,
      life: 1,
      decay: 0.008 + Math.random() * 0.008,
      color: `hsl(${Math.random() * 60 + 300}, 100%, 70%)`,
    });
  }
  scoreSound();
}

function updateDialogueTypewriter(dt, lines) {
  const fullLine = lines[bossDialogueLineIndex] || '';
  if (bossDialogueFullText !== fullLine) {
    bossDialogueFullText = fullLine;
    bossDialogueDisplayedText = '';
    bossDialogueCharTimer = 0;
    bossDialogueAdvanceReady = false;
  }
  bossDialogueCharTimer += dt;
  const charsToShow = Math.floor(bossDialogueCharTimer / DIALOGUE_CHAR_INTERVAL);
  if (charsToShow >= fullLine.length) {
    bossDialogueDisplayedText = fullLine;
    bossDialogueAdvanceReady = true;
  } else {
    bossDialogueDisplayedText = fullLine.substring(0, charsToShow);
  }
}

// ===== Boss Battle Update =====
function updateBoss(dt, dtFactor) {
  if (bossPhase === 'none') return;

  // WARNING phase — show banner, move bird to center, boss descends
  if (bossPhase === 'warning') {
    bossWarningTimer += dt;
    // Smoothly move bird to center
    const targetY = H / 2;
    bird.y += (targetY - bird.y) * 0.08 * dtFactor;
    bird.vy = 0;
    bird.rotation = 0;
    if (bossWarningTimer >= 3000) {
      bossPhase = 'clearing';
      bird.y = H / 2;
    }
    return;
  }

  // Clearing phase — wait for all pipes to leave screen, lock bird
  if (bossPhase === 'clearing') {
    bird.y = H / 2;
    bird.vy = 0;
    bird.rotation = 0;
    if (pipes.length === 0) {
      bossPhase = 'dialogue';
      resetDialogueState();
      // Initialize boss for entrance animation
      bossEntranceY = -BOSS_HEIGHT;
      bossEntranceDone = false;
    }
    return;
  }

  // Dialogue phase
  if (bossPhase === 'dialogue') {
    if (!bossDialogue) return; // wait for JSON load
    const scenes = bossDialogue.scenes;
    if (bossDialogueIndex >= scenes.length) {
      // Dialogue done — start fight with entrance animation
      bossPhase = 'fight';
      bossEntranceY = -BOSS_HEIGHT;
      bossEntranceDone = false;
      boss = {
        x: W - BOSS_WIDTH / 2 - 20,
        y: -BOSS_HEIGHT,
        hp: BOSS_MAX_HP,
        maxHp: BOSS_MAX_HP,
        timer: 0,
        attackTimer: 0,
        moveTimer: 0,
        moveDir: 1,
        attackPattern: 0,
      };
      playerBullets = [];
      bossProjectiles = [];
      powerUps = [];
      playerShootTimer = 0;
      powerUpSpawnTimer = 0;
      laserWarnings = [];
      playerHP = Math.min(MAX_HP + tempExtraLives * 2, 10); // temp extra lives add HP, cap at 5 hearts
      maxPlayerHP = playerHP;
      activeEffects = { bulletTime: 0, laserWeapon: 0, bulletSplit: 0, bulletTracking: 0 };
      playerWeapon = 'normal';
      return;
    }
    const scene = scenes[bossDialogueIndex];
    updateDialogueTypewriter(dt, scene.lines);
    return;
  }

  // Advance dialogue (called from click handler)
  // Handled in handleBossDialogueAdvance()

  // Fight phase
  if (bossPhase === 'fight' && boss) {
    const btFactor = activeEffects.bulletTime > 0 ? 0.35 : 1.0;
    boss.timer += dt;
    boss.moveTimer += dt;
    boss.attackTimer += dt * btFactor;

    // Update active effects
    for (let key in activeEffects) {
      if (activeEffects[key] > 0) {
        activeEffects[key] -= dt;
        if (activeEffects[key] <= 0) activeEffects[key] = 0;
      }
    }
    // Sync laser weapon effect
    if (activeEffects.laserWeapon > 0) {
      playerWeapon = 'laser';
    } else {
      playerWeapon = 'normal';
    }

    // Boss entrance animation — descend from top
    if (!bossEntranceDone) {
      boss.y += 2.5 * dtFactor;
      if (boss.y >= H / 2) {
        boss.y = H / 2;
        bossEntranceDone = true;
      }
    } else {
      // Check if boss laser is done
      if (boss.firingLaser) {
        const hasLaser = laserWarnings.some(w => w.ref === boss);
        if (!hasLaser) boss.firingLaser = false;
      }
      // Boss movement — sinusoidal up/down (stop when firing laser)
      if (!boss.firingLaser) {
        const moveSpeed = 2.0 + Math.sin(boss.timer * 0.001) * 0.8;
        boss.y += moveSpeed * boss.moveDir * dtFactor * btFactor;
        if (boss.y < BOSS_HEIGHT / 2 + 60) { boss.y = BOSS_HEIGHT / 2 + 60; boss.moveDir = 1; }
        if (boss.y > H - BOSS_HEIGHT / 2 - 50) { boss.y = H - BOSS_HEIGHT / 2 - 50; boss.moveDir = -1; }
        // Occasionally reverse direction randomly
        if (boss.moveTimer > 1500 + Math.random() * 2000) {
          boss.moveDir *= -1;
          boss.moveTimer = 0;
        }
      }
    }

    // Boss attacks — only fire after entrance done, reduced frequency
    if (!bossEntranceDone) { boss.attackTimer = 0; }
    const attackInterval = 3500;
    if (boss.attackTimer >= attackInterval && bossEntranceDone) {
      boss.attackTimer = 0;
      boss.attackPattern = (boss.attackPattern + 1) % 3;
      if (boss.attackPattern === 0) {
        // Laser beam — first show warning line, then fire
        const warnY = boss.y;
        boss.firingLaser = true;
        laserWarnings.push({ y: warnY, timer: 0, duration: LASER_WARN_DURATION, fired: false, source: 'boss', sourceX: boss.x, sourceY: boss.y, ref: boss, cancelled: false });
        bossLaserWarnSound();
      } else if (boss.attackPattern === 1) {
        // Diamond bullets — aimed at player (slower)
        const dx = bird.x - boss.x;
        const dy = bird.y - boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const spd = 2.0;
        bossProjectiles.push({
          x: boss.x - BOSS_WIDTH / 2,
          y: boss.y,
          vx: (dx / dist) * spd,
          vy: (dy / dist) * spd,
          type: 'diamond',
          size: 10,
          life: 5000,
        });
        bossDiamondSound();
      } else {
        // Spread diamonds (slower)
        for (let i = -1; i <= 1; i++) {
          bossProjectiles.push({
            x: boss.x - BOSS_WIDTH / 2,
            y: boss.y,
            vx: -2.5,
            vy: i * 0.4,
            type: 'diamond',
            size: 8,
            life: 4000,
          });
        }
        bossDiamondSound();
      }
    }

    // Update laser warnings — after warning, fire stationary beam at fixed Y
    for (let w of laserWarnings) {
      if (w.cancelled) continue;
      w.timer += dt * btFactor;
      if (w.timer >= w.duration && !w.fired) {
        w.fired = true;
        w.fireTime = 0;
        bossLaserFireSound();
      }
      // Active laser beam
      if (w.fired) {
        w.fireTime += dt * btFactor;
        // Hit player during active beam (1000ms duration)
        if (w.fireTime <= 1000 && invincibleTimerMs <= 0) {
          const beamLeft = 0;
          const beamRight = w.sourceX || 300;
          if (bird.x > beamLeft && bird.x < beamRight &&
              Math.abs(bird.y - w.y) < 12 + BIRD_SIZE * 0.5) {
            playerHP -= 2; // laser = 1 heart
            hitSound();
              if (playerHP <= 0) {
                playerHP = 0;
                bossPhase = 'defeat';
                resetDialogueState();
                bossProjectiles = [];
              playerBullets = [];
              puppets = [];
              laserWarnings = [];
            } else {
              invincibleTimerMs = INVINCIBLE_MS;
              bird.vy = FLAP;
            }
          }
        }
      }
    }
    laserWarnings = laserWarnings.filter(w => !w.cancelled && (!w.fired || w.fireTime < 1200));

    // Player auto-shooting
    playerLaserActive = playerWeapon === 'laser';
    if (!playerLaserActive) {
      playerShootTimer += dt;
      const shootInterval = activeEffects.bulletSplit > 0 ? PLAYER_SHOOT_INTERVAL * 1.2 : PLAYER_SHOOT_INTERVAL;
      if (playerShootTimer >= shootInterval) {
        playerShootTimer = 0;
        playerShootSound();
        // Normal ray bullet
        playerBullets.push({
          x: bird.x + BIRD_SIZE,
          y: bird.y,
          vx: 7,
          vy: 0,
          type: 'ray',
          size: 6,
          life: 2000,
        });
        // Bullet split
        if (activeEffects.bulletSplit > 0) {
          playerBullets.push({
            x: bird.x + BIRD_SIZE,
            y: bird.y - 8,
            vx: 6.5,
            vy: -1.5,
            type: 'split',
            size: 5,
            life: 2000,
          });
          playerBullets.push({
            x: bird.x + BIRD_SIZE,
            y: bird.y + 8,
            vx: 6.5,
            vy: 1.5,
            type: 'split',
            size: 5,
            life: 2000,
          });
        }
      }
    }

    // Player laser beam — continuous damage to boss/puppets
    if (playerLaserActive && boss && bossEntranceDone) {
      playerLaserHitTimer += dt;
      if (playerLaserHitTimer >= LASER_BEAM_HIT_INTERVAL) { // damage every 100ms
        playerLaserHitTimer = 0;
        playerLaserSound();
        // Check if laser hits boss
        const bossLeft = boss.x - BOSS_WIDTH / 2;
        const bossTop = boss.y - BOSS_HEIGHT / 2;
        const bossBottom = boss.y + BOSS_HEIGHT / 2;
        if (bird.y > bossTop - 10 && bird.y < bossBottom + 10) {
          boss.hp -= LASER_BEAM_DAMAGE;
          bossDamageFlash = 80;
          for (let k = 0; k < LASER_HIT_PARTICLES; k++) {
            particles.push({
              x: bossLeft, y: bird.y,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              size: 3 + Math.random() * 3,
              life: 1,
              decay: 0.03,
              color: 'rgba(0,200,255,0.9)',
            });
          }
          if (boss.hp <= 0) {
            triggerBossVictory();
            return; // Exit updateBoss early — don't process bullet collisions
          }
        }
        // Check if laser hits puppets
        for (let j = puppets.length - 1; j >= 0; j--) {
          const p = puppets[j];
          if (bird.y > p.y - PUPPET_HEIGHT / 2 - 10 && bird.y < p.y + PUPPET_HEIGHT / 2 + 10 &&
              bird.x < p.x) {
            p.hp -= LASER_BEAM_DAMAGE;
            if (p.hp <= 0) {
              for (let k = 0; k < 12; k++) {
                particles.push({
                  x: p.x, y: p.y,
                  vx: (Math.random() - 0.5) * 4,
                  vy: (Math.random() - 0.5) * 4,
                  size: 4 + Math.random() * 4,
                  life: 1,
                  decay: 0.015,
                  color: `hsl(${Math.random() * 60 + 300}, 80%, 60%)`,
                });
              }
              puppets.splice(j, 1);
              scoreSound();
            }
          }
        }
      }
    } else {
      playerLaserHitTimer = 0;
    }

    // Update player bullets
    for (let b of playerBullets) {
      // Bullet tracking — find nearest enemy (boss or puppet)
      if (activeEffects.bulletTracking > 0 && b.type !== 'laser') {
        let targetX = null, targetY = null, minDist = Infinity;
        if (boss) {
          const dx = boss.x - b.x;
          const dy = boss.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist) { minDist = d; targetX = boss.x; targetY = boss.y; }
        }
        for (let p of puppets) {
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist) { minDist = d; targetX = p.x; targetY = p.y; }
        }
        if (targetX !== null) {
          const dx = targetX - b.x;
          const dy = targetY - b.y;
          const dist = minDist || 1;
          const trackStr = BULLET_TRACKING_STRENGTH;
          b.vx += (dx / dist) * trackStr * dtFactor;
          b.vy += (dy / dist) * trackStr * dtFactor;
          // Cap speed
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
          if (spd > BULLET_MAX_SPEED) { b.vx = (b.vx / spd) * BULLET_MAX_SPEED; b.vy = (b.vy / spd) * BULLET_MAX_SPEED; }
        }
      }
      b.x += b.vx * dtFactor;
      b.y += b.vy * dtFactor;
      b.life -= dt;
    }
    playerBullets = playerBullets.filter(b => b.life > 0 && b.x < W + 20 && b.x > -20 && b.y > -20 && b.y < H + 20);

    // Update boss projectiles
    for (let p of bossProjectiles) {
      p.x += p.vx * dtFactor * btFactor;
      p.y += p.vy * dtFactor * btFactor;
      p.life -= dt;
    }
    bossProjectiles = bossProjectiles.filter(p => p.life > 0 && p.x > -40 && p.x < W + 40 && p.y > -40 && p.y < H + 40);

    // Player bullets hit boss
    const bossLeft = boss.x - BOSS_WIDTH / 2;
    const bossRight = boss.x + BOSS_WIDTH / 2;
    const bossTop = boss.y - BOSS_HEIGHT / 2;
    const bossBottom = boss.y + BOSS_HEIGHT / 2;
    const bulletsToRemove = new Set();
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      if (boss.hp <= 0) break; // Boss already dead from laser
      const b = playerBullets[i];
      if (b.x + b.size / 2 > bossLeft && b.x - b.size / 2 < bossRight &&
          b.y + b.size / 2 > bossTop && b.y - b.size / 2 < bossBottom) {
        const dmg = b.type === 'laser' ? BULLET_DAMAGE_LASER : (b.type === 'split' ? BULLET_DAMAGE_SPLIT : BULLET_DAMAGE_NORMAL);
        boss.hp -= dmg;
        bossDamageFlash = 100;
        bulletsToRemove.add(i);
        // Hit particles
        for (let k = 0; k < BULLET_HIT_PARTICLES; k++) {
          particles.push({
            x: b.x, y: b.y,
            vx: (Math.random() - 0.5) * 3,
            vy: (Math.random() - 0.5) * 3,
            size: 4 + Math.random() * 4,
            life: 1,
            decay: 0.02 + Math.random() * 0.02,
            color: b.type === 'laser' ? 'rgba(0,200,255,0.9)' : 'rgba(100,180,255,0.9)',
          });
        }
        if (boss.hp <= 0) {
          triggerBossVictory();
        }
        break;
      }
    }
    playerBullets = playerBullets.filter((_, idx) => !bulletsToRemove.has(idx));

    // Boss projectiles hit player (half-heart HP system)
    if (invincibleTimerMs <= 0) {
      const projToRemove = new Set();
      for (let i = bossProjectiles.length - 1; i >= 0; i--) {
        const p = bossProjectiles[i];
        const hitSize = p.type === 'laser' ? p.size : p.size / 2;
        if (Math.abs(p.x - bird.x) < hitSize + BIRD_SIZE * 0.6 &&
            Math.abs(p.y - bird.y) < hitSize + BIRD_SIZE * 0.6) {
          projToRemove.add(i);
          const dmg = p.type === 'laser' ? 2 : 1; // laser=1 heart, diamond=half heart
          playerHP -= dmg;
          hitSound();
          if (playerHP <= 0) {
            playerHP = 0;
            // Enter defeat dialogue instead of immediate death
            bossPhase = 'defeat';
            resetDialogueState();
            bossProjectiles = [];
            playerBullets = [];
            puppets = [];
            laserWarnings = [];
          } else {
            invincibleTimerMs = INVINCIBLE_MS;
            bird.vy = FLAP;
          }
          break;
        }
      }
      bossProjectiles = bossProjectiles.filter((_, idx) => !projToRemove.has(idx));
    }

    // Power-up spawning
    powerUpSpawnTimer += dt;
    if (powerUpSpawnTimer >= POWERUP_SPAWN_INTERVAL) {
      powerUpSpawnTimer = 0;
      const types = ['heart', 'bulletTime', 'laser', 'split', 'tracking'];
      const type = types[Math.floor(Math.random() * types.length)];
      powerUps.push({
        x: 60 + Math.random() * (W - 200),
        y: -20,
        vy: 1.2 + Math.random() * 0.8,
        type,
        size: 18,
      });
    }

    // Update power-ups
    for (let pu of powerUps) {
      pu.y += pu.vy * dtFactor;
    }
    powerUps = powerUps.filter(pu => pu.y < H + 20);

    // Power-up collection (by bird touch OR player bullet hit)
    const puBulletsToRemove = new Set();
    const powerUpsToRemove = new Set();
    for (let i = powerUps.length - 1; i >= 0; i--) {
      const pu = powerUps[i];
      let collected = false;
      // Bird touch
      if (Math.abs(pu.x - bird.x) < pu.size + BIRD_SIZE &&
          Math.abs(pu.y - bird.y) < pu.size + BIRD_SIZE) {
        collected = true;
      }
      // Player bullet hit
      if (!collected) {
        for (let j = playerBullets.length - 1; j >= 0; j--) {
          const b = playerBullets[j];
          if (Math.abs(pu.x - b.x) < pu.size + b.size &&
              Math.abs(pu.y - b.y) < pu.size + b.size) {
            collected = true;
            puBulletsToRemove.add(j);
            break;
          }
        }
      }
      if (collected) {
        powerUpsToRemove.add(i);
        applyPowerUp(pu.type);
        for (let k = 0; k < POWERUP_COLLECT_PARTICLES; k++) {
          particles.push({
            x: pu.x, y: pu.y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size: 4 + Math.random() * 4,
            life: 1,
            decay: 0.025,
            color: getPowerUpColor(pu.type),
          });
        }
      }
    }
    playerBullets = playerBullets.filter((_, idx) => !puBulletsToRemove.has(idx));
    powerUps = powerUps.filter((_, idx) => !powerUpsToRemove.has(idx));

    // Puppet spawning
    if (bossEntranceDone) {
      puppetSpawnTimer += dt;
      if (puppetSpawnTimer >= PUPPET_SPAWN_INTERVAL && puppets.length < PUPPET_MAX) {
        puppetSpawnTimer = 0;
        const py = 80 + Math.random() * (H - 200);
        puppets.push({
          x: W + PUPPET_WIDTH,
          y: py,
          vy: (Math.random() - 0.5) * 1.5,
          hp: 8,
          timer: 0,
          attackTimer: 2000 + Math.random() * 1500, // stagger first attack
          moveDir: Math.random() < 0.5 ? -1 : 1,
        });
      }
    }

    // Update puppets
    for (let p of puppets) {
      p.timer += dt;
      p.attackTimer += dt * btFactor;
      // Move left until x=300, then drift up/down (stop when firing laser)
      if (p.x > 300) {
        p.x -= 1.5 * dtFactor;
      } else if (!p.firingLaser) {
        p.y += p.vy * dtFactor * p.moveDir;
        if (p.y < PUPPET_HEIGHT / 2 + 40) { p.y = PUPPET_HEIGHT / 2 + 40; p.moveDir = 1; }
        if (p.y > H - PUPPET_HEIGHT / 2 - 50) { p.y = H - PUPPET_HEIGHT / 2 - 50; p.moveDir = -1; }
        if (p.timer > 2000 + Math.random() * 2000) {
          p.moveDir *= -1;
          p.timer = 0;
        }
      }
      // Puppet attacks — laser with warning
      if (p.x <= 300 && p.attackTimer >= 5000) {
        p.attackTimer = 0;
        p.firingLaser = true;
        laserWarnings.push({ y: p.y, timer: 0, duration: LASER_WARN_DURATION, fired: false, source: 'puppet', sourceX: p.x, sourceY: p.y, ref: p, cancelled: false });
        bossLaserWarnSound();
      }
      // Stop puppet movement while firing laser
      if (p.firingLaser) {
        // Check if this puppet still has an active laser warning
        const hasLaser = laserWarnings.some(w => w.ref === p);
        if (!hasLaser) p.firingLaser = false;
      }
    }

    // Player bullets hit puppets
    const puppetBulletsToRemove = new Set();
    const hitPuppetsToRemove = new Set();
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      for (let j = puppets.length - 1; j >= 0; j--) {
        const p = puppets[j];
        if (Math.abs(b.x - p.x) < PUPPET_WIDTH / 2 + b.size &&
            Math.abs(b.y - p.y) < PUPPET_HEIGHT / 2 + b.size) {
          const dmg = b.type === 'laser' ? BULLET_DAMAGE_LASER : (b.type === 'split' ? BULLET_DAMAGE_SPLIT : BULLET_DAMAGE_NORMAL);
          p.hp -= dmg;
          puppetBulletsToRemove.add(i);
          for (let k = 0; k < 3; k++) {
            particles.push({
              x: b.x, y: b.y,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              size: 3 + Math.random() * 3,
              life: 1,
              decay: 0.03,
              color: 'rgba(100,180,255,0.8)',
            });
          }
          if (p.hp <= 0) {
            // Puppet destroyed
            for (let k = 0; k < PUPPET_VICTORY_PARTICLES; k++) {
              particles.push({
                x: p.x, y: p.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                size: 4 + Math.random() * 4,
                life: 1,
                decay: 0.015,
                color: `hsl(${Math.random() * 60 + 300}, 80%, 60%)`,
              });
            }
            // Cancel any laser warnings from this puppet
            for (let w = laserWarnings.length - 1; w >= 0; w--) {
              if (laserWarnings[w].ref === p) {
                laserWarnings[w].cancelled = true;
                laserWarnings.splice(w, 1);
              }
            }
            hitPuppetsToRemove.add(j);
            scoreSound();
          }
          break;
        }
      }
    }
    playerBullets = playerBullets.filter((_, idx) => !puppetBulletsToRemove.has(idx));
    puppets = puppets.filter((_, idx) => !hitPuppetsToRemove.has(idx));

    // Remove off-screen puppets
    puppets = puppets.filter(p => p.x > -PUPPET_WIDTH * 2);

    // Boss damage flash decay
    if (bossDamageFlash > 0) bossDamageFlash -= dt;
  }

  // Victory dialogue phase
  if (bossPhase === 'victory') {
    if (!bossDialogue) return;
    const victory = bossDialogue.victory;
    updateDialogueTypewriter(dt, victory.lines);
  }

  // Defeat dialogue phase
  if (bossPhase === 'defeat') {
    if (!bossDialogue) return;
    const defeat = bossDialogue.defeat;
    updateDialogueTypewriter(dt, defeat.lines);
  }
}

function handleBossDialogueAdvance() {
  if (bossPhase === 'dialogue') {
    if (!bossDialogueAdvanceReady) {
      // Skip to full text
      bossDialogueDisplayedText = bossDialogueFullText;
      bossDialogueAdvanceReady = true;
      return;
    }
    const scenes = bossDialogue.scenes;
    const scene = scenes[bossDialogueIndex];
    bossDialogueLineIndex++;
    if (bossDialogueLineIndex >= scene.lines.length) {
      bossDialogueIndex++;
      bossDialogueLineIndex = 0;
    }
    bossDialogueCharTimer = 0;
    bossDialogueFullText = '';
    bossDialogueAdvanceReady = false;
  } else if (bossPhase === 'victory') {
    if (!bossDialogueAdvanceReady) {
      bossDialogueDisplayedText = bossDialogueFullText;
      bossDialogueAdvanceReady = true;
      return;
    }
    const victory = bossDialogue.victory;
    bossDialogueLineIndex++;
    if (bossDialogueLineIndex >= victory.lines.length) {
      // Victory dialogue done — continue game or end
      bossPhase = 'none';
      boss = null;
      bossProjectiles = [];
      playerBullets = [];
      powerUps = [];
      puppets = [];
      laserWarnings = [];
      lives = INITIAL_LIVES;
      tempExtraLives = 0;
      // Continue playing with increased score milestones
    }
    bossDialogueCharTimer = 0;
    bossDialogueFullText = '';
    bossDialogueAdvanceReady = false;
  } else if (bossPhase === 'defeat') {
    if (!bossDialogueAdvanceReady) {
      bossDialogueDisplayedText = bossDialogueFullText;
      bossDialogueAdvanceReady = true;
      return;
    }
    const defeat = bossDialogue.defeat;
    bossDialogueLineIndex++;
    if (bossDialogueLineIndex >= defeat.lines.length) {
      // Defeat dialogue done — trigger actual death
      bossPhase = 'none';
      boss = null;
      tempExtraLives = 0;
      gameState = 'dead';
      deadTimerMs = 0;
      speedBonus = 0;
      scoreSinceReset = 0;
      speedLines = [];
      if (score > bestScore) bestScore = score;
      fetchLeaderboard();
      setTimeout(showNameInput, 500);
    }
    bossDialogueCharTimer = 0;
    bossDialogueFullText = '';
    bossDialogueAdvanceReady = false;
  }
}

function applyPowerUp(type) {
  scoreSound();
  if (type === 'heart') {
    if (playerHP < maxPlayerHP) {
      playerHP = Math.min(maxPlayerHP, playerHP + 2); // +1 heart
    } else {
      tempExtraLives++; // temporary extra life at full HP
      maxPlayerHP = Math.min(MAX_HP + tempExtraLives * 2, 10);
      playerHP = maxPlayerHP;
    }
  } else if (type === 'bulletTime') {
    activeEffects.bulletTime = 6000;
  } else if (type === 'laser') {
    activeEffects.laserWeapon = 5000;
  } else if (type === 'split') {
    activeEffects.bulletSplit = 7000;
  } else if (type === 'tracking') {
    activeEffects.bulletTracking = 8000;
  }
}

function getPowerUpColor(type) {
  if (type === 'heart') return 'rgba(255,68,68,0.9)';
  if (type === 'bulletTime') return 'rgba(100,200,255,0.9)';
  if (type === 'laser') return 'rgba(255,200,0,0.9)';
  if (type === 'split') return 'rgba(0,255,100,0.9)';
  if (type === 'tracking') return 'rgba(200,100,255,0.9)';
  return 'rgba(255,255,255,0.9)';
}

// ===== Boss Draw Functions =====

function drawBossWarning() {
  // Flashing WARNING banner
  const flash = Math.floor(now / 150) % 2 === 0;
  const alpha = flash ? 1.0 : 0.3;
  ctx.globalAlpha = alpha;

  // Red background strip
  ctx.fillStyle = '#FF0000';
  ctx.fillRect(0, H / 2 - 50, W, 100);

  // Border lines
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(0, H / 2 - 52, W, 4);
  ctx.fillRect(0, H / 2 + 48, W, 4);

  // Diagonal warning stripes
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (let i = -W; i < W * 2; i += 30) {
    ctx.beginPath();
    ctx.moveTo(i, H / 2 - 50);
    ctx.lineTo(i + 15, H / 2 - 50);
    ctx.lineTo(i + 15 + 100, H / 2 + 50);
    ctx.lineTo(i + 100, H / 2 + 50);
    ctx.fill();
  }

  // WARNING text
  pixelText('W  A  R  N  I  N  G', W / 2, H / 2 - 8, 32, '#FFF');
  pixelText('黑 塔 来 了', W / 2, H / 2 + 28, 18, '#FFD700');

  ctx.globalAlpha = 1;
}

function drawBossSprite() {
  if (!boss) return;
  const bx = boss.x - BOSS_WIDTH / 2;
  const by = boss.y - BOSS_HEIGHT / 2;

  // Damage flash
  if (bossDamageFlash > 0 && Math.floor(now / 50) % 2 === 0) {
    ctx.globalAlpha = 0.6;
  }

  // Draw boss image
  ctx.drawImage(bossImg, bx, by, BOSS_WIDTH, BOSS_HEIGHT);
  ctx.globalAlpha = 1;
}

function drawPuppets() {
  for (let p of puppets) {
    const px = Math.round(p.x / 2) * 2;
    const py = Math.round(p.y / 2) * 2;
    // Puppet sprite
    ctx.drawImage(puppetImg, px - PUPPET_WIDTH / 2, py - PUPPET_HEIGHT / 2, PUPPET_WIDTH, PUPPET_HEIGHT);
    // HP bar under puppet
    const barW = PUPPET_WIDTH;
    const barH = 4;
    const barX = px - barW / 2;
    const barY = py + PUPPET_HEIGHT / 2 + 4;
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e94560';
    ctx.fillRect(barX, barY, barW * (p.hp / 8), barH);
  }
}

function drawBossHPBar() {
  if (!boss) return;
  // HP bar at top center
  const barW = 240;
  const barH = 16;
  const barX = W / 2 - barW / 2;
  const barY = 16;

  // Boss name
  pixelText('黑 塔', W / 2, barY - 4, 14, '#e94560');

  // Bar background
  pixelBox(barX, barY + 10, barW, barH, '#1a1a2e', '#555');

  // HP fill
  const hpRatio = Math.max(0, boss.hp / boss.maxHp);
  const fillColor = hpRatio > 0.5 ? '#e94560' : hpRatio > 0.25 ? '#FF8800' : '#FF4444';
  ctx.fillStyle = fillColor;
  ctx.fillRect(barX + 2, barY + 12, (barW - 4) * hpRatio, barH - 4);

  // HP text
  pixelText(`${Math.ceil(boss.hp)}/${boss.maxHp}`, W / 2, barY + barH + 16, 10, '#CCC');
}

function drawBossDialogue() {
  if (!bossDialogue) return;

  let speaker, speakerName, text;
  if (bossPhase === 'dialogue') {
    const scene = bossDialogue.scenes[bossDialogueIndex];
    if (!scene) return;
    speaker = scene.speaker;
    speakerName = scene.speaker_name;
    text = bossDialogueDisplayedText;
  } else if (bossPhase === 'victory') {
    const victory = bossDialogue.victory;
    speaker = victory.speaker;
    speakerName = victory.speaker_name;
    text = bossDialogueDisplayedText;
  } else if (bossPhase === 'defeat') {
    const defeat = bossDialogue.defeat;
    speaker = defeat.speaker;
    speakerName = defeat.speaker_name;
    text = bossDialogueDisplayedText;
  } else {
    return;
  }

  // Dialogue box at bottom
  const boxX = 20;
  const boxY = H - 160;
  const boxW = W - 40;
  const boxH = 140;

  // Semi-transparent background
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  const borderColor = speaker === 'herta' || speaker === 'puppet' ? '#e94560' : '#6C5CE7';
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Speaker name
  const nameColor = borderColor;
  pixelText(speakerName, boxX + 16, boxY + 20, 14, nameColor, 'left');

  // Dialogue text
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  // Word wrap
  const maxWidth = boxW - 32;
  const lines = [];
  let currentLine = '';
  for (let i = 0; i < text.length; i++) {
    const testLine = currentLine + text[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = text[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], boxX + 16, boxY + 46 + i * 22);
  }

  // Advance indicator
  if (bossDialogueAdvanceReady) {
    const indAlpha = Math.floor(now / 400) % 2 === 0 ? 1 : 0.3;
    ctx.globalAlpha = indAlpha;
    pixelText('▼', boxX + boxW - 24, boxY + boxH - 16, 14, '#FFD700');
    ctx.globalAlpha = 1;
  }

  // Draw speaker portrait in center of screen
  const portraitH = speaker === 'herta' ? 160 : (speaker === 'puppet' ? 100 : 80);
  const portraitY = boxY - portraitH - 20;

  if (speaker === 'puppet') {
    // Show 5 puppets in a row
    const puppetCount = 5;
    const singleW = 70;
    const totalW = puppetCount * singleW + (puppetCount - 1) * 8;
    const startX = W / 2 - totalW / 2;
    for (let i = 0; i < puppetCount; i++) {
      const px = startX + i * (singleW + 8);
      ctx.drawImage(puppetImg, px, portraitY, singleW, portraitH);
    }
  } else {
    const portraitW = speaker === 'herta' ? 140 : 80;
    const portraitX = W / 2 - portraitW / 2;
    if (speaker === 'herta') {
      ctx.drawImage(bossImg, portraitX, portraitY, portraitW, portraitH);
    } else {
      ctx.drawImage(birdImg, portraitX, portraitY, portraitW, portraitH);
    }
  }
}

function drawPlayerBullets() {
  // Continuous laser beam
  if (playerLaserActive && boss) {
    const beamEnd = boss.x - BOSS_WIDTH / 2;
    const py = Math.round(bird.y / 2) * 2;
    const flash = Math.floor(now / 50) % 2 === 0;
    // Outer glow
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#00BFFF';
    ctx.fillRect(bird.x + BIRD_SIZE, py - 10, beamEnd - bird.x - BIRD_SIZE, 20);
    // Middle
    ctx.globalAlpha = flash ? 0.5 : 0.35;
    ctx.fillStyle = '#0088FF';
    ctx.fillRect(bird.x + BIRD_SIZE, py - 4, beamEnd - bird.x - BIRD_SIZE, 8);
    // Core
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#00DDFF';
    ctx.fillRect(bird.x + BIRD_SIZE, py - 2, beamEnd - bird.x - BIRD_SIZE, 4);
    // White center
    ctx.fillStyle = '#AAEEFF';
    ctx.fillRect(bird.x + BIRD_SIZE, py - 1, beamEnd - bird.x - BIRD_SIZE, 2);
  }

  for (let b of playerBullets) {
    const px = Math.round(b.x / 2) * 2;
    const py = Math.round(b.y / 2) * 2;
    if (b.type === 'split') {
      // Smaller green-tinted bullet
      ctx.fillStyle = '#00FF88';
      ctx.fillRect(px - 2, py - 2, 6, 6);
      ctx.fillStyle = '#AAFFCC';
      ctx.fillRect(px, py, 2, 2);
    } else {
      // Normal blue ray
      ctx.fillStyle = 'rgba(0,100,255,0.4)';
      ctx.fillRect(px - 2, py - b.size / 2 - 2, b.size * 2 + 4, b.size + 4);
      ctx.fillStyle = '#4488FF';
      ctx.fillRect(px, py - b.size / 2, b.size * 2, b.size);
      ctx.fillStyle = '#AADDFF';
      ctx.fillRect(px + 2, py - 1, b.size, 2);
    }
  }
}

function drawLaserWarnings() {
  for (let w of laserWarnings) {
    if (w.cancelled) continue;
    // Use source position (character center) as laser start point
    const startX = w.sourceX || 300;
    if (!w.fired) {
      // Warning phase — red line from source to left edge
      const progress = w.timer / w.duration;
      const alpha = 0.15 + progress * 0.35;
      const flash = Math.floor(now / 100) % 2 === 0;
      ctx.globalAlpha = flash ? alpha : alpha * 0.5;
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, w.y - 2, startX, 4);
      ctx.fillStyle = 'rgba(255,0,0,0.1)';
      ctx.fillRect(0, w.y - 10, startX, 20);
      ctx.globalAlpha = 1;
    } else if (w.fireTime <= 1000) {
      // Active laser beam — solid red beam from source center to left
      const flash = Math.floor(now / 60) % 2 === 0;
      // Outer glow
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, w.y - 14, startX, 28);
      // Middle layer
      ctx.globalAlpha = flash ? 0.5 : 0.35;
      ctx.fillStyle = '#FF4444';
      ctx.fillRect(0, w.y - 6, startX, 12);
      // Core beam
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FF8888';
      ctx.fillRect(0, w.y - 2, startX, 4);
      // White center
      ctx.fillStyle = '#FFCCCC';
      ctx.fillRect(0, w.y - 1, startX, 2);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBossProjectiles() {
  for (let p of bossProjectiles) {
    const px = Math.round(p.x / 2) * 2;
    const py = Math.round(p.y / 2) * 2;
    if (p.type === 'laser') {
      // Red laser beam
      ctx.fillStyle = 'rgba(255,0,0,0.3)';
      ctx.fillRect(px - 20, py - p.size * 0.7, 40, p.size * 1.4);
      ctx.fillStyle = '#FF4444';
      ctx.fillRect(px - 14, py - p.size / 2, 28, p.size);
      ctx.fillStyle = '#FFAAAA';
      ctx.fillRect(px - 8, py - 2, 16, 4);
    } else {
      // Diamond bullet — rotated square
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(now * 0.005);
      const s = p.size / 2;
      ctx.fillStyle = '#e94560';
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FF88AA';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }
  }
}

function drawPowerUps() {
  for (let pu of powerUps) {
    const px = Math.round(pu.x / 2) * 2;
    const py = Math.round(pu.y / 2) * 2;
    const s = pu.size;

    // Glow
    ctx.globalAlpha = 0.3 + Math.sin(now * 0.005) * 0.2;
    ctx.fillStyle = getPowerUpColor(pu.type);
    ctx.fillRect(px - s / 2 - 4, py - s / 2 - 4, s + 8, s + 8);
    ctx.globalAlpha = 1;

    // Background box
    pixelBox(px - s / 2, py - s / 2, s, s, 'rgba(0,0,0,0.7)', getPowerUpColor(pu.type));

    // Icon
    if (pu.type === 'heart') {
      ctx.fillStyle = '#FF4444';
      drawPixelHeart(px - 6, py - 6, 12);
    } else if (pu.type === 'bulletTime') {
      // Clock icon
      ctx.fillStyle = '#64C8FF';
      ctx.fillRect(px - 4, py - 6, 8, 2);
      ctx.fillRect(px - 4, py + 4, 8, 2);
      ctx.fillRect(px - 6, py - 4, 2, 8);
      ctx.fillRect(px + 4, py - 4, 2, 8);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(px - 1, py - 4, 2, 5);
      ctx.fillRect(px - 1, py - 1, 4, 2);
    } else if (pu.type === 'laser') {
      // Laser icon
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(px - 6, py - 2, 12, 4);
      ctx.fillStyle = '#FFF';
      ctx.fillRect(px - 2, py - 1, 4, 2);
    } else if (pu.type === 'split') {
      // Split icon (3 dots)
      ctx.fillStyle = '#00FF64';
      ctx.fillRect(px - 5, py - 1, 4, 4);
      ctx.fillRect(px, py - 4, 4, 4);
      ctx.fillRect(px + 2, py + 2, 4, 4);
    } else if (pu.type === 'tracking') {
      // Tracking icon (arrow)
      ctx.fillStyle = '#C864FF';
      ctx.fillRect(px - 4, py - 1, 8, 2);
      ctx.fillRect(px + 2, py - 4, 2, 4);
      ctx.fillRect(px + 2, py + 1, 2, 4);
    }
  }
}

function drawActiveEffectsUI() {
  // Show active power-up effects at bottom-left during boss fight
  if (bossPhase !== 'fight') return;
  let y = H - 55;
  const effects = [
    { key: 'bulletTime', name: '子弹时间', color: '#64C8FF' },
    { key: 'laserWeapon', name: '激光武器', color: '#FFD700' },
    { key: 'bulletSplit', name: '子弹分裂', color: '#00FF64' },
    { key: 'bulletTracking', name: '子弹追踪', color: '#C864FF' },
  ];
  for (let eff of effects) {
    if (activeEffects[eff.key] > 0) {
      const sec = Math.ceil(activeEffects[eff.key] / 1000);
      pixelText(`${eff.name} ${sec}s`, 10, y, 10, eff.color, 'left');
      y -= 16;
    }
  }
}
