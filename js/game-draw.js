// Draw functions
function drawSpeedLines() {
  for (let sl of speedLines) {
    ctx.globalAlpha = sl.alpha;
    const px = Math.round(sl.x / 2) * 2;
    const py = Math.round(sl.y / 2) * 2;
    const h = 4;
    // Dark outline
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(px - sl.len - 2, py - 1, sl.len + 4, h + 2);
    // White fill
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(px - sl.len, py + 1, sl.len, h - 2);
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (let pt of particles) {
    ctx.globalAlpha = pt.life;
    ctx.fillStyle = pt.color;
    const s = Math.max(2, Math.round(pt.size / 2) * 2);
    const px = Math.round(pt.x / 2) * 2;
    const py = Math.round(pt.y / 2) * 2;
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}
function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);
  const size = BIRD_SIZE * 2;
  ctx.drawImage(birdImg, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// Seeded random for consistent window patterns per pipe
function seededRand(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function drawBuilding(x, y1, y2, winColors) {
  const w = PIPE_WIDTH;
  // Building body
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(x, y1, w, y2 - y1);
  ctx.strokeStyle = '#333355';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y1, w, y2 - y1);
  // Windows (pixel grid, colors pre-computed)
  const winW = 4, winH = 6, gap = 4;
  let idx = 0;
  for (let wy = y1 + 8; wy < y2 - 8; wy += winH + gap) {
    for (let wx = x + 6; wx < x + w - 6; wx += winW + gap) {
      ctx.fillStyle = winColors[idx++] || '#0a0a1a';
      ctx.fillRect(wx, wy, winW, winH);
    }
  }
  // Roof edge
  ctx.fillStyle = '#2a2a4a';
  ctx.fillRect(x - 2, y1, w + 4, 4);
  ctx.fillRect(x - 2, y2 - 4, w + 4, 4);
}

function drawPipe(x, topH, bottomY, pipe) {
  const rx = Math.round(x / 2) * 2;
  drawBuilding(rx, 0, topH, pipe.topWins);
  drawBuilding(rx, bottomY, H, pipe.botWins);
}


// Pixel stars (pre-generated positions)
const stars = [];
for (let i = 0; i < 60; i++) {
  stars.push({
    x: Math.floor(Math.random() * W / 2) * 2,
    y: Math.floor(Math.random() * (H - 100) / 2) * 2,
    size: Math.random() > 0.8 ? 4 : 2,
    twinkle: Math.random() * Math.PI * 2,
  });
}

function drawBackground() {
  // Night sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#0a0a2e');
  skyGrad.addColorStop(0.5, '#141438');
  skyGrad.addColorStop(1, '#1a1a40');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // Stars (flicker)
  for (let st of stars) {
    const flicker = 0.5 + 0.5 * Math.sin(now * 0.002 + st.twinkle);
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#FFF';
    ctx.fillRect(st.x, st.y, st.size, st.size);
  }
  ctx.globalAlpha = 1;

  // Moon (pixel circle)
  ctx.fillStyle = '#FFE8A0';
  const moonX = W - 70, moonY = 60;
  for (let dy = -16; dy <= 16; dy += 2) {
    for (let dx = -16; dx <= 16; dx += 2) {
      if (dx * dx + dy * dy <= 256) {
        ctx.fillRect(moonX + dx, moonY + dy, 2, 2);
      }
    }
  }
  ctx.fillStyle = '#EED680';
  ctx.fillRect(moonX - 4, moonY - 6, 4, 4);
  ctx.fillRect(moonX + 6, moonY + 2, 4, 4);
  ctx.fillRect(moonX - 2, moonY + 8, 4, 4);

  // Ground (dark road)
  ctx.fillStyle = '#1a1a28';
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = '#333350';
  ctx.fillRect(0, H - 42, W, 4);
  // Road dashes
  ctx.fillStyle = '#555570';
  for (let i = 0; i < W; i += 24) {
    const ox = (now * 0.05) % 24;
    ctx.fillRect(i - ox, H - 22, 12, 2);
  }
}


// Pixel text helper — snaps to 2px grid
function pixelText(text, x, y, size, color, align) {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align || 'center';
  ctx.fillText(text, Math.round(x / 2) * 2, Math.round(y / 2) * 2);
}

// Pixel heart (filled block shape)
function drawPixelHeart(x, y, s) {
  const p = s / 5;
  ctx.fillRect(x + p, y, p * 3, p);
  ctx.fillRect(x, y + p, p * 5, p);
  ctx.fillRect(x, y + p * 2, p * 5, p);
  ctx.fillRect(x + p, y + p * 3, p * 3, p);
  ctx.fillRect(x + p * 2, y + p * 4, p, p);
}

// Pixel box (sharp edges, no rounding)
function pixelBox(x, y, w, h, fill, stroke) {
  const px = Math.round(x / 2) * 2;
  const py = Math.round(y / 2) * 2;
  const pw = Math.round(w / 2) * 2;
  const ph = Math.round(h / 2) * 2;
  if (stroke) {
    ctx.fillStyle = stroke;
    ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
  }
  ctx.fillStyle = fill;
  ctx.fillRect(px, py, pw, ph);
}

function drawScore() {
  pixelText(score, W / 2, 60, 36, '#FFF');
}

function drawLives() {
  ctx.fillStyle = '#FF4444';
  if (bossPhase === 'fight' || bossPhase === 'dialogue' || bossPhase === 'victory' || bossPhase === 'defeat' || bossPhase === 'clearing') {
    // Boss fight: show half-hearts based on playerHP
    const maxHearts = maxPlayerHP / 2;
    for (let i = 0; i < maxHearts; i++) {
      const hpForThisHeart = Math.max(0, Math.min(2, playerHP - i * 2));
      if (hpForThisHeart >= 2) {
        // Full heart
        ctx.fillStyle = '#FF4444';
        drawPixelHeart(10 + i * 24, 10, 16);
      } else if (hpForThisHeart === 1) {
        // Half heart — draw outline + left half filled
        ctx.fillStyle = '#444';
        drawPixelHeart(10 + i * 24, 10, 16);
        ctx.fillStyle = '#FF4444';
        ctx.fillRect(10 + i * 24 + 3, 10 + 2, 5, 12);
      } else {
        // Empty heart
        ctx.fillStyle = '#444';
        drawPixelHeart(10 + i * 24, 10, 16);
      }
    }
  } else {
    for (let i = 0; i < lives; i++) {
      drawPixelHeart(10 + i * 24, 10, 16);
    }
  }
}

function drawReady() {
  pixelText('点击开始', W / 2, H / 2 - 60, 22, '#FFF');

  // Animated pixel arrow
  const ay = Math.round((H / 2 - 10 + Math.sin(now * 0.003) * 8) / 2) * 2;
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(W / 2 - 4, ay, 8, 8);
  ctx.fillRect(W / 2 - 8, ay + 8, 16, 4);
  ctx.fillRect(W / 2 - 12, ay + 12, 24, 4);

  // Hints
  pixelText('P:暂停  M:静音  L:排行', W / 2, H / 2 + 30, 11, 'rgba(255,255,255,0.6)');
  pixelText('或点击下方按钮', W / 2, H / 2 + 48, 11, 'rgba(255,255,255,0.5)');
}

function drawGameOver() {
  // Overlay
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  if (!scoreSubmitted) {
    // Show basic game over panel while name input is pending
    pixelBox(W / 2 - 120, H / 2 - 100, 240, 200, '#2D3436', '#E17055');
    pixelText('游戏结束', W / 2, H / 2 - 55, 26, '#FF4444');
    pixelText(`得分: ${score}`, W / 2, H / 2 - 10, 16, '#FFF');
    pixelText(`最高: ${bestScore}`, W / 2, H / 2 + 20, 16, '#FFD700');
    pixelBox(W / 2 - 70, H / 2 + 50, 140, 36, '#6C5CE7');
    pixelText('点击重新开始', W / 2, H / 2 + 74, 13, '#FFF');
  } else {
    // Show leaderboard
    const panelH = 340;
    pixelBox(W / 2 - 120, 20, 240, panelH, '#2D3436', '#E17055');
    pixelText('排行榜 Top 10', W / 2, 48, 16, '#FFD700');

    // Header
    pixelText('排名  昵称    分数', W / 2, 72, 10, '#888');

    // Entries
    const top10 = leaderboard.slice(0, 10);
    for (let i = 0; i < top10.length; i++) {
      const y = 92 + i * 22;
      const r = top10[i];
      const rank = `${i + 1}.`.padStart(3);
      const name = r.name.padEnd(4).slice(0, 4);
      const sc = String(r.score).padStart(4);
      const isMe = r.score === score && r.name === lastSubmittedName;
      const color = isMe ? '#FFD700' : (i < 3 ? '#FF8800' : '#CCC');
      pixelText(`${rank}  ${name}  ${sc}`, W / 2, y, 12, color);
    }

    if (top10.length === 0) {
      pixelText('暂无记录', W / 2, 120, 12, '#666');
    }

    // Restart button
    pixelBox(W / 2 - 70, panelH - 10, 140, 36, '#6C5CE7');
    pixelText('点击重新开始', W / 2, panelH + 14, 13, '#FFF');
  }
}

function drawSpeedIndicator() {
  const totalSpeed = minSpeedMultiplier + speedBonus / 100;
  if (totalSpeed <= 1.0) return;
  const color = totalSpeed >= 4.0 ? '#FF4444' : totalSpeed >= 2.5 ? '#FF8800' : '#FFD700';
  pixelText(`x${totalSpeed.toFixed(1)}`, W - 10, 30, 14, color, 'right');
}

function drawShieldBanner() {
  if (shieldBannerTimer <= 0) return;
  // Fade in/out
  const fadeMs = 300;
  let alpha = 1;
  if (shieldBannerTimer > SHIELD_BANNER_DURATION - fadeMs) {
    alpha = (SHIELD_BANNER_DURATION - shieldBannerTimer) / fadeMs;
  } else if (shieldBannerTimer < fadeMs) {
    alpha = shieldBannerTimer / fadeMs;
  }
  ctx.globalAlpha = alpha;
  // Banner background
  const bannerY = 8;
  const bannerH = 32;
  ctx.fillStyle = 'rgba(108,92,231,0.85)';
  ctx.fillRect(0, bannerY, W, bannerH);
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(0, bannerY, W, 2);
  ctx.fillRect(0, bannerY + bannerH - 2, W, 2);
  // Banner text
  pixelText('76个账号的力量保护了你，继续飞翔吧！', W / 2, bannerY + bannerH / 2 + 5, 12, '#FFF');
  ctx.globalAlpha = 1;
}

// UI buttons: Pause (top-left), Mute (next to pause), Leaderboard (next to mute)
const BTN_SIZE = 32;
const PAUSE_BTN = { x: 8, y: H - 42 };
const MUTE_BTN = { x: 48, y: H - 42 };
const LB_BTN = { x: 88, y: H - 42 };
const SKIP_BTN = { x: 128, y: H - 42 };

function drawUIButtons() {
  const bx = PAUSE_BTN.x, by = PAUSE_BTN.y, s = BTN_SIZE;

  // Pause button (pixel block)
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(bx, by, s, s);
  ctx.fillStyle = '#FFF';
  if (gameState === 'paused') {
    // Play: pixel triangle
    for (let i = 0; i < 10; i++) {
      ctx.fillRect(bx + 8 + i * 2, by + 6 + i * 2, 2, 20 - i * 4);
    }
  } else {
    // Pause: two pixel bars
    ctx.fillRect(bx + 8, by + 6, 6, 20);
    ctx.fillRect(bx + 18, by + 6, 6, 20);
  }

  // Mute button (pixel block)
  const mx = MUTE_BTN.x;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(mx, by, s, s);
  ctx.fillStyle = muted ? '#FF4444' : '#FFF';
  // Pixel speaker
  ctx.fillRect(mx + 6, by + 10, 6, 12);
  ctx.fillRect(mx + 12, by + 8, 2, 4);
  ctx.fillRect(mx + 14, by + 6, 2, 4);
  ctx.fillRect(mx + 16, by + 4, 2, 4);
  ctx.fillRect(mx + 12, by + 20, 2, 4);
  ctx.fillRect(mx + 14, by + 22, 2, 4);
  ctx.fillRect(mx + 16, by + 24, 2, 4);
  ctx.fillRect(mx + 18, by + 4, 2, 24);
  // Mute X
  if (muted) {
    ctx.fillRect(mx + 22, by + 8, 2, 2);
    ctx.fillRect(mx + 24, by + 10, 2, 2);
    ctx.fillRect(mx + 26, by + 12, 2, 2);
    ctx.fillRect(mx + 28, by + 14, 2, 2);
    ctx.fillRect(mx + 28, by + 8, 2, 2);
    ctx.fillRect(mx + 26, by + 10, 2, 2);
    ctx.fillRect(mx + 24, by + 12, 2, 2);
    ctx.fillRect(mx + 22, by + 14, 2, 2);
  }

  // Leaderboard button (pixel trophy)
  const lx = LB_BTN.x;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(lx, by, s, s);
  ctx.fillStyle = showLeaderboard ? '#FFD700' : '#FFF';
  // Trophy cup
  ctx.fillRect(lx + 10, by + 6, 12, 10);
  ctx.fillRect(lx + 8, by + 8, 16, 6);
  // Trophy stem
  ctx.fillRect(lx + 14, by + 16, 4, 4);
  // Trophy base
  ctx.fillRect(lx + 10, by + 20, 12, 4);

  // Skip to boss button (pixel fast-forward) — only show before boss
  if (bossPhase === 'none' && score < 76) {
    const sx = SKIP_BTN.x;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(sx, by, s, s);
    ctx.fillStyle = '#FF8800';
    // Fast-forward: two triangles
    ctx.fillRect(sx + 6, by + 8, 2, 2);
    ctx.fillRect(sx + 8, by + 10, 2, 2);
    ctx.fillRect(sx + 10, by + 12, 2, 2);
    ctx.fillRect(sx + 8, by + 14, 2, 2);
    ctx.fillRect(sx + 6, by + 16, 2, 2);
    ctx.fillRect(sx + 14, by + 8, 2, 2);
    ctx.fillRect(sx + 16, by + 10, 2, 2);
    ctx.fillRect(sx + 18, by + 12, 2, 2);
    ctx.fillRect(sx + 16, by + 14, 2, 2);
    ctx.fillRect(sx + 14, by + 16, 2, 2);
    // "BOSS" label below
    ctx.font = 'bold 7px monospace';
    ctx.fillStyle = '#FF8800';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', sx + s / 2, by + s + 10);
  }
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  pixelBox(W / 2 - 120, H / 2 - 80, 240, 220, '#2D3436', '#E17055');

  pixelText('暂 停', W / 2, H / 2 - 30, 28, '#FFF');

  // Continue button
  pixelBox(W / 2 - 80, H / 2 + 10, 160, 44, '#6C5CE7');
  pixelText('继 续', W / 2, H / 2 + 38, 18, '#FFF');

  // Retry button
  pixelBox(W / 2 - 80, H / 2 + 70, 160, 44, '#E17055');
  pixelText('重 试', W / 2, H / 2 + 98, 18, '#FFF');

  // Mute button in pause overlay
  const mx = W / 2 + 100, my = H / 2 - 80;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(mx, my, 32, 32);
  ctx.fillStyle = muted ? '#FF4444' : '#FFF';
  // Speaker icon
  ctx.fillRect(mx + 6, my + 10, 6, 12);
  ctx.fillRect(mx + 12, my + 8, 2, 4);
  ctx.fillRect(mx + 14, my + 6, 2, 4);
  ctx.fillRect(mx + 16, my + 4, 2, 4);
  ctx.fillRect(mx + 12, my + 20, 2, 4);
  ctx.fillRect(mx + 14, my + 22, 2, 4);
  ctx.fillRect(mx + 16, my + 24, 2, 4);
  ctx.fillRect(mx + 18, my + 4, 2, 24);
  // Mute X
  if (muted) {
    ctx.fillRect(mx + 22, my + 8, 2, 2);
    ctx.fillRect(mx + 24, my + 10, 2, 2);
    ctx.fillRect(mx + 26, my + 12, 2, 2);
    ctx.fillRect(mx + 28, my + 14, 2, 2);
    ctx.fillRect(mx + 28, my + 8, 2, 2);
    ctx.fillRect(mx + 26, my + 10, 2, 2);
    ctx.fillRect(mx + 24, my + 12, 2, 2);
    ctx.fillRect(mx + 22, my + 14, 2, 2);
  }
}

function drawCountdown() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  const sec = Math.ceil(countdownMs / 1000);
  pixelText(sec, W / 2, H / 2 + 20, 72, '#FFD700');
}

function drawLeaderboardOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  const panelH = 380;
  pixelBox(W / 2 - 130, 30, 260, panelH, '#2D3436', '#FFD700');
  pixelText('排行榜 Top 10', W / 2, 60, 18, '#FFD700');

  // Header
  pixelText('排名  昵称    分数', W / 2, 88, 10, '#888');

  // Entries
  const top10 = leaderboard.slice(0, 10);
  for (let i = 0; i < top10.length; i++) {
    const y = 110 + i * 24;
    const r = top10[i];
    const rank = `${i + 1}.`.padStart(3);
    const name = r.name.padEnd(4).slice(0, 4);
    const sc = String(r.score).padStart(4);
    const color = i < 3 ? '#FF8800' : '#CCC';
    pixelText(`${rank}  ${name}  ${sc}`, W / 2, y, 12, color);
  }

  if (top10.length === 0) {
    pixelText('暂无记录', W / 2, 140, 12, '#666');
  }

  // Close button
  pixelBox(W / 2 - 60, panelH - 10, 120, 36, '#6C5CE7');
  pixelText('关 闭', W / 2, panelH + 14, 14, '#FFF');
}
