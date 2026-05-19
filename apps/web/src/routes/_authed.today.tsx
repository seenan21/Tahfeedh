import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Divider, Group, Stack, Text } from '@mantine/core';
import { BookOpenText, Moon, Repeat2, Sun, Sunset } from 'lucide-react';
import { homeRouteForRole } from '../lib/auth';
import { StreakBadge } from '../today/StreakBadge';
import { JuzProgressBar } from '../today/JuzProgressBar';
import { EmptySlotCard } from '../today/EmptySlotCard';
import { NewLessonCard } from '../today/NewLessonCard';

export const Route = createFileRoute('/_authed/today')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: TodayPage,
});

function greetingFor(date: Date): { icon: typeof Sun; label: string } {
  const h = date.getHours();
  if (h < 12) return { icon: Sun, label: 'Good morning' };
  if (h < 18) return { icon: Sunset, label: 'Good afternoon' };
  return { icon: Moon, label: 'Good evening' };
}

function TodayPage() {
  const { user } = Route.useRouteContext();
  const { icon: GreetIcon, label } = greetingFor(new Date());

  return (
    <Stack maw={840} mx="auto" gap="xl" py="md">
      {/* Hero strip */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="lg">
        <Stack gap={6}>
          <Group gap={6} c="parchment.0">
            <GreetIcon size={16} strokeWidth={2} style={{ opacity: 0.85 }} />
            <Text size="sm" style={{ opacity: 0.85 }}>
              {label}, {user.displayName ?? user.email}
            </Text>
          </Group>
          <Text
            component="h1"
            style={{
              fontFamily: 'Cairo, sans-serif',
              fontWeight: 700,
              fontSize: 40,
              lineHeight: 1.1,
              direction: 'rtl',
              color: 'var(--mantine-color-parchment-0)',
              margin: 0,
            }}
          >
            اليوم
          </Text>
          <Text
            component="h2"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.1,
              color: 'var(--mantine-color-parchment-0)',
              margin: 0,
            }}
          >
            Today
          </Text>
        </Stack>
        <StreakBadge studentId={user.id} />
      </Group>

      {/* Progress card */}
      <Card padding="xl" radius="xl" shadow="xl">
        <JuzProgressBar studentId={user.id} />
      </Card>

      {/* Plan card */}
      <Card padding="xl" radius="xl" shadow="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
                Today's plan
              </Text>
              <Text fw={600} size="lg">Your session at a glance</Text>
            </Stack>
            <Text size="xs" c="dimmed">0 of 0 covered today</Text>
          </Group>

          <Divider
            label={
              <Group gap={6}>
                <BookOpenText size={12} />
                <Text size="xs" fw={700} tt="uppercase" lts={0.6} c="dimmed">
                  New lesson
                </Text>
              </Group>
            }
            labelPosition="left"
          />
          <NewLessonCard studentId={user.id} />

          <Divider
            label={
              <Group gap={6}>
                <Repeat2 size={12} />
                <Text size="xs" fw={700} tt="uppercase" lts={0.6} c="dimmed">
                  Revision queue
                </Text>
              </Group>
            }
            labelPosition="left"
          />
          <EmptySlotCard
            title="Today's revision pages"
            icon={Repeat2}
            helper="The algorithm picks revision pages from your hifz once the live test flow lands in Phase D."
            accent="honey"
            badge="Phase D · M5"
          />

          <Text size="xs" c="dimmed" ta="center" mt="sm">
            Tests are the only way pages move through the queues — start one whenever a witness is ready.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}
