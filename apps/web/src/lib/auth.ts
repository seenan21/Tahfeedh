import { supabase } from './supabase';
import type { UserRole } from '@tahfeedh/shared';

export interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
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

  return {
    id: profile.id,
    email: session.user.email ?? '',
    role: profile.role,
    displayName: profile.display_name,
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
