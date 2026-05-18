import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Stack, Text, Title } from '@mantine/core';
import { homeRouteForRole } from '../lib/auth';

export const Route = createFileRoute('/_authed/groups')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: GroupsPage,
});

function GroupsPage() {
  return (
    <Card maw={720} mx="auto">
      <Stack>
        <Title order={1}>Groups</Title>
        <Text c="dimmed">Coming soon</Text>
      </Stack>
    </Card>
  );
}
