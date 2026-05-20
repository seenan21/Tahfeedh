import { Router } from 'express';
import { env } from '../env.js';
import { verifyUser, AuthError } from '../auth/verifyUser.js';
import { getUserAccessToken } from '../qf/userTokens.js';
import { supabaseAdmin } from '../supabase.js';

export const qfUserRouter = Router();

interface QfStreakResponse {
  data?: Array<{
    id?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    status?: string;
    days?: number;
  }>;
  success?: boolean;
}

// =====================================================================
// GET /api/qf-user/streak
// Returns the user's QF "QURAN" streak count, used by the Today
// StreakBadge to replace the local daily_streak value when connected.
// Defensive: on any non-2xx or shape mismatch, returns connected:true,
// error:true so the frontend falls back to local.
// =====================================================================
qfUserRouter.get('/streak', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    const token = await getUserAccessToken(user.id);
    if (!token) {
      res.json({ connected: false });
      return;
    }

    const url = `${env.qfApiUrl}/auth/v1/streaks`;
    const resp = await fetch(url, {
      headers: {
        'x-auth-token': token,
        'x-client-id': env.qfClientId,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn(`[qf-user streak] non-OK ${resp.status} for user ${user.id}: ${text}`);
      res.json({ connected: true, error: true });
      return;
    }
    const json = (await resp.json()) as QfStreakResponse;
    const streaks = json.data ?? [];
    // Pick the most active QURAN streak. Fallback to the first row.
    const active =
      streaks.find((s) => (s.type === 'QURAN' || !s.type) && s.status === 'ACTIVE') ??
      streaks[0];
    res.json({
      connected: true,
      days: active?.days ?? 0,
      type: active?.type ?? null,
      status: active?.status ?? null,
      startDate: active?.startDate ?? null,
      endDate: active?.endDate ?? null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// =====================================================================
// Goals proxy — POST/PATCH/DELETE pass-through to QF Goals API.
// The local `goal` table is the source of truth; QF calls are
// best-effort. Frontend updates qf_goal_id on the local row after a
// successful create.
// =====================================================================

interface GoalCreatePayload {
  title: string;
  target_pages: number;
  target_date: string; // YYYY-MM-DD
}

qfUserRouter.post('/goals', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    const body = req.body as Partial<GoalCreatePayload>;
    if (!body.title || typeof body.target_pages !== 'number' || !body.target_date) {
      res.status(400).json({ error: 'title, target_pages, target_date required' });
      return;
    }

    const token = await getUserAccessToken(user.id);
    if (!token) {
      // Not connected — return null qf_goal_id so the frontend keeps the
      // local row without a remote pairing.
      res.json({ connected: false, qf_goal_id: null });
      return;
    }

    // Defensive payload — QF goal shape is light on public docs; we send
    // a reasonable set of fields and let QF ignore unknown ones.
    const qfBody = {
      title: body.title,
      target_pages: body.target_pages,
      target_date: body.target_date,
      type: 'MEMORIZATION',
    };

    const url = `${env.qfApiUrl}/auth/v1/goals`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'x-auth-token': token,
        'x-client-id': env.qfClientId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(qfBody),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn(`[qf-user goals POST] non-OK ${resp.status} for user ${user.id}: ${text}`);
      res.json({ connected: true, error: true, qf_goal_id: null });
      return;
    }
    const json = (await resp.json()) as { data?: { id?: string }; id?: string };
    const qfGoalId = json.data?.id ?? json.id ?? null;
    res.json({ connected: true, qf_goal_id: qfGoalId });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

qfUserRouter.delete('/goals/:qfGoalId', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    const qfGoalId = req.params.qfGoalId;
    const token = await getUserAccessToken(user.id);
    if (!token) {
      res.json({ connected: false });
      return;
    }
    const url = `${env.qfApiUrl}/auth/v1/goals/${encodeURIComponent(qfGoalId)}`;
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-auth-token': token,
        'x-client-id': env.qfClientId,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.warn(`[qf-user goals DELETE] non-OK ${resp.status}: ${text}`);
      res.json({ connected: true, error: true });
      return;
    }
    res.json({ connected: true, ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// Marker to acknowledge supabaseAdmin import is intentionally kept for
// future endpoints that need server-side DB reads (e.g. cross-checking
// goal ownership). Currently unused here.
void supabaseAdmin;
