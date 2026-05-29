const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Responsive sizing
const W = 400, H = 600;
canvas.width = W;
canvas.height = H;

function resizeCanvas() {
  const ratio = W / H;
  let cw = window.innerWidth;
  let ch = window.innerHeight;
  if (cw / ch > ratio) {
    cw = ch * ratio;
  } else {
    ch = cw / ratio;
  }
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Audio context for sound effects
let audioCtx;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(freq, type, duration, vol=0.3) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function flapSound() { playSound(600, 'square', 0.1, 0.2); }
function scoreSound() { playSound(880, 'sine', 0.15, 0.3); setTimeout(() => playSound(1100, 'sine', 0.2, 0.3), 100); }
function hitSound() { playSound(200, 'sawtooth', 0.3, 0.4); setTimeout(() => playSound(100, 'sawtooth', 0.4, 0.3), 150); }

// Boss battle sound effects
function playerShootSound() { playSound(900, 'square', 0.06, 0.12); }
function playerLaserSound() { playSound(1200, 'sawtooth', 0.08, 0.08); }
function bossLaserWarnSound() { playSound(300, 'square', 0.15, 0.15); setTimeout(() => playSound(300, 'square', 0.15, 0.15), 200); }
function bossLaserFireSound() { playSound(150, 'sawtooth', 0.5, 0.2); setTimeout(() => playSound(100, 'sawtooth', 0.4, 0.15), 100); }
function bossDiamondSound() { playSound(500, 'triangle', 0.12, 0.15); }

// BGM
const bgm = new Audio('bgm.mp3');
bgm.loop = true;
bgm.volume = 0.3;
let bgmStarted = false;
function startBGM() {
  if (!bgmStarted) {
    bgm.play().catch(() => {});
    bgmStarted = true;
  }
}

// Bird sprite
const birdImg = new Image();
birdImg.src = 'sliver_wolf_lv999.png';

// Boss sprite
const bossImg = new Image();
bossImg.src = 'The_Herta_Boss.png';

// Herta puppet sprite
const puppetImg = new Image();
puppetImg.src = 'herta_figure.png';

// Boss dialogue JSON
let bossDialogue = null;
fetch('boss_dialogue.json').then(r => r.json()).then(d => { bossDialogue = d; }).catch(() => {});

// Game state — all timing in milliseconds
const GRAVITY = 0.14;       // per-frame normalized (see dtFactor)
const FLAP = -3.7;          // per-frame normalized
const PIPE_WIDTH = 60;
const PIPE_GAP = 170;
const PIPE_SPEED = 2.2;     // per-frame normalized
const BIRD_SIZE = 20;
const MS_PER_FRAME = 16.67; // 60fps baseline for physics normalization
const GAME_SPEED = 1.4;     // overall speed multiplier

// Timers in milliseconds
const INVINCIBLE_MS = 3000;
const DEAD_DELAY_MS = 500;
const PIPE_BASE_INTERVAL_MS = 1100;   // ~66 frames
const PIPE_EXTRA_INTERVAL_MS = 1000;  // ~60 frames max extra
const PIPE_MAX_INTERVAL_MS = 2200;    // max gap between pipes

let bird, pipes, score, bestScore = 0, gameState;
let scoreSubmitted = false;
let lastSubmittedName = '';
const MAX_LIVES = 4;
const INITIAL_LIVES = 3;
let lives, invincibleTimerMs;
let tempExtraLives = 0; // temporary extra lives from heart power-ups at full HP
let speedBonus = 0; // 0–300, percentage bonus on pipe speed
let scoreSinceReset = 0; // points gained since last speed reset
let minSpeedMultiplier = 1.0; // minimum speed multiplier after 76 pipes
let maxSpeedBonus = 300; // maximum speed bonus
let particles = [];
let speedLines = [];
let muted = false;
let countdownMs = 0; // countdown before resume
let showLeaderboard = false;

// ===== Boss Battle System =====
let bossPhase = 'none'; // none | warning | clearing | dialogue | fight | victory | defeat
let bossWarningTimer = 0;
let bossDialogueIndex = 0;
let bossDialogueLineIndex = 0;
let bossDialogueCharTimer = 0;
let bossDialogueFullText = '';
let bossDialogueDisplayedText = '';
let bossDialogueAdvanceReady = false;

// Boss state
let boss = null; // { x, y, hp, maxHp, phase, timer, attackTimer, moveTimer, moveDir }
const BOSS_MAX_HP = 300;
const BOSS_WIDTH = 120;
const BOSS_HEIGHT = 140;

// Player bullets
let playerBullets = []; // { x, y, vx, vy, type: 'ray'|'laser'|'split', size }
let playerShootTimer = 0;
const PLAYER_SHOOT_INTERVAL = 300; // ms
const PLAYER_LASER_DURATION = 5000; // ms

// Boss projectiles
let bossProjectiles = []; // { x, y, vx, vy, type: 'laser'|'diamond', size, life }

// Power-ups
let powerUps = []; // { x, y, vy, type, size }
let powerUpSpawnTimer = 0;
const POWERUP_SPAWN_INTERVAL = 4000; // ms

// Active power-up effects
let activeEffects = {
  bulletTime: 0,      // remaining ms
  laserWeapon: 0,     // remaining ms
  bulletSplit: 0,     // remaining ms
  bulletTracking: 0,  // remaining ms
};

// Boss damage flash
let bossDamageFlash = 0;

// Player weapon type (normal | laser)
let playerWeapon = 'normal';

// Half-heart HP system for boss fight (max = lives * 2)
let playerHP = 6;
let maxPlayerHP = 6; // actual max including temp lives
const MAX_HP = 6; // 3 hearts * 2

// Laser warning system
let laserWarnings = []; // { y, timer, duration }
const LASER_WARN_DURATION = 1500; // ms warning before firing

// Player laser beam (continuous beam when laser weapon active)
let playerLaserActive = false;
let playerLaserHitTimer = 0;

// Herta puppets
let puppets = []; // { x, y, vy, hp, timer, attackTimer, moveDir }
const PUPPET_WIDTH = 50;
const PUPPET_HEIGHT = 60;
const PUPPET_SPAWN_INTERVAL = 8000; // ms
const PUPPET_MAX = 3;
let puppetSpawnTimer = 0;

// Boss entrance animation
let bossEntranceY = -BOSS_HEIGHT; // starts above screen
let bossEntranceDone = false;

// Invincible zone hit banner
let shieldBannerTimer = 0;
const SHIELD_BANNER_DURATION = 2000; // ms

let targetGapY = H / 2;
let lastPipeGapY = H / 2;
let pipeSpawnTimerMs = 0;
let pipeSpawnIntervalMs = PIPE_BASE_INTERVAL_MS;

// Timing
let lastTime = 0;
let now = 0;       // total elapsed ms
let deadTimerMs = 0;

function resetGame() {
  bird = { x: 80, y: H / 2, vy: 0, rotation: 0 };
  pipes = [];
  score = 0;
  gameState = 'ready';
  targetGapY = H / 2;
  lastPipeGapY = H / 2;
  pipeSpawnTimerMs = 0;
  pipeSpawnIntervalMs = PIPE_BASE_INTERVAL_MS;
  lives = INITIAL_LIVES;
  tempExtraLives = 0;
  invincibleTimerMs = 0;
  deadTimerMs = 0;
  speedBonus = 0;
  scoreSinceReset = 0;
  minSpeedMultiplier = 1.0;
  maxSpeedBonus = 300;
  particles = [];
  speedLines = [];
  countdownMs = 0;
  scoreSubmitted = false;
  lastSubmittedName = '';
  // Boss reset
  bossPhase = 'none';
  bossWarningTimer = 0;
  bossDialogueIndex = 0;
  bossDialogueLineIndex = 0;
  bossDialogueCharTimer = 0;
  bossDialogueFullText = '';
  bossDialogueDisplayedText = '';
  bossDialogueAdvanceReady = false;
  boss = null;
  playerBullets = [];
  playerShootTimer = 0;
  bossProjectiles = [];
  powerUps = [];
  powerUpSpawnTimer = 0;
  activeEffects = { bulletTime: 0, laserWeapon: 0, bulletSplit: 0, bulletTracking: 0 };
  bossDamageFlash = 0;
  playerWeapon = 'normal';
  playerHP = MAX_HP;
  maxPlayerHP = MAX_HP;
  laserWarnings = [];
  bossEntranceY = -BOSS_HEIGHT;
  bossEntranceDone = false;
  shieldBannerTimer = 0;
  puppets = [];
  laserWarnings = [];
  puppetSpawnTimer = 0;
  playerLaserActive = false;
  playerLaserHitTimer = 0;
}

resetGame();

function skipToBoss() {
  score = 76;
  pipes = [];
  speedBonus = 0;
  scoreSinceReset = 0;
  bossPhase = 'warning';
  bossWarningTimer = 0;
}

// Input
function handleFlap() {
  initAudio();
  startBGM();
  if (gameState === 'ready') {
    gameState = 'playing';
    bird.vy = FLAP;
    flapSound();
  } else if (gameState === 'playing') {
    bird.vy = FLAP;
    flapSound();
  } else if (gameState === 'dead' && deadTimerMs > DEAD_DELAY_MS && !nameInputEl.classList.contains('show')) {
    resetGame();
  }
}

function handleCanvasClick(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  // Boss dialogue — click to advance
  if (bossPhase === 'dialogue' || bossPhase === 'victory' || bossPhase === 'defeat') {
    handleBossDialogueAdvance();
    return;
  }

  // Pause button hit
  if (mx >= PAUSE_BTN.x && mx <= PAUSE_BTN.x + BTN_SIZE &&
      my >= PAUSE_BTN.y && my <= PAUSE_BTN.y + BTN_SIZE) {
    if (gameState === 'playing') {
      gameState = 'paused';
    } else if (gameState === 'paused') {
      gameState = 'countdown';
      countdownMs = 3000;
    }
    return;
  }

  // Mute button hit
  if (mx >= MUTE_BTN.x && mx <= MUTE_BTN.x + BTN_SIZE &&
      my >= MUTE_BTN.y && my <= MUTE_BTN.y + BTN_SIZE) {
    muted = !muted;
    bgm.muted = muted;
    return;
  }

  // Leaderboard button hit
  if (mx >= LB_BTN.x && mx <= LB_BTN.x + BTN_SIZE &&
      my >= LB_BTN.y && my <= LB_BTN.y + BTN_SIZE) {
    showLeaderboard = !showLeaderboard;
    if (showLeaderboard) {
      fetchLeaderboard();
      if (gameState === 'playing') {
        gameState = 'paused';
      }
    }
    return;
  }

  // Skip to boss button hit
  if (mx >= SKIP_BTN.x && mx <= SKIP_BTN.x + BTN_SIZE &&
      my >= SKIP_BTN.y && my <= SKIP_BTN.y + BTN_SIZE) {
    if (gameState === 'playing' && bossPhase === 'none' && score < 76) {
      skipToBoss();
    }
    return;
  }

  // Leaderboard overlay close button
  if (showLeaderboard) {
    const cbx = W / 2 - 60, cby = 370, cbw = 120, cbh = 36;
    if (mx >= cbx && mx <= cbx + cbw && my >= cby && my <= cby + cbh) {
      showLeaderboard = false;
      return;
    }
    return; // consume click when overlay is open
  }

  // Pause overlay buttons
  if (gameState === 'paused') {
    const cbx = W / 2 - 80, cby = H / 2 + 10, cbw = 160, cbh = 44;
    if (mx >= cbx && mx <= cbx + cbw && my >= cby && my <= cby + cbh) {
      gameState = 'countdown';
      countdownMs = 3000;
      return;
    }
    const rbx = W / 2 - 80, rby = H / 2 + 70, rbw = 160, rbh = 44;
    if (mx >= rbx && mx <= rbx + rbw && my >= rby && my <= rby + rbh) {
      resetGame();
      gameState = 'playing';
      return;
    }
    // Mute button in pause overlay
    const pmx = W / 2 + 100, pmy = H / 2 - 80;
    if (mx >= pmx && mx <= pmx + 32 && my >= pmy && my <= pmy + 32) {
      muted = !muted;
      bgm.muted = muted;
      return;
    }
    return;
  }

  handleFlap();
}

canvas.addEventListener('click', handleCanvasClick);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleCanvasClick(e.touches[0]); });
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    // Boss dialogue — space to advance
    if (bossPhase === 'dialogue' || bossPhase === 'victory' || bossPhase === 'defeat') {
      handleBossDialogueAdvance();
    } else {
      handleFlap();
    }
  }
  if (e.code === 'Enter' || e.code === 'KeyZ') {
    if (bossPhase === 'dialogue' || bossPhase === 'victory' || bossPhase === 'defeat') handleBossDialogueAdvance();
  }
  if (e.code === 'KeyM') { muted = !muted; bgm.muted = muted; }
  if (e.code === 'KeyL') { showLeaderboard = !showLeaderboard; if (showLeaderboard) fetchLeaderboard(); }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (gameState === 'playing') {
      gameState = 'paused';
    } else if (gameState === 'paused') {
      gameState = 'countdown';
      countdownMs = 3000;
    }
  }
});
