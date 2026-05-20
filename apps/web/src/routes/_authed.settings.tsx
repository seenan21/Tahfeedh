import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Mail,
  Pencil,
  Settings as SettingsIcon,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import type { HifzDirection } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/toast';
import { SkeletonRow } from '../components/SkeletonRow';
import { ConnectQuranCom } from '../features/integrations/ConnectQuranCom';
import type { CurrentUser } from '../lib/auth';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

interface DirectionOption {
  value: HifzDirection;
  english: string;
  arabic: string;
  helper: string;
  icon: typeof ArrowRight;
}

const DIRECTION_OPTIONS: DirectionOption[] = [
  {
    value: 'forward',
    english: 'From Al-Baqarah forward',
    arabic: 'من البقرة',
    helper: 'Frontier advances toward Juz Amma.',
    icon: ArrowRight,
  },
  {
    value: 'backward',
    english: 'From Juz Amma first',
    arabic: 'من جزء عمّ',
    helper: 'Frontier advances back toward Al-Baqarah.',
    icon: ArrowLeft,
  },
];

interface StudentSettingsRow {
  pages_per_session_new: number;
  pages_per_session_revision: number;
  hifz_direction: HifzDirection;
}

interface AppUserRow {
  display_name: string | null;
  has_completed_quran: boolean;
}

async function fetchStudentSettings(studentId: string): Promise<StudentSettingsRow | null> {
  const { data, error } = await supabase
    .from('student_settings')
    .select('pages_per_session_new, pages_per_session_revision, hifz_direction')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    pages_per_session_new: Number(data.pages_per_session_new),
    pages_per_session_revision: data.pages_per_session_revision,
    hifz_direction: data.hifz_direction,
  };
}

async function fetchAppUser(userId: string): Promise<AppUserRow | null> {
  const { data, error } = await supabase
    .from('app_user')
    .select('display_name, has_completed_quran')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUserRow | null) ?? null;
}

function SettingsPage() {
  const { user } = Route.useRouteContext();
  return (
    <Stack maw={760} mx="auto" gap="xl" py="md">
      <SettingsHero />
      {user.role === 'student' ? <StudentSettings user={user} /> : <TeacherSettings user={user} />}
    </Stack>
  );
}

function SettingsHero() {
  return (
    <Stack gap={4}>
      <Group gap={6} c="parchment.0" style={{ opacity: 0.85 }}>
        <SettingsIcon size={14} strokeWidth={2.2} />
        <Text size="xs" tt="uppercase" fw={700} lts={0.8}>
          Settings
        </Text>
      </Group>
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="lg">
        <Stack gap={0}>
          <Text
            component="h1"
            style={{
              fontFamily: 'Cairo, sans-serif',
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.1,
              direction: 'rtl',
              color: 'var(--mantine-color-parchment-0)',
              margin: 0,
            }}
          >
            الإعدادات
          </Text>
          <Text
            component="h2"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 700,
              fontSize: 24,
              lineHeight: 1.1,
              color: 'var(--mantine-color-parchment-0)',
              margin: 0,
            }}
          >
            Your Settings
          </Text>
        </Stack>
      </Group>
    </Stack>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="xl" radius="xl" shadow="md">
      <Stack gap="md">
        <Stack gap={2}>
          <Text fw={700} size="md">
            {title}
          </Text>
          {description && (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          )}
        </Stack>
        <Divider />
        {children}
      </Stack>
    </Card>
  );
}

function ProfileCard({ user }: { user: CurrentUser }) {
  return (
    <SectionCard title="Profile" description="Read-only for now — reach out if you need to change these.">
      <Stack gap="sm">
        <Group gap="md" wrap="nowrap">
          <UserIcon size={16} color="var(--mantine-color-sage-7)" />
          <Stack gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.6}>
              Name
            </Text>
            <Text fw={600}>{user.displayName ?? '(no display name)'}</Text>
          </Stack>
        </Group>
        <Group gap="md" wrap="nowrap">
          <Mail size={16} color="var(--mantine-color-sage-7)" />
          <Stack gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.6}>
              Email
            </Text>
            <Text fw={600}>{user.email}</Text>
          </Stack>
        </Group>
        <Group gap="md" wrap="nowrap">
          <Sparkles size={16} color="var(--mantine-color-sage-7)" />
          <Stack gap={0}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.6}>
              Role
            </Text>
            <Text fw={600} tt="capitalize">
              {user.role}
            </Text>
          </Stack>
        </Group>
      </Stack>
    </SectionCard>
  );
}

function ConnectQuranComSection() {
  return (
    <SectionCard
      title="Connect Quran.com"
      description="Sync bookmarks, goals, and your reading streak with your Quran.com account."
    >
      <ConnectQuranCom />
    </SectionCard>
  );
}

function DailyCapacityCard({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['student_settings', studentId],
    queryFn: () => fetchStudentSettings(studentId),
  });

  const [newPerDay, setNewPerDay] = useState<number>(1);
  const [revisionPerDay, setRevisionPerDay] = useState<number>(5);

  useEffect(() => {
    if (settings) {
      setNewPerDay(settings.pages_per_session_new);
      setRevisionPerDay(settings.pages_per_session_revision);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('student_settings')
        .update({
          pages_per_session_new: newPerDay,
          pages_per_session_revision: revisionPerDay,
        })
        .eq('student_id', studentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student_settings', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['today_session', studentId] });
      toastSuccess('Daily capacity updated');
    },
    onError: (err) => toastError(err, 'Could not save capacity'),
  });

  const dirty =
    settings != null &&
    (newPerDay !== settings.pages_per_session_new ||
      revisionPerDay !== settings.pages_per_session_revision);

  return (
    <SectionCard
      title="Daily capacity"
      description="How much new memorization and revision you take on each session."
    >
      {isLoading || !settings ? (
        <SkeletonRow variant="list" lines={2} height={64} />
      ) : (
        <Stack gap="md">
          <NumberInput
            label="New pages per session"
            description="Half-pages allowed (0.5, 1, 1.5, …)."
            value={newPerDay}
            onChange={(v) => setNewPerDay(typeof v === 'number' ? v : Number(v) || 0.5)}
            min={0.5}
            max={20}
            step={0.5}
            decimalScale={1}
            allowDecimal
          />
          <NumberInput
            label="Revision pages per session"
            description="Whole pages only."
            value={revisionPerDay}
            onChange={(v) => setRevisionPerDay(typeof v === 'number' ? v : Number(v) || 0)}
            min={0}
            max={20}
          />
          <Group justify="flex-end">
            <Button
              color="mihrab"
              size="sm"
              disabled={!dirty}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              Save capacity
            </Button>
          </Group>
        </Stack>
      )}
    </SectionCard>
  );
}

function HifzDirectionCard({ studentId }: { studentId: string }) {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['student_settings', studentId],
    queryFn: () => fetchStudentSettings(studentId),
  });

  const updateMutation = useMutation({
    mutationFn: async (direction: HifzDirection) => {
      const { error } = await supabase
        .from('student_settings')
        .update({ hifz_direction: direction })
        .eq('student_id', studentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['student_settings', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['next_new_lesson', studentId] });
      await queryClient.invalidateQueries({ queryKey: ['today_session', studentId] });
      toastSuccess('Hifz direction updated');
    },
    onError: (err) => toastError(err, 'Could not change direction'),
  });

  return (
    <SectionCard
      title="Hifz direction"
      description="Which way the next-page picker walks when you finish a lesson."
    >
      {isLoading || !settings ? (
        <SkeletonRow variant="list" lines={2} height={80} />
      ) : (
        <Group gap="sm" grow wrap="wrap" align="stretch">
          {DIRECTION_OPTIONS.map((opt) => {
            const selected = settings.hifz_direction === opt.value;
            const Icon = opt.icon;
            return (
              <UnstyledButton
                key={opt.value}
                onClick={() => {
                  if (!selected && !updateMutation.isPending) updateMutation.mutate(opt.value);
                }}
              >
                <Card
                  bg={selected ? 'sage.1' : 'white'}
                  radius="md"
                  shadow={selected ? 'md' : 'sm'}
                  p="md"
                  style={{
                    border: selected
                      ? '2px solid var(--mantine-color-sage-4)'
                      : '2px solid var(--mantine-color-gray-2)',
                    transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                    height: '100%',
                  }}
                >
                  <Stack gap={6}>
                    <Group justify="space-between" align="center">
                      <Icon size={20} strokeWidth={1.75} color="var(--mantine-color-mihrab-9)" />
                      {selected ? (
                        <Check size={16} color="var(--mantine-color-sage-7)" strokeWidth={2.5} />
                      ) : (
                        <Circle size={12} color="var(--mantine-color-gray-5)" />
                      )}
                    </Group>
                    <Group gap="xs" justify="space-between">
                      <Text fw={600} size="sm">
                        {opt.english}
                      </Text>
                      <Text
                        component="span"
                        style={{ fontFamily: 'Amiri, serif', fontSize: 15, direction: 'rtl' }}
                        c="dimmed"
                      >
                        {opt.arabic}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {opt.helper}
                    </Text>
                  </Stack>
                </Card>
              </UnstyledButton>
            );
          })}
        </Group>
      )}
    </SectionCard>
  );
}

function MemorizationStatusCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: appUser, isLoading } = useQuery({
    queryKey: ['app_user', userId],
    queryFn: () => fetchAppUser(userId),
  });

  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from('app_user')
        .update({ has_completed_quran: next })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['app_user', userId] });
      toastSuccess('Completed-Qur’an flag updated');
    },
    onError: (err) => toastError(err, 'Could not update flag'),
  });

  return (
    <SectionCard
      title="Memorization status"
      description="Flag for whether you have completed the Quran. Edit Memorization re-opens onboarding to recalibrate juz/surah selections."
    >
      {isLoading || !appUser ? (
        <SkeletonRow variant="list" lines={2} height={56} />
      ) : (
        <Stack gap="md">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={0}>
              <Text fw={600}>I have memorized the full Qur’an</Text>
              <Text size="xs" c="dimmed">
                Flips Today and Progress into a revision-only stance.
              </Text>
            </Stack>
            <Switch
              checked={appUser.has_completed_quran}
              onChange={(e) => toggleMutation.mutate(e.currentTarget.checked)}
              color="sage"
              size="lg"
            />
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap" gap="md">
            <Stack gap={0}>
              <Text fw={600}>Edit Memorization</Text>
              <Text size="xs" c="dimmed">
                Re-opens the onboarding Step 2 picker pre-loaded with your current claims.
              </Text>
            </Stack>
            <Button
              variant="outline"
              color="sage.8"
              size="sm"
              leftSection={<Pencil size={14} />}
              onClick={() => navigate({ to: '/onboarding', search: { edit: 1 } })}
            >
              Edit Memorization
            </Button>
          </Group>
        </Stack>
      )}
    </SectionCard>
  );
}

function StudentSettings({ user }: { user: CurrentUser }) {
  return (
    <Stack gap="lg">
      <ProfileCard user={user} />
      <ConnectQuranComSection />
      <DailyCapacityCard studentId={user.id} />
      <HifzDirectionCard studentId={user.id} />
      <MemorizationStatusCard userId={user.id} />
    </Stack>
  );
}

function TeacherSettings({ user }: { user: CurrentUser }) {
  return (
    <Stack gap="lg">
      <ProfileCard user={user} />
    </Stack>
  );
}
