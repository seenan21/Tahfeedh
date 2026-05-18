import type { Request } from 'express';
import { supabaseAdmin } from '../supabase.js';

export interface VerifiedUser {
  id: string;
  email: string | null;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Verifies the `Authorization: Bearer <jwt>` header on the request by calling
 * Supabase Auth with the provided access token. Returns the resolved user id.
 *
 * Throws AuthError(401) if the header is missing or the token is rejected.
 */
export async function verifyUser(req: Request): Promise<VerifiedUser> {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) throw new AuthError('missing Authorization header');

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new AuthError('Authorization header must be Bearer <token>');

  const token = (match[1] ?? '').trim();
  if (!token) throw new AuthError('Authorization header must be Bearer <token>');
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new AuthError('invalid or expired token');

  return { id: data.user.id, email: data.user.email ?? null };
}
