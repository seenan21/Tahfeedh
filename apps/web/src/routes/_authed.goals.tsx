import { useMemo, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CircleCheckBig,
  MoreVertical,
  Pencil,
  Plus,
  Target,
  Trash2,
} from 'lucide-react';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../api/client';
import { toastError, toastSuccess } from '../lib/toast';
import { GoalFormModal } from '../features/goals/GoalFormModal';
import { SkeletonRow } from '../components/SkeletonRow';
import { useQfStatus } from '../features/integrations/useQfStatus';

export const Route = createFileRoute('/_authed/goals')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: GoalsPage,
});

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: 'active' | 'completed' | 'archived';
  qf_goal_id: string | null;
  created_at: string;
}

async function fetchGoals(studentId: string): Promise<GoalRow[]> {
  const { data, error } = await supabase
    .from('goal')
    .select('id, title, description, target_date, status, qf_goal_id, created_at')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GoalRow[];
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const target = new Date(iso + 'T00:00:00').getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (24 * 60 * 60 * 1000));
}

function GoalsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalRow | null>(null);

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals', user.id],
    queryFn: () => fetchGoals(user.id),
    staleTime: 30_000,
  });

  const { data: qfStatus } = useQfStatus();

  const deleteMutation = useMutation({
    mutationFn: async (goal: GoalRow) => {
      // Delete local first; QF delete is fire-and-forget.
      const { error } = await supabase.from('goal').delete().eq('id', goal.id);
      if (error) throw error;
      if (goal.qf_goal_id) {
        try {
          await apiFetch(`/api/qf-user/goals/${encodeURIComponent(goal.qf_goal_id)}`, {
            method: 'DELETE',
          });
        } catch (qfErr) {
          console.warn('[goal delete] QF delete failed:', qfErr);
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goals', user.id] });
      toastSuccess('Goal deleted');
    },
    onError: (err) => toastError(err, 'Could not delete goal'),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (goal: GoalRow) => {
      const next = goal.status === 'completed' ? 'active' : 'completed';
      const { error } = await supabase
        .from('goal')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', goal.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goals', user.id] });
    },
    onError: (err) => toastError(err, 'Could not update goal status'),
  });

  const groups = useMemo(() => {
    const active = (goals ?? []).filter((g) => g.status === 'active');
    const completed = (goals ?? []).filter((g) => g.status !== 'active');
    return { active, completed };
  }, [goals]);

  return (
    <Stack maw={840} mx="auto" gap="xl" py="md">
      {/* Hero */}
      <Stack gap={4}>
        <Group gap={6} c="parchment.0" style={{ opacity: 0.85 }}>
          <Target size={14} strokeWidth={2.2} />
          <Text size="xs" tt="uppercase" fw={700} lts={0.8}>
            Goals
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
              الأهداف
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
              Long-term targets
            </Text>
          </Stack>
          <Button
            variant="white"
            color="dark"
            size="sm"
            leftSection={<Plus size={14} />}
            onClick={() => setCreateOpen(true)}
          >
            New goal
          </Button>
        </Group>
      </Stack>

      {/* QF sync hint */}
      {qfStatus?.connected && (
        <Text size="xs" c="parchment.0" style={{ opacity: 0.85 }}>
          Connected to Quran.com — new goals sync to your account there.
        </Text>
      )}

      <Card padding="lg" radius="xl" shadow="xl">
        {isLoading ? (
          <SkeletonRow variant="list" lines={3} height={72} />
        ) : (goals ?? []).length === 0 ? (
          <Stack align="center" gap="sm" py="xl">
            <Target size={32} color="var(--mantine-color-sage-7)" strokeWidth={1.6} />
            <Text fw={600}>No goals yet</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Add a long-term target like “Memorize Juz 30 by Ramadan.” If you’re
              connected to Quran.com, your goals sync there too.
            </Text>
            <Button
              variant="filled"
              color="mihrab"
              size="sm"
              leftSection={<Plus size={14} />}
              onClick={() => setCreateOpen(true)}
              mt="xs"
            >
              Add your first goal
            </Button>
          </Stack>
        ) : (
          <Stack gap="sm">
            {groups.active.map((g) => (
              <GoalRowCard
                key={g.id}
                goal={g}
                onEdit={() => setEditingGoal(g)}
                onDelete={() => {
                  if (window.confirm(`Delete goal “${g.title}”?`)) {
                    deleteMutation.mutate(g);
                  }
                }}
                onToggle={() => toggleStatusMutation.mutate(g)}
              />
            ))}
            {groups.completed.length > 0 && (
              <>
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" lts={0.6} mt="md">
                  Completed
                </Text>
                {groups.completed.map((g) => (
                  <GoalRowCard
                    key={g.id}
                    goal={g}
                    onEdit={() => setEditingGoal(g)}
                    onDelete={() => {
                      if (window.confirm(`Delete goal “${g.title}”?`)) {
                        deleteMutation.mutate(g);
                      }
                    }}
                    onToggle={() => toggleStatusMutation.mutate(g)}
                    muted
                  />
                ))}
              </>
            )}
          </Stack>
        )}
      </Card>

      <GoalFormModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        studentId={user.id}
      />
      <GoalFormModal
        opened={editingGoal != null}
        onClose={() => setEditingGoal(null)}
        studentId={user.id}
        initial={editingGoal ?? undefined}
      />
    </Stack>
  );
}

function GoalRowCard({
  goal,
  onEdit,
  onDelete,
  onToggle,
  muted = false,
}: {
  goal: GoalRow;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  muted?: boolean;
}) {
  const days = daysUntil(goal.target_date);
  const completed = goal.status === 'completed';
  return (
    <Group
      justify="space-between"
      align="center"
      p="md"
      wrap="nowrap"
      style={{
        borderRadius: 12,
        background: completed ? 'rgba(217, 232, 211, 0.55)' : 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(21,53,30,0.06)',
        opacity: muted && !completed ? 0.85 : 1,
      }}
    >
      <Group gap="md" align="flex-start" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 10,
            background: completed
              ? 'linear-gradient(135deg, var(--mantine-color-sage-4) 0%, var(--mantine-color-sage-7) 100%)'
              : 'linear-gradient(135deg, var(--mantine-color-honey-4) 0%, var(--mantine-color-brick-6) 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {completed ? <CircleCheckBig size={20} /> : <Target size={20} />}
        </div>
        <Stack gap={4} style={{ minWidth: 0 }}>
          <Group gap="xs" align="center" wrap="wrap">
            <Text
              fw={600}
              size="sm"
              style={{ textDecoration: completed ? 'line-through' : undefined }}
            >
              {goal.title}
            </Text>
            {goal.qf_goal_id && (
              <Tooltip label="Synced to Quran.com">
                <Badge size="xs" variant="light" color="sage">
                  Quran.com
                </Badge>
              </Tooltip>
            )}
          </Group>
          {goal.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {goal.description}
            </Text>
          )}
          {goal.target_date && (
            <Group gap={4} align="center">
              <CalendarDays size={12} />
              <Text size="xs" c="dimmed">
                {new Date(goal.target_date + 'T00:00:00').toLocaleDateString()}
                {days != null && (
                  <>
                    {' · '}
                    {days > 0 ? `${days} days left` : days === 0 ? 'today' : `${-days} days ago`}
                  </>
                )}
              </Text>
            </Group>
          )}
        </Stack>
      </Group>
      <Menu shadow="md" width={180} position="bottom-end" withArrow>
        <Menu.Target>
          <ActionIcon variant="subtle" size="sm" aria-label="Goal actions">
            <MoreVertical size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<CircleCheckBig size={14} />} onClick={onToggle}>
            {completed ? 'Mark active' : 'Mark complete'}
          </Menu.Item>
          <Menu.Item leftSection={<Pencil size={14} />} onClick={onEdit}>
            Edit
          </Menu.Item>
          <Menu.Item leftSection={<Trash2 size={14} />} color="brick.7" onClick={onDelete}>
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
