import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { AppShell, Badge, Button, Group, Text, Title } from '@mantine/core';
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
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: false, desktop: false },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Tahfeedh</Title>
          <Group gap="sm">
            <Text size="sm">{user.displayName ?? user.email}</Text>
            <Badge variant="light" color="mihrab">
              {user.role}
            </Badge>
            <Button size="xs" variant="subtle" onClick={handleSignOut}>
              Sign out
            </Button>
          </Group>
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
