import { createRootRouteWithContext, Outlet, useNavigate } from '@tanstack/react-router';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { AppShell, Badge, Button, Group, Text, Title } from '@mantine/core';
import { getCurrentUser, signOut } from '../lib/auth';

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const { data: user } = useQuery({
    queryKey: ['session'],
    queryFn: getCurrentUser,
  });

  async function handleSignOut() {
    await signOut();
    await queryClient.invalidateQueries({ queryKey: ['session'] });
    navigate({ to: '/login' });
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Tahfeedh</Title>
          {user && (
            <Group gap="sm">
              <Text size="sm">{user.displayName ?? user.email}</Text>
              <Badge variant="light" color="mihrab">
                {user.role}
              </Badge>
              <Button size="xs" variant="subtle" onClick={handleSignOut}>
                Sign out
              </Button>
            </Group>
          )}
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
