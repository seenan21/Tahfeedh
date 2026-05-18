import { supabase } from './supabase';
import type { UserRole } from '@tahfeedh/shared';

export function formatAuthError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; error?: unknown; hint?: unknown; code?: unknown };
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error === 'string') return e.error;
    if (typeof e.hint === 'string') return e.hint;
    if (typeof e.code === 'string') return `Error code: ${e.code}`;
    try {
      return JSON.stringify(err);
    } catch {
      return 'Unknown error';
    }
  }
  return String(err);
}

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  onboardingComplete: boolean;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile, error } = await supabase
    .from('app_user')
    .select('id, role, display_name')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !profile) return null;

  let onboardingComplete = true;
  if (profile.role === 'student') {
    const { data: settings } = await supabase
      .from('student_settings')
      .select('onboarding_complete')
      .eq('student_id', profile.id)
      .maybeSingle();
    onboardingComplete = settings?.onboarding_complete ?? false;
  }

  return {
    id: profile.id,
    email: session.user.email ?? '',
    role: profile.role,
    displayName: profile.display_name,
    onboardingComplete,
  };
}

export async function signUpWithRole(params: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}): Promise<CurrentUser> {
  const { email, password, displayName, role } = params;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Signup did not return a user');
  if (!data.session) {
    throw new Error(
      'Signup succeeded but no session was returned — is email confirmation still enabled in Supabase?',
    );
  }

  const { error: insertError } = await supabase.from('app_user').insert({
    id: data.user.id,
    role,
    display_name: displayName,
  });
  if (insertError) {
    await supabase.auth.signOut();
    throw insertError;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? email,
    role,
    displayName,
    onboardingComplete: false,
  };
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function homeRouteForRole(role: UserRole): '/today' | '/students' {
  return role === 'student' ? '/today' : '/students';
}

export function landingRouteForUser(user: CurrentUser): '/today' | '/students' | '/onboarding' {
  if (user.role === 'student' && !user.onboardingComplete) return '/onboarding';
  return homeRouteForRole(user.role);
}
