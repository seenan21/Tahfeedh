import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useForm } from '@mantine/form';
import {
  Anchor,
  Button,
  Card,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { formatAuthError, getCurrentUser, homeRouteForRole, signIn } from '../lib/auth';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (user) throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: LoginPage,
});

interface FormValues {
  email: string;
  password: string;
}

function LoginPage() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length >= 1 ? null : 'Password is required'),
    },
  });

  async function handleSubmit(values: FormValues) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      const user = await queryClient.fetchQuery({
        queryKey: ['session'],
        queryFn: getCurrentUser,
      });
      if (!user) throw new Error('Login succeeded but no profile was found');
      navigate({ to: homeRouteForRole(user.role) });
    } catch (err) {
      setSubmitError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Center mih="calc(100vh - 92px)">
      <Card w={420} maw="100%">
        <Stack>
          <Title order={2}>Welcome back</Title>
          <Text c="dimmed" size="sm">
            Log in to pick up where you left off.
          </Text>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack>
              <TextInput
                label="Email"
                type="email"
                autoComplete="email"
                required
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Password"
                autoComplete="current-password"
                required
                {...form.getInputProps('password')}
              />

              {submitError && (
                <Text c="red" size="sm">
                  {submitError}
                </Text>
              )}

              <Button type="submit" loading={submitting} fullWidth>
                Log in
              </Button>

              <Text size="sm" ta="center" c="dimmed">
                New here?{' '}
                <Anchor component={Link} to="/signup">
                  Create an account
                </Anchor>
              </Text>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Center>
  );
}
