import { Router } from 'express';
import { onboardingFinishSchema, type QuranIndex } from '@tahfeedh/shared';
import { verifyUser, AuthError } from '../auth/verifyUser.js';
import { supabaseAdmin } from '../supabase.js';
import { expandSelections } from '../onboarding/expand.js';
import quranIndexJson from '../data/quran-index.json' with { type: 'json' };

// The JSON is inferred as a structural literal; the index types use tuples
// and Record<string, …> shapes, so we cast once at the boundary.
const quranIndex = quranIndexJson as unknown as QuranIndex;

export const onboardingRouter = Router();

onboardingRouter.post('/finish', async (req, res, next) => {
  try {
    const user = await verifyUser(req);

    const parsed = onboardingFinishSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid payload', details: parsed.error.flatten() });
      return;
    }

    const payload = expandSelections(parsed.data, quranIndex);

    const { error } = await supabaseAdmin.rpc('commit_onboarding', {
      p_student_id: user.id,
      p_payload: payload,
    });
    if (error) {
      console.error('[onboarding] commit_onboarding rpc failed', error);
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
