import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import {
  AppShell,
  Avatar,
  Badge,
  Button,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, LogOut, Settings as SettingsIcon, User } from 'lucide-react';
import { getCurrentUser, signOut } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { AppSidebar } from '../components/AppSidebar';
import { useQfStatus } from '../features/integrations/useQfStatus';

interface InProgressTestRow {
  id: string;
  test_type: 'newly_memorized' | 'revision';
  guest_tester_name: string | null;
  started_at: string;
}

async function fetchInProgressTest(studentId: string): Promise<InProgressTestRow | null> {
  const { data, error } = await supabase
    .from('test')
    .select('id, test_type, guest_tester_name, started_at')
    .eq('student_id', studentId)
    .eq('status', 'in_progress')
    .maybeSingle();
  if (error) return null;
  return (data as InProgressTestRow | null) ?? null;
}

function useElapsed(startIso: string | undefined): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startIso]);
  if (!startIso) return '';
  const startMs = new Date(startIso).getTime();
  const totalSec = Math.max(0, Math.floor((now - startMs) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (!user) throw redirect({ to: '/login' });
    if (
      user.role === 'student' &&
      !user.onboardingComplete &&
      location.pathname !== '/onboarding'
    ) {
      throw redirect({ to: '/onboarding' });
    }

    // Test lock: if the student has an in-progress test and they're not on
    // the live-test route, bounce them back. Pedagogy: a witnessed test must
    // be finished (or abandoned) before the student does anything else.
    if (user.role === 'student') {
      const inProgress = await context.queryClient.fetchQuery({
        queryKey: ['in_progress_test', user.id],
        queryFn: () => fetchInProgressTest(user.id),
        staleTime: 5_000,
      });
      if (inProgress) {
        const expected = `/tests/${inProgress.id}`;
        if (location.pathname !== expected) {
          // Signal the banner to pulse — the student just got bounced back, so
          // we want the pill in the header to grab their attention. The event
          // fires on `window` so the listener in AuthedLayout (sibling tree)
          // can react regardless of which route was attempted.
          if (typeof window !== 'undefined') {
            queueMicrotask(() => {
              window.dispatchEvent(new CustomEvent('test-lock-redirect'));
            });
          }
          throw redirect({ to: '/tests/$testId', params: { testId: inProgress.id } });
        }
      }
    }

    return { user };
  },
  component: AuthedLayout,
});

function initialOf(name: string | null, email: string): string {
  const source = (name && name.trim().length > 0 ? name : email).trim();
  return source.charAt(0).toUpperCase();
}

function AuthedLayout() {
  const { user, queryClient } = Route.useRouteContext();
  const navigate = useNavigate();

  const { data: inProgressTest } = useQuery({
    queryKey: ['in_progress_test', user.id],
    queryFn: () => fetchInProgressTest(user.id),
    enabled: user.role === 'student',
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  // QF connection state drives the header pill. Only students see Connect;
  // the query no-ops gracefully for teachers (returns connected:false).
  const { data: qfStatus } = useQfStatus();

  const elapsed = useElapsed(inProgressTest?.started_at);

  // Flash the banner when the route guard bounces the student back to the
  // live test. One-shot animation, cleared after ~1.4s. Listener lives here
  // since AuthedLayout outlives every authed route transition.
  const [bannerFlashing, setBannerFlashing] = useState(false);
  useEffect(() => {
    const handler = () => {
      setBannerFlashing(false);
      // Force a reflow then set true so consecutive bounces retrigger the keyframes.
      requestAnimationFrame(() => {
        setBannerFlashing(true);
        window.setTimeout(() => setBannerFlashing(false), 1400);
      });
    };
    window.addEventListener('test-lock-redirect', handler);
    return () => window.removeEventListener('test-lock-redirect', handler);
  }, []);

  async function handleSignOut() {
    // Auto-abandon any in-progress test before signing out (ADR follow-up to
    // 0004): pedagogically a test must be witnessed; an unattended in-progress
    // row would orphan and block the unique-in-progress slot forever.
    if (inProgressTest) {
      await supabase
        .from('test')
        .update({ status: 'abandoned', ended_at: new Date().toISOString() })
        .eq('id', inProgressTest.id);
      await queryClient.invalidateQueries({ queryKey: ['in_progress_test', user.id] });
    }
    await signOut();
    await queryClient.invalidateQueries({ queryKey: ['session'] });
    navigate({ to: '/login' });
  }

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{
        width: 64,
        breakpoint: 'sm',
        collapsed: { mobile: false, desktop: false },
      }}
      padding="xl"
      styles={{
        header: {
          backgroundColor: 'rgba(255, 255, 193, 0.78)',
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          borderBottom: '1px solid rgba(21, 53, 30, 0.08)',
        },
        navbar: {
          // Allow the icon-rail's hover-expand panel to overflow the 64px slot
          // so the expanded panel sits above the main content.
          overflow: 'visible',
          backgroundColor: 'transparent',
          border: 'none',
        },
        main: {
          background:
            'radial-gradient(ellipse at 30% 0%, #1c4129 0%, #15351E 55%, #102819 100%)',
          minHeight: '100vh',
        },
      }}
    >
      <AppShell.Header>
        <Group h="100%" px="xl" justify="space-between" style={{ position: 'relative' }}>
          <Group gap="xs">
            <Badge variant="dot" color="sage.7" size="sm" radius="sm">
              {user.role === 'student' ? 'Hifz student' : 'Hifz teacher'}
            </Badge>
            {qfStatus?.connected && (
              <Badge
                size="sm"
                radius="sm"
                variant="light"
                styles={{
                  root: {
                    background: 'rgba(14, 124, 92, 0.12)',
                    color: '#0E7C5C',
                    border: '1px solid rgba(14, 124, 92, 0.28)',
                  },
                }}
                leftSection={
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#0E7C5C',
                    }}
                  />
                }
              >
                Connected to Quran.com
              </Badge>
            )}
          </Group>

          {inProgressTest && (
            <div
              data-flashing={bannerFlashing ? 'true' : 'false'}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background:
                  'linear-gradient(90deg, #7f1d1d 0%, #b91c1c 100%)',
                color: '#FFFFC1',
                padding: '6px 16px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 2px 10px rgba(127, 29, 29, 0.45)',
                pointerEvents: 'none',
                zIndex: 1,
                fontFamily:
                  '"Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: 0.4,
                whiteSpace: 'nowrap',
                animation: bannerFlashing ? 'tahfeedhTestLockPulse 1.4s ease-out' : undefined,
                outline: bannerFlashing ? '2px solid rgba(248, 113, 113, 0.95)' : '2px solid transparent',
                outlineOffset: 2,
                transition: 'outline-color 220ms ease',
              }}
            >
              <AlertCircle size={14} strokeWidth={2.4} color="#FFFFC1" />
              <span style={{ color: '#FFFFC1' }}>
                Self-test in session
                {inProgressTest.guest_tester_name ? ` · ${inProgressTest.guest_tester_name}` : ''}
              </span>
              <span
                style={{
                  color: '#FFFFC1',
                  fontVariantNumeric: 'tabular-nums',
                  paddingInlineStart: 10,
                  borderInlineStart: '1px solid rgba(255, 255, 193, 0.45)',
                }}
              >
                {elapsed}
              </span>
            </div>
          )}

          <Menu position="bottom-end" withArrow shadow="lg" width={240} offset={8}>
            <Menu.Target>
              <UnstyledButton
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 10px 4px 4px',
                  borderRadius: 999,
                  border: '1px solid rgba(21,53,30,0.08)',
                  background: 'rgba(255,255,255,0.55)',
                  transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)',
                }}
              >
                <Avatar
                  color="mihrab"
                  radius="xl"
                  size={34}
                  styles={{
                    placeholder: {
                      background:
                        'linear-gradient(135deg, var(--mantine-color-mihrab-9) 0%, var(--mantine-color-sage-7) 100%)',
                      color: 'var(--mantine-color-parchment-0)',
                      fontFamily: '"Playfair Display", serif',
                      fontWeight: 700,
                    },
                  }}
                >
                  {initialOf(user.displayName, user.email)}
                </Avatar>
                <Stack gap={0}>
                  <Text size="sm" fw={600} lh={1.1}>
                    {user.displayName ?? user.email}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.1}>
                    {user.email}
                  </Text>
                </Stack>
                <ChevronDown size={14} strokeWidth={2} style={{ opacity: 0.6 }} />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Signed in as</Menu.Label>
              <Menu.Item leftSection={<User size={14} />} disabled>
                {user.email}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<SettingsIcon size={14} />}
                onClick={() => navigate({ to: '/settings' })}
              >
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<LogOut size={14} />}
                onClick={handleSignOut}
                color="brick.7"
              >
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar>
        <AppSidebar role={user.role} />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
