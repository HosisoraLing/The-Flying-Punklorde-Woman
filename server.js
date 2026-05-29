const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 2333;

app.disable('x-powered-by');

// Clear cached HSTS (temporary, remove after all users cleared)
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=0');
  next();
});

// Trust proxy (for correct req.ip behind reverse proxy)
app.set('trust proxy', 1);

// Database
const db = new Database(path.join(__dirname, 'leaderboard.db'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
`);

const insertScore = db.prepare('INSERT INTO scores (name, score) VALUES (?, ?)');
const topScores = db.prepare('SELECT name, score, created_at FROM scores ORDER BY score DESC LIMIT 50');

// Rate limiting: IP -> last submit timestamp (bounded)
const lastSubmit = new Map();
const RATE_LIMIT_MS = 3000;
const MAX_RATE_ENTRIES = 10000;

// Middleware
app.use(express.json({ limit: '1kb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

// Health check (no uptime leak)
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Submit score
app.post('/api/score', (req, res) => {
  const { name, score } = req.body;

  // Validate
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 8) {
    return res.status(400).json({ error: '昵称需1-8个字符' });
  }
  // Only allow alphanumeric, Chinese characters, spaces, and common punctuation
  if (!/^[\w\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\s.,!?-]+$/.test(name) || name.trim().length === 0) {
    return res.status(400).json({ error: '昵称包含非法字符' });
  }
  if (typeof score !== 'number' || score < 0 || score > 9999 || !Number.isInteger(score)) {
    return res.status(400).json({ error: '分数无效' });
  }

  // Rate limit
  const ip = req.ip;
  const now = Date.now();
  if (lastSubmit.has(ip) && now - lastSubmit.get(ip) < RATE_LIMIT_MS) {
    return res.status(429).json({ error: '提交太频繁，请稍后再试' });
  }
  lastSubmit.set(ip, now);

  // Insert
  try {
    insertScore.run(name.trim(), score);
    res.json({ ok: true });
  } catch (err) {
    console.error('Database write error:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const rows = topScores.all();
  res.json(rows);
});

// Cleanup rate limit map every minute + enforce max size
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of lastSubmit) {
    if (now - ts > 60000) lastSubmit.delete(ip);
  }
  if (lastSubmit.size > MAX_RATE_ENTRIES) {
    const entries = [...lastSubmit.entries()].sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < entries.length - MAX_RATE_ENTRIES; i++) {
      lastSubmit.delete(entries[i][0]);
    }
  }
}, 60000);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  db.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
