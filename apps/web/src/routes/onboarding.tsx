import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Card, Center, Stack, Text } from '@mantine/core';
import { useReducer } from 'react';
import { getCurrentUser, formatAuthError } from '../lib/auth';
import { apiFetch } from '../api/client';
import { BilingualHero } from '../components/BilingualHero';
import { Step1Path } from '../onboarding/Step1Path';
import { Step2Capture } from '../onboarding/Step2Capture';
import { Step3Sessions } from '../onboarding/Step3Sessions';
import { initialState, reducer, toFinishPayload, type OnboardingState } from '../onboarding/state';

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
  component: OnboardingPage,
});

function OnboardingPage() {
  const { queryClient } = Route.useRouteContext();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);

  async function handleFinish(s: OnboardingState) {
    dispatch({ type: 'SET_SUBMITTING', submitting: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      await apiFetch('/api/onboarding/finish', {
        method: 'POST',
        body: JSON.stringify(toFinishPayload(s)),
      });
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate({ to: '/today' });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: formatAuthError(err) });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', submitting: false });
    }
  }

  return (
    <Center mih="100vh" p="md">
      <Stack maw={680} w="100%" gap="lg">
        <BilingualHero arabic="رحلتك تبدأ هنا" english="Your journey starts here" />
        <Card>
          {state.step === 1 && (
            <Step1Path
              path={state.path}
              onSelect={(path) => dispatch({ type: 'SET_PATH', path })}
              onContinue={() => dispatch({ type: 'NEXT' })}
            />
          )}
          {state.step === 2 && (
            <Step2Capture
              state={state}
              dispatch={dispatch}
              onBack={() => dispatch({ type: 'BACK' })}
              onContinue={() => dispatch({ type: 'NEXT' })}
            />
          )}
          {state.step === 3 && (
            <Step3Sessions
              state={state}
              dispatch={dispatch}
              onBack={() => dispatch({ type: 'BACK' })}
              onFinish={() => handleFinish(state)}
            />
          )}
        </Card>
      </Stack>
    </Center>
  );
}
