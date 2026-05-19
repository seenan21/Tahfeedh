import { Router } from 'express';
import { markMemorizationSchema, type QuranIndex } from '@tahfeedh/shared';
import { verifyUser, AuthError } from '../auth/verifyUser.js';
import { supabaseAdmin } from '../supabase.js';
import { expandPageAyahs, isAyahOnPage } from '../memorization/pageAyahs.js';
import quranIndexJson from '../data/quran-index.json' with { type: 'json' };

const quranIndex = quranIndexJson as unknown as QuranIndex;

export const memorizationRouter = Router();

memorizationRouter.post('/mark', async (req, res, next) => {
  try {
    const user = await verifyUser(req);

    const parsed = markMemorizationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid payload', details: parsed.error.flatten() });
      return;
    }

    const { pageNumber, status, verses } = parsed.data;

    if (status === 'in_progress' && verses) {
      const offPage = verses.find((v) => !isAyahOnPage(pageNumber, v.surah, v.ayah, quranIndex));
      if (offPage) {
        res.status(400).json({
          error: `ayah ${offPage.surah}:${offPage.ayah} is not on page ${pageNumber}`,
        });
        return;
      }
    }

    const ayahsOnPage = expandPageAyahs(pageNumber, quranIndex);

    const sqlPayload = {
      pageNumber,
      status,
      ayahsOnPage,
      verses: status === 'in_progress' ? (verses ?? []) : [],
    };

    const { error } = await supabaseAdmin.rpc('mark_memorization', {
      p_student_id: user.id,
      p_payload: sqlPayload,
    });

    if (error) {
      console.error('[memorization] mark_memorization rpc failed', error);
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
