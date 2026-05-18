import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, Card, Center, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { getCurrentUser, formatAuthError } from '../lib/auth';
import { supabase } from '../lib/supabase';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (!user) throw redirect({ to: '/login' });
    if (user.role !== 'student') throw redirect({ to: '/students' });
    if (user.onboardingComplete) throw redirect({ to: '/today' });
    return { user };
  },
  component: OnboardingStub,
});

function OnboardingStub() {
  const { user, queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('student_settings')
        .update({ onboarding_complete: true })
        .eq('student_id', user.id);
      if (updateError) throw updateError;
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate({ to: '/today' });
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Card w={520} maw="100%">
        <Stack>
          <Title order={1}>Welcome to Tahfeedh</Title>
          <Text>
            The full onboarding flow (memorization state, juz/surah picker, daily session size)
            lands in the next phase. For now, mark onboarding complete to continue to Today.
          </Text>
          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}
          <Button onClick={handleComplete} loading={submitting} size="lg">
            Mark onboarding complete
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
