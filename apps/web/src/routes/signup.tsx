import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useForm } from '@mantine/form';
import {
  Anchor,
  Button,
  Card,
  Center,
  Group,
  Modal,
  PasswordInput,
  Radio,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import type { UserRole } from '@tahfeedh/shared';
import {
  formatAuthError,
  getCurrentUser,
  landingRouteForUser,
  signOut,
  signUpWithRole,
} from '../lib/auth';
import { SilkBackground } from '../components/SilkBackground';
import { BilingualHero } from '../components/BilingualHero';
import { IntroHadith } from '../components/IntroHadith';

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (user) {
      throw redirect({ to: landingRouteForUser(user) });
    }
  },
  component: SignupPage,
});

interface FormValues {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

const REDIRECT_SECONDS = 5;
const DUPLICATE_PATTERNS = /already registered|user_already_exists|already exists|duplicate/i;

function SignupPage() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<'success' | 'duplicate' | null>(null);
  const [countdown, setCountdown] = useState(REDIRECT_SECONDS);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<FormValues>({
    initialValues: { email: '', password: '', displayName: '', role: 'student' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
      displayName: (v) => (v.trim().length >= 2 ? null : 'At least 2 characters'),
    },
  });

  useEffect(() => {
    if (outcome !== 'success' || countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [outcome, countdown]);

  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

  async function handleSubmit(values: FormValues) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await signUpWithRole(values);
      // Sign out so the user logs in fresh — clearer mental model and lets us
      // surface the success modal before dropping them into the app.
      await signOut();
      // Replace the cached session with null synchronously so any subsequent
      // beforeLoad sees a logged-out state — invalidate alone can lose the
      // race with the modal's navigation timer.
      queryClient.setQueryData(['session'], null);
      setCountdown(REDIRECT_SECONDS);
      setOutcome('success');
      redirectTimer.current = setTimeout(() => {
        navigate({ to: '/login' });
      }, REDIRECT_SECONDS * 1000);
    } catch (err) {
      const msg = formatAuthError(err);
      if (DUPLICATE_PATTERNS.test(msg)) {
        setOutcome('duplicate');
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SilkBackground />
      <Center mih="100vh" p="md" pos="relative" style={{ zIndex: 1 }}>
        <Stack align="center" gap="xl" maw={560} w="100%">
          <IntroHadith />
          <Card w={460} maw="100%">
            <Stack>
              <BilingualHero arabic="ابدأ رحلتك" english="Begin your journey" />
              <Text c="dimmed" size="sm" ta="center">
                Tahfeedh tracks your hifz journey alongside your teacher.
              </Text>

              <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                  <TextInput
                    label="Name"
                    placeholder="What should we call you?"
                    required
                    {...form.getInputProps('displayName')}
                  />
                  <TextInput
                    label="Email"
                    type="email"
                    autoComplete="email"
                    required
                    {...form.getInputProps('email')}
                  />
                  <PasswordInput
                    label="Password"
                    autoComplete="new-password"
                    required
                    {...form.getInputProps('password')}
                  />

                  <Radio.Group
                    label="I am a..."
                    required
                    {...form.getInputProps('role')}
                  >
                    <Group mt="xs" gap="lg">
                      <Radio value="student" label="Student" />
                      <Radio value="teacher" label="Teacher" />
                    </Group>
                  </Radio.Group>

                  {submitError && (
                    <Text c="red" size="sm">
                      {submitError}
                    </Text>
                  )}

                  <Button type="submit" loading={submitting} fullWidth color="mihrab" size="lg">
                    Create account
                  </Button>

                  <Text size="sm" ta="center" c="dimmed">
                    Already have an account?{' '}
                    <Anchor component={Link} to="/login">
                      Log in
                    </Anchor>
                  </Text>
                </Stack>
              </form>
            </Stack>
          </Card>
        </Stack>
      </Center>

      <Modal
        opened={outcome === 'success'}
        onClose={() => navigate({ to: '/login' })}
        title="You're all set"
        withCloseButton={false}
      >
        <Stack>
          <Text>
            Welcome to Tahfeedh. Your account is ready — log in to get started.
          </Text>
          <Text size="sm" c="dimmed">
            Redirecting to the login page in {countdown} second{countdown === 1 ? '' : 's'}…{' '}
            <Anchor component={Link} to="/login">
              go now
            </Anchor>
          </Text>
        </Stack>
      </Modal>

      <Modal
        opened={outcome === 'duplicate'}
        onClose={() => setOutcome(null)}
        title="That email is already registered"
      >
        <Stack>
          <Text>
            Looks like you already have a Tahfeedh account with this email. Log in instead?
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOutcome(null)}>
              Try a different email
            </Button>
            <Button onClick={() => navigate({ to: '/login' })}>
              Go to login
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
