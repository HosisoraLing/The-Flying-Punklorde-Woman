const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 2333;

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

// Rate limiting: IP -> last submit timestamp
const lastSubmit = new Map();
const RATE_LIMIT_MS = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname, { index: 'index.html' }));

// Redirect root to index.html
app.get('/', (req, res) => res.redirect('/index.html'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// Submit score
app.post('/api/score', (req, res) => {
  const { name, score } = req.body;

  // Validate
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 8) {
    return res.status(400).json({ error: '昵称需1-8个字符' });
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
  insertScore.run(name.trim(), score);
  res.json({ ok: true });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  const rows = topScores.all();
  res.json(rows);
});

// Cleanup rate limit map every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of lastSubmit) {
    if (now - ts > 60000) lastSubmit.delete(ip);
  }
}, 60000);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
