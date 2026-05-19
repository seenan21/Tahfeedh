import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import {
  AppShell,
  Avatar,
  Badge,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { ChevronDown, LogOut, Settings as SettingsIcon, User } from 'lucide-react';
import { getCurrentUser, signOut } from '../lib/auth';
import { AppSidebar } from '../components/AppSidebar';

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

  async function handleSignOut() {
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
        <Group h="100%" px="xl" justify="space-between">
          <Group gap="xs">
            <Badge variant="dot" color="sage.7" size="sm" radius="sm">
              {user.role === 'student' ? 'Hifz student' : 'Hifz teacher'}
            </Badge>
          </Group>

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
