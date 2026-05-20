import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Card, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { useEffect, useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentUser, formatAuthError } from '../lib/auth';
import { apiFetch } from '../api/client';
import { BilingualHero } from '../components/BilingualHero';
import { Step1Path } from '../onboarding/Step1Path';
import { Step2Capture } from '../onboarding/Step2Capture';
import { Step3Sessions } from '../onboarding/Step3Sessions';
import { hydrateOnboardingFromDb } from '../onboarding/hydrate';
import { toastSuccess } from '../lib/toast';
import {
  initialState,
  reducer,
  toFinishPayload,
  type OnboardingState,
} from '../onboarding/state';

interface OnboardingSearch {
  edit?: 1;
}

export const Route = createFileRoute('/onboarding')({
  validateSearch: (search: Record<string, unknown>): OnboardingSearch => {
    const edit = search.edit;
    return {
      edit: edit === 1 || edit === '1' ? 1 : undefined,
    };
  },
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (!user) throw redirect({ to: '/login' });
    if (user.role !== 'student') throw redirect({ to: '/students' });
    const editMode = search.edit === 1;
    if (user.onboardingComplete && !editMode) throw redirect({ to: '/today' });
    return { user, editMode };
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const { queryClient, user, editMode } = Route.useRouteContext();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);

  const hydration = useQuery({
    queryKey: ['onboarding-hydrate', user.id],
    queryFn: () => hydrateOnboardingFromDb(user.id),
    enabled: editMode,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (editMode && hydration.data) {
      dispatch({ type: 'HYDRATE', patch: hydration.data.patch });
    }
  }, [editMode, hydration.data]);

  async function handleFinish(s: OnboardingState) {
    dispatch({ type: 'SET_SUBMITTING', submitting: true });
    dispatch({ type: 'SET_ERROR', error: null });
    try {
      await apiFetch('/api/onboarding/finish', {
        method: 'POST',
        body: JSON.stringify(toFinishPayload(s)),
      });
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      await queryClient.invalidateQueries({ queryKey: ['onboarding-hydrate', user.id] });
      if (editMode) {
        toastSuccess('Memorization updated');
        navigate({ to: '/settings' });
      } else {
        navigate({ to: '/today' });
      }
    } catch (err) {
      dispatch({ type: 'SET_ERROR', error: formatAuthError(err) });
    } finally {
      dispatch({ type: 'SET_SUBMITTING', submitting: false });
    }
  }

  const hydrating = editMode && hydration.isLoading;

  return (
    <Center mih="100vh" p="md">
      <Stack maw={680} w="100%" gap="lg">
        <BilingualHero
          arabic={editMode ? 'تحديث الحفظ' : 'رحلتك تبدأ هنا'}
          english={editMode ? 'Edit your memorization' : 'Your journey starts here'}
        />
        <Card>
          {hydrating ? (
            <Group justify="center" py="xl" gap="sm">
              <Loader size="sm" color="sage.7" />
              <Text size="sm" c="dimmed">
                Loading your current memorization…
              </Text>
            </Group>
          ) : (
            <>
              {state.step === 1 && (
                <Step1Path
                  path={state.path}
                  direction={state.direction}
                  onSelect={(path) => dispatch({ type: 'SET_PATH', path })}
                  onDirection={(direction) => dispatch({ type: 'SET_DIRECTION', direction })}
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
            </>
          )}
        </Card>
      </Stack>
    </Center>
  );
}
