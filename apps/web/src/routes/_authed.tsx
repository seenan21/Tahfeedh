import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import {
  AppShell,
  Avatar,
  Badge,
  Button,
  Group,
  Menu,
  Paper,
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

  const elapsed = useElapsed(inProgressTest?.started_at);

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
          </Group>

          {inProgressTest && (
            <Paper
              px={14}
              py={6}
              radius="xl"
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background:
                  'linear-gradient(90deg, var(--mantine-color-brick-7), var(--mantine-color-brick-5))',
                color: 'var(--mantine-color-parchment-0)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 2px 10px rgba(127, 29, 29, 0.4)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              <AlertCircle size={14} strokeWidth={2.4} />
              <Text size="xs" fw={700} c="parchment.0" style={{ letterSpacing: 0.4 }}>
                Self-test in session
                {inProgressTest.guest_tester_name ? ` · ${inProgressTest.guest_tester_name}` : ''}
              </Text>
              <Text
                size="xs"
                fw={700}
                c="parchment.0"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  paddingInlineStart: 8,
                  borderInlineStart: '1px solid rgba(255,255,255,0.35)',
                }}
              >
                {elapsed}
              </Text>
            </Paper>
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
