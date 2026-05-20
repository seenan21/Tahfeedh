import { Router } from 'express';
import crypto from 'node:crypto';
import { env } from '../env.js';
import { verifyUser, AuthError } from '../auth/verifyUser.js';
import { writeUserTokenRow, deleteUserTokenRow, readUserTokenRow } from '../qf/userTokens.js';

export const qfAuthRouter = Router();

const SCOPES = [
  'openid',
  'offline_access',
  'profile',
  'bookmark',
  'goal',
  'streak.read',
  'reading_session.create',
];

const REDIRECT_URI = `${env.serverBaseUrl}/api/qf-auth/callback`;

// =====================================================================
// Stateless OAuth state encoding.
// We avoid cookies for the PKCE verifier so the flow survives the
// localhost-cross-origin HTTP dev limitation (SameSite=None requires
// Secure, which doesn't work over HTTP). Instead we HMAC-sign a JSON
// payload {userId, verifier, exp, nonce} and pass it as the `state` query
// param. QF echoes it back to the callback, where we verify the HMAC and
// extract the verifier.
// =====================================================================

interface StatePayload {
  userId: string;
  verifier: string;
  exp: number; // epoch ms
  nonce: string;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function signState(payload: StatePayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = crypto.createHmac('sha256', env.sessionSecret).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

function verifyState(state: string): StatePayload | null {
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', env.sessionSecret).update(body).digest();
  const providedSig = fromB64Url(sig);
  if (expectedSig.length !== providedSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;
  try {
    const payload = JSON.parse(fromB64Url(body).toString('utf8')) as StatePayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function makePkcePair(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// =====================================================================
// POST /api/qf-auth/authorize
// Bearer-protected. Returns the QF authorization URL the browser should
// navigate to. The PKCE verifier is encoded in the signed `state` param.
// =====================================================================
qfAuthRouter.post('/authorize', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    const { verifier, challenge } = makePkcePair();
    const state = signState({
      userId: user.id,
      verifier,
      exp: Date.now() + 10 * 60 * 1000, // 10 min
      nonce: b64url(crypto.randomBytes(16)),
    });

    const url = new URL(`${env.qfAuthUrl}/oauth2/auth`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', env.qfClientId);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('state', state);

    res.json({ url: url.toString() });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// =====================================================================
// GET /api/qf-auth/callback
// Browser-redirect endpoint. Validates state, exchanges code + verifier,
// upserts qf_user_token, redirects to the web app's /today with a flag.
// =====================================================================
qfAuthRouter.get('/callback', async (req, res) => {
  const code = String(req.query.code ?? '');
  const state = String(req.query.state ?? '');
  const errorParam = req.query.error ? String(req.query.error) : null;

  const failRedirect = (reason: string) => {
    const url = new URL(`${env.webOrigin}/today`);
    url.searchParams.set('qf', 'error');
    url.searchParams.set('qf_reason', reason);
    res.redirect(url.toString());
  };

  if (errorParam) {
    return failRedirect(errorParam);
  }
  if (!code || !state) {
    return failRedirect('missing_code_or_state');
  }

  const payload = verifyState(state);
  if (!payload) {
    return failRedirect('invalid_state');
  }

  try {
    const basic = Buffer.from(`${env.qfClientId}:${env.qfClientSecret}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: payload.verifier,
      client_id: env.qfClientId,
    });
    const tokenRes = await fetch(`${env.qfAuthUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('[qf-auth callback] token exchange failed:', tokenRes.status, text);
      return failRedirect('token_exchange_failed');
    }
    const json = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope?: string;
    };
    const expiresAt = new Date(Date.now() + json.expires_in * 1000);
    await writeUserTokenRow({
      userId: payload.userId,
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt,
      scope: json.scope ?? null,
    });

    const success = new URL(`${env.webOrigin}/today`);
    success.searchParams.set('qf', 'connected');
    res.redirect(success.toString());
  } catch (err) {
    console.error('[qf-auth callback] unexpected error:', err);
    failRedirect('server_error');
  }
});

// =====================================================================
// GET /api/qf-auth/status
// Returns whether the caller has an active qf_user_token row, plus the
// (non-secret) expiry and scope. Avoids granting client SELECT on
// qf_user_token directly — the table stays service-role-only per ADR 0040
// (and migration 0008's original RLS posture).
// =====================================================================
qfAuthRouter.get('/status', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    const row = await readUserTokenRow(user.id);
    if (!row) {
      res.json({ connected: false });
      return;
    }
    res.json({
      connected: true,
      expires_at: row.expires_at,
      scope: row.scope,
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
// POST /api/qf-auth/disconnect
// =====================================================================
qfAuthRouter.post('/disconnect', async (req, res, next) => {
  try {
    const user = await verifyUser(req);
    await deleteUserTokenRow(user.id);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    next(err);
  }
});
