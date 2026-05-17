import { Router } from 'express';
import { listChapters, searchAyahs } from '../qf/content.js';

export const qfRouter = Router();

qfRouter.get('/chapters', async (_req, res, next) => {
  try {
    const data = await listChapters();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

qfRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.status(400).json({ error: 'q is required' });
      return;
    }
    const size = req.query.size ? Math.min(parseInt(String(req.query.size), 10) || 10, 50) : 10;
    const data = await searchAyahs(q, size);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
