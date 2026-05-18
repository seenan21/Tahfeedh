import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Group,
  Menu,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
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
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: false, desktop: false },
      }}
      padding="lg"
    >
      <AppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          <Title
            order={3}
            style={{ fontFamily: '"Playfair Display", serif', letterSpacing: '0.02em' }}
          >
            Tahfeedh
          </Title>
          <Menu position="bottom-end" withArrow shadow="md" width={220}>
            <Menu.Target>
              <UnstyledButton>
                <Group gap="xs">
                  <Avatar color="mihrab" radius="xl" size={32}>
                    {initialOf(user.displayName, user.email)}
                  </Avatar>
                  <Stack gap={0}>
                    <Text size="sm" fw={600} lh={1.1}>
                      {user.displayName ?? user.email}
                    </Text>
                    <Badge variant="light" color="sage" size="xs" radius="sm">
                      {user.role}
                    </Badge>
                  </Stack>
                  <ActionIcon variant="subtle" component="span" aria-label="open user menu">
                    <ChevronDown size={16} />
                  </ActionIcon>
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user.email}</Menu.Label>
              <Menu.Item
                leftSection={<SettingsIcon size={14} />}
                onClick={() => navigate({ to: '/settings' })}
              >
                Settings
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<LogOut size={14} />} onClick={handleSignOut} color="brick">
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
