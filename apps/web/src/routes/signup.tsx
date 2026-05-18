import { createFileRoute, redirect, useNavigate, Link } from '@tanstack/react-router';
import { useForm } from '@mantine/form';
import {
  Anchor,
  Button,
  Card,
  Center,
  Group,
  PasswordInput,
  Radio,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import type { UserRole } from '@tahfeedh/shared';
import { getCurrentUser, homeRouteForRole, signUpWithRole } from '../lib/auth';

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (user) throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: SignupPage,
});

interface FormValues {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

function SignupPage() {
  const navigate = useNavigate();
  const { queryClient } = Route.useRouteContext();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    initialValues: { email: '', password: '', displayName: '', role: 'student' },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : 'Enter a valid email'),
      password: (v) => (v.length >= 8 ? null : 'At least 8 characters'),
      displayName: (v) => (v.trim().length >= 2 ? null : 'At least 2 characters'),
    },
  });

  async function handleSubmit(values: FormValues) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      const user = await signUpWithRole(values);
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      navigate({ to: homeRouteForRole(user.role) });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Center mih="calc(100vh - 92px)">
      <Card w={420} maw="100%">
        <Stack>
          <Title order={2}>Create your account</Title>
          <Text c="dimmed" size="sm">
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

              <Button type="submit" loading={submitting} fullWidth>
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
    </Center>
  );
}
