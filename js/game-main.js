// Game loop — dt in ms
function update(dt) {
  if (gameState === 'playing') {
    // Physics normalized to 60fps baseline, scaled by GAME_SPEED
    const dtFactor = (dt / MS_PER_FRAME) * GAME_SPEED;

    // Freeze bird during dialogue/victory phases
    if (bossPhase === 'dialogue' || bossPhase === 'victory' || bossPhase === 'defeat') {
      bird.y = H / 2;
      bird.vy = 0;
      bird.rotation = 0;
    } else {
      bird.vy += GRAVITY * dtFactor;
      bird.y += bird.vy * dtFactor;
      bird.rotation = Math.min(Math.max(bird.vy * 0.05, -0.5), 1.2);
    }

    // Spawn trail particles behind the bird (reduced density, center-weighted)
    if (Math.random() < 0.35) {
      const particleColor = Math.random() < 0.5
        ? `rgba(138,43,226,${0.5 + Math.random() * 0.5})`
        : `rgba(30,144,255,${0.5 + Math.random() * 0.5})`;
      const pxBase = 2;
      // Triangular distribution centered on bird.y, spanning bird height
      const yBias = (Math.random() + Math.random() - 1) * BIRD_SIZE * 0.8;
      particles.push({
        x: bird.x - BIRD_SIZE,
        y: bird.y + yBias,
        vx: -0.4 - Math.random() * 0.8,
        vy: (Math.random() - 0.5) * 0.6,
        size: (2 + Math.floor(Math.random() * 3)) * pxBase,
        life: 1,
        decay: 0.008 + Math.random() * 0.01,
        color: particleColor,
      });
    }

    // Invincibility countdown (ms, scaled by GAME_SPEED)
    if (invincibleTimerMs > 0) {
      invincibleTimerMs -= dt * GAME_SPEED;
      // Clamp bird position during invincibility
      bird.y = Math.max(BIRD_SIZE, Math.min(H - 50 - BIRD_SIZE, bird.y));
    }

    // Shield banner countdown
    if (shieldBannerTimer > 0) {
      shieldBannerTimer -= dt * GAME_SPEED;
    }

    // Spawn pipes — bigger height jump → longer gap (ms, scaled by GAME_SPEED)
    // Don't spawn new pipes during boss phases
    if (bossPhase === 'none') {
    pipeSpawnTimerMs += dt * GAME_SPEED;
    if (pipeSpawnTimerMs >= pipeSpawnIntervalMs) {
      pipeSpawnTimerMs = 0;

      // Gap shrinks as speed increases (170→100 at 300%)
      const gapRatio = 1 - speedBonus * 0.0014;
      const gapNow = Math.max(100, PIPE_GAP * gapRatio);

      // Jump range narrows at high speed for smoother transitions
      const jumpRange = (60 + 340 * Math.random()) * Math.max(0.3, gapRatio);
      const jump = (Math.random() - 0.5) * jumpRange;
      targetGapY += jump;
      targetGapY = Math.max(80, Math.min(H - 80 - gapNow, targetGapY));
      const topH = targetGapY;
      // Pre-generate window colors (fixed per pipe, no flicker)
      const rng = seededRand(Math.round(W * 137 + topH * 31) & 0x7FFFFFFF);
      function genWinColors(y1, y2) {
        const colors = [];
        const winW = 4, winH = 6, gap = 4;
        for (let wy = y1 + 8; wy < y2 - 8; wy += winH + gap) {
          for (let wx = 6; wx < PIPE_WIDTH - 6; wx += winW + gap) {
            const lit = rng() > 0.35;
            colors.push(lit ? (rng() > 0.5 ? '#FFE066' : '#FFCC33') : '#0a0a1a');
          }
        }
        return colors;
      }
      const topWins = genWinColors(0, topH);
      const botWins = genWinColors(topH + gapNow, H);
      pipes.push({ x: W, topH, bottomY: topH + gapNow, scored: false, topWins, botWins });

      // Interval: bigger height jump → longer minimum gap, then add randomness
      const heightDiff = Math.abs(targetGapY - lastPipeGapY);
      const baseInterval = PIPE_BASE_INTERVAL_MS * Math.max(0.6, 1 - speedBonus * 0.001);
      const minInterval = baseInterval + Math.floor((heightDiff / 80) * PIPE_EXTRA_INTERVAL_MS);
      const randomRange = PIPE_BASE_INTERVAL_MS * 0.4; // 40% random variation
      pipeSpawnIntervalMs = Math.min(PIPE_MAX_INTERVAL_MS, minInterval + Math.floor(Math.random() * randomRange));
      lastPipeGapY = targetGapY;
    }
    } // end bossPhase guard

    // Move pipes (ms), with speed bonus
    const speedMul = minSpeedMultiplier + speedBonus / 100;
    for (let p of pipes) {
      p.x -= PIPE_SPEED * dtFactor * speedMul;

      // Score
      if (!p.scored && p.x + PIPE_WIDTH < bird.x) {
        p.scored = true;
        score++;
        scoreSinceReset++;
        scoreSound();
        // Trigger boss at score 76
        if (score === 76) {
          bossPhase = 'warning';
          bossWarningTimer = 0;
          // Don't spawn more pipes after this
        }
        if (scoreSinceReset % 3 === 0 && speedBonus < maxSpeedBonus) {
          speedBonus = Math.min(speedBonus + 10, maxSpeedBonus);
        }
      }
    }

    // Remove off-screen pipes
    pipes = pipes.filter(p => p.x > -PIPE_WIDTH);

    // Update particles
    for (let pt of particles) {
      pt.x += pt.vx * dtFactor;
      pt.y += pt.vy * dtFactor;
      pt.life -= pt.decay * dtFactor;
      pt.size *= 0.98;
    }
    particles = particles.filter(pt => pt.life > 0);

    // Speed lines — spawn and update
    if (speedBonus >= 10) {
      const spawnChance = 0.15 + (speedBonus / 300) * 0.6;
      if (Math.random() < spawnChance) {
        const len = 30 + (speedBonus / 300) * 80 + Math.random() * 40;
        speedLines.push({
          x: W + len,
          y: Math.random() * (H - 80) + 20,
          len,
          speed: 6 + (speedBonus / 300) * 14 + Math.random() * 4,
          alpha: 0.15 + (speedBonus / 300) * 0.3,
        });
      }
      for (let sl of speedLines) {
        sl.x -= sl.speed * dtFactor;
      }
      speedLines = speedLines.filter(sl => sl.x + sl.len > 0);
    }

    // Collision detection
    if (bird.y > H - 50 || bird.y < 0) {
      die(score < 76);
    }

    let hitPipe = false;
    for (let p of pipes) {
      if (bird.x + BIRD_SIZE * 0.7 > p.x && bird.x - BIRD_SIZE * 0.7 < p.x + PIPE_WIDTH) {
        if (bird.y - BIRD_SIZE * 0.6 < p.topH || bird.y + BIRD_SIZE * 0.6 > p.bottomY) {
          hitPipe = true;
          break;
        }
      }
    }
    if (hitPipe) {
      speedBonus = 0;
      scoreSinceReset = 0;
      speedLines = [];
      die(score < 76);
    }

    // ===== Boss Phase Updates =====
    updateBoss(dt, dtFactor);
  } else if (gameState === 'ready') {
    bird.y = H / 2 + Math.sin(now * 0.003) * 15;
  } else if (gameState === 'dead') {
    deadTimerMs += dt * GAME_SPEED;
  } else if (gameState === 'countdown') {
    countdownMs -= dt;
    if (countdownMs <= 0) {
      countdownMs = 0;
      gameState = 'playing';
      lastTime = 0;
    }
  }
  // 'paused' — do nothing, game frozen
}

function die(noLifeLoss) {
  if (invincibleTimerMs > 0) return;
  if (noLifeLoss) shieldBannerTimer = SHIELD_BANNER_DURATION;
  if (!noLifeLoss) lives--;
  if (lives <= 0) {
    gameState = 'dead';
    deadTimerMs = 0;
    speedBonus = 0;
    scoreSinceReset = 0;
    speedLines = [];
    // Reset boss state on death
    bossPhase = 'none';
    boss = null;
    tempExtraLives = 0;
    bossProjectiles = [];
    playerBullets = [];
    powerUps = [];
    if (score > bestScore) bestScore = score;
    hitSound();
    fetchLeaderboard();
    setTimeout(showNameInput, 500);
  } else {
    hitSound();
    invincibleTimerMs = INVINCIBLE_MS;
    bird.vy = FLAP;
  }
}

function draw() {
  drawBackground();

  for (let p of pipes) {
    drawPipe(p.x, p.topH, p.bottomY, p);
  }

  drawSpeedLines();
  drawParticles();

  // Bird blinks during invincibility (200ms on/off)
  if (invincibleTimerMs <= 0 || Math.floor(now / 200) % 2 === 0) {
    drawBird();
  }

  // Boss rendering
  if (bossPhase === 'warning') {
    drawBossWarning();
  }
  if (bossPhase === 'fight' || bossPhase === 'victory' || bossPhase === 'defeat') {
    drawLaserWarnings();
    drawBossProjectiles();
    drawPowerUps();
    drawPlayerBullets();
    drawPuppets();
    if (boss) drawBossSprite();
    drawBossHPBar();
    drawActiveEffectsUI();
  }
  if (bossPhase === 'dialogue' || bossPhase === 'victory' || bossPhase === 'defeat' || bossPhase === 'defeat') {
    drawBossDialogue();
  }

  if (bossPhase !== 'fight' && bossPhase !== 'dialogue' && bossPhase !== 'victory' && bossPhase !== 'warning' && bossPhase !== 'clearing') drawScore();
  drawLives();
  drawSpeedIndicator();
  drawShieldBanner();

  if (gameState === 'ready') drawReady();
  if (gameState === 'dead') drawGameOver();
  if (gameState === 'paused') drawPauseOverlay();
  if (gameState === 'countdown') drawCountdown();
  if (gameState !== 'paused') drawUIButtons();
  if (showLeaderboard) drawLeaderboardOverlay();
}

function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  const dt = Math.min(timestamp - lastTime, 50); // cap at 50ms to avoid spiral
  lastTime = timestamp;
  now += dt;

  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

// Intro overlay
const introEl = document.getElementById('intro');
const introBtn = document.getElementById('introStart');
introBtn.addEventListener('click', () => {
  introEl.classList.add('hidden');
  requestAnimationFrame(gameLoop);
});

// Pause music when page is hidden (mobile users leaving browser)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    bgm.pause();
  } else if (bgmStarted && !muted) {
    bgm.play().catch(() => {});
  }
});

// Leaderboard
let leaderboard = [];
let leaderboardTime = 0;
const LEADERBOARD_CACHE_MS = 10000;

async function fetchLeaderboard() {
  const now = Date.now();
  if (leaderboard.length > 0 && now - leaderboardTime < LEADERBOARD_CACHE_MS) return;
  try {
    const res = await fetch('/api/leaderboard');
    leaderboard = await res.json();
    leaderboardTime = now;
  } catch (e) {}
}

async function submitScore(name, score) {
  const res = await fetch('/api/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score }),
  });
  return await res.json();
}

// Nickname input overlay
const nameInputEl = document.getElementById('nameInput');
const nameField = document.getElementById('nameField');
const submitBtn = document.getElementById('submitBtn');
const submitMsg = document.getElementById('submitMsg');

function showNameInput() {
  scoreSubmitted = false;
  nameInputEl.classList.add('show');
  nameField.value = '';
  submitMsg.textContent = '';
  // Reset button state
  submitBtn.textContent = '上榜';
  submitBtn.disabled = false;
  nameField.focus();
}

function hideNameInput() {
  nameInputEl.classList.remove('show');
}

submitBtn.addEventListener('click', async () => {
  // If already submitted, close and show leaderboard
  if (scoreSubmitted) {
    hideNameInput();
    showLeaderboard = true;
    return;
  }

  const name = nameField.value.trim();
  if (!name) { submitMsg.textContent = '请输入昵称'; return; }
  submitMsg.textContent = '提交中...';
  submitMsg.style.color = '#FFD700';
  submitBtn.disabled = true;
  const result = await submitScore(name, score);
  submitBtn.disabled = false;
  if (result.ok) {
    scoreSubmitted = true;
    lastSubmittedName = name;
    submitMsg.textContent = '提交成功！';
    submitMsg.style.color = '#4CAF50';
    submitBtn.textContent = '查看排行榜';
    // Force refresh leaderboard
    leaderboardTime = 0;
    await fetchLeaderboard();
  } else {
    submitMsg.textContent = result.error || '提交失败';
    submitMsg.style.color = '#FF4444';
  }
});

nameField.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') submitBtn.click();
});

// Close button for name input
document.getElementById('closeNameInput').addEventListener('click', () => {
  hideNameInput();
});
