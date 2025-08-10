
/* eslint-disable no-console */
const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const multer = require('multer');
const morgan = require('morgan');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '104857600', 10); // 100MB
const PUBLIC_DIR = path.join(__dirname, 'public');
const META_PATH = path.join(UPLOAD_DIR, 'metadata.json');

// Ensure dirs exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(META_PATH)) {
  fs.writeFileSync(META_PATH, JSON.stringify([]));
}

// Middlewares
app.use(morgan('dev'));

// Dev-only CORS (frontend dev at 5173). In production we serve static from same origin.
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: ['http://localhost:5173'], credentials: false }));
}

app.use(express.json());

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const id = uuidv4();
    const ext = path.extname(file.originalname) || '';
    const safeExt = ext.replace(/[^.a-zA-Z0-9]/g, '');
    cb(null, id + safeExt);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

function loadMeta() {
  try {
    const raw = fs.readFileSync(META_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load metadata.json, resetting.', e);
    fs.writeFileSync(META_PATH, JSON.stringify([]));
    return [];
  }
}

function saveMeta(list) {
  fs.writeFileSync(META_PATH, JSON.stringify(list, null, 2));
}

function getFileInfoById(id, list) {
  return list.find((f) => f.id === id) || null;
}

// API routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files || [];
    const meta = loadMeta();
    const now = new Date().toISOString();

    const saved = [];
    for (const f of files) {
      const id = path.parse(f.filename).name; // filename is id+ext
      const ext = path.extname(f.filename);
      const record = {
        id,
        originalName: f.originalname,
        storedName: f.filename,
        extension: ext,
        size: f.size,
        mime: f.mimetype || mime.lookup(f.originalname) || 'application/octet-stream',
        uploadedAt: now
      };
      meta.push(record);
      saved.push(record);
    }
    saveMeta(meta);
    res.status(201).json({ files: saved });
  } catch (err) {
    console.error(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Max ${MAX_FILE_SIZE} bytes.` });
    }
    res.status(500).json({ error: 'Upload failed.' });
  }
});

app.get('/api/files', async (req, res) => {
  const meta = loadMeta();
  // Sort newest first
  meta.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  res.json({ files: meta });
});

app.get('/api/files/:id', async (req, res) => {
  const meta = loadMeta();
  const file = getFileInfoById(req.params.id, meta);
  if (!file) return res.status(404).json({ error: 'Not found' });
  res.json(file);
});

app.get('/api/files/:id/download', async (req, res) => {
  const meta = loadMeta();
  const file = getFileInfoById(req.params.id, meta);
  if (!file) return res.status(404).json({ error: 'Not found' });

  const abs = path.join(UPLOAD_DIR, file.storedName);
  if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Missing file on disk' });

  res.setHeader('Content-Type', file.mime);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.originalName)}"`);
  fs.createReadStream(abs).pipe(res);
});

app.delete('/api/files/:id', async (req, res) => {
  const meta = loadMeta();
  const idx = meta.findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const file = meta[idx];
  const abs = path.join(UPLOAD_DIR, file.storedName);

  try {
    if (fs.existsSync(abs)) {
      await fsp.unlink(abs);
    }
    meta.splice(idx, 1);
    saveMeta(meta);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Serve static frontend (production build copied to server/public)
if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));

  // SPA fallback
  app.get('*', (req, res, next) => {
    // Only fallback for non-API routes
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
