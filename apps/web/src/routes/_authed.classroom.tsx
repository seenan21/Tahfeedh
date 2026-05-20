import { useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DoorOpen,
  GraduationCap,
  MoreVertical,
  School,
  UserPlus,
} from 'lucide-react';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/toast';

export const Route = createFileRoute('/_authed/classroom')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: ClassroomPage,
});

interface EnrollmentTeacher {
  enrollmentId: string;
  teacherId: string;
  teacherDisplayName: string | null;
  groupName: string | null;
  joinedAt: string;
}

async function fetchTeachers(studentId: string): Promise<EnrollmentTeacher[]> {
  const { data, error } = await supabase
    .from('enrollment')
    .select('id, teacher_id, status, created_at, group_id, student_group(name), app_user!enrollment_teacher_id_fkey(display_name)')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (error) {
    // Fallback if the FK-named join isn't available: split into two queries.
    return fetchTeachersFallback(studentId);
  }
  const rows = (data as unknown as Array<{
    id: string;
    teacher_id: string;
    created_at: string;
    student_group: { name: string } | { name: string }[] | null;
    app_user: { display_name: string | null } | { display_name: string | null }[] | null;
  }> | null) ?? [];

  return rows.map((r) => {
    const sg = Array.isArray(r.student_group) ? r.student_group[0] : r.student_group;
    const au = Array.isArray(r.app_user) ? r.app_user[0] : r.app_user;
    return {
      enrollmentId: r.id,
      teacherId: r.teacher_id,
      teacherDisplayName: au?.display_name ?? null,
      groupName: sg?.name ?? null,
      joinedAt: r.created_at,
    };
  });
}

async function fetchTeachersFallback(studentId: string): Promise<EnrollmentTeacher[]> {
  const { data: enrollments, error: enrErr } = await supabase
    .from('enrollment')
    .select('id, teacher_id, created_at, group_id')
    .eq('student_id', studentId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (enrErr) throw enrErr;
  const rows = (enrollments ?? []) as Array<{
    id: string;
    teacher_id: string;
    created_at: string;
    group_id: string | null;
  }>;
  if (rows.length === 0) return [];

  const teacherIds = rows.map((r) => r.teacher_id);
  const { data: users } = await supabase
    .from('app_user')
    .select('id, display_name')
    .in('id', teacherIds);
  const userMap = new Map<string, string | null>(
    ((users ?? []) as Array<{ id: string; display_name: string | null }>).map((u) => [
      u.id,
      u.display_name,
    ]),
  );

  // Group names aren't critical here — student's group within a teacher's class
  // is the teacher's organizational view, not the student's. Skip the lookup.
  return rows.map((r) => ({
    enrollmentId: r.id,
    teacherId: r.teacher_id,
    teacherDisplayName: userMap.get(r.teacher_id) ?? null,
    groupName: null,
    joinedAt: r.created_at,
  }));
}

function ClassroomPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [joinOpen, setJoinOpen] = useState(false);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['classroom_teachers', user.id],
    queryFn: () => fetchTeachers(user.id),
    staleTime: 30_000,
  });

  const leaveMutation = useMutation({
    mutationFn: async (teacherId: string) => {
      const { error } = await supabase.rpc('leave_teacher', { p_teacher_id: teacherId });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classroom_teachers', user.id] });
      toastSuccess('Left classroom');
    },
    onError: (err) => toastError(err, 'Could not leave the classroom'),
  });

  return (
    <Stack maw={840} mx="auto" gap="xl" py="md">
      {/* Hero */}
      <Stack gap={4}>
        <Group gap={6} c="parchment.0" style={{ opacity: 0.85 }}>
          <School size={14} strokeWidth={2.2} />
          <Text size="xs" tt="uppercase" fw={700} lts={0.8}>
            Classroom
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
              الحلقة
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
              Your Teachers
            </Text>
          </Stack>
          <Button
            variant="white"
            color="dark"
            size="sm"
            leftSection={<UserPlus size={14} />}
            onClick={() => setJoinOpen(true)}
          >
            Join via code
          </Button>
        </Group>
      </Stack>

      {/* Teachers list */}
      <Card padding="lg" radius="xl" shadow="xl">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" color="sage.7" />
            <Text size="sm" c="dimmed">
              Loading teachers…
            </Text>
          </Group>
        ) : !teachers || teachers.length === 0 ? (
          <Stack align="center" gap="sm" py="xl">
            <School size={32} color="var(--mantine-color-sage-7)" strokeWidth={1.6} />
            <Text fw={600}>No teachers yet</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Ask a teacher for their 8-character invite code, then tap{' '}
              <strong>Join via code</strong> to start sharing your hifz progress with them.
            </Text>
          </Stack>
        ) : (
          <Stack gap="sm">
            {teachers.map((t) => (
              <Group
                key={t.enrollmentId}
                justify="space-between"
                align="center"
                p="sm"
                wrap="nowrap"
                style={{
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.55)',
                  border: '1px solid rgba(21,53,30,0.06)',
                }}
              >
                <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background:
                        'linear-gradient(135deg, var(--mantine-color-sage-7) 0%, var(--mantine-color-mihrab-9) 100%)',
                      color: 'var(--mantine-color-parchment-0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: '"Playfair Display", serif',
                      fontWeight: 700,
                    }}
                  >
                    <GraduationCap size={20} />
                  </div>
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fw={600} size="sm" truncate>
                      {t.teacherDisplayName ?? 'Unnamed teacher'}
                    </Text>
                    <Group gap={6} align="center">
                      <Text size="xs" c="dimmed">
                        Joined {new Date(t.joinedAt).toLocaleDateString()}
                      </Text>
                      {t.groupName && (
                        <Badge size="xs" variant="light" color="sage">
                          {t.groupName}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>
                <Menu shadow="md" width={180} position="bottom-end" withArrow>
                  <Menu.Target>
                    <Tooltip label="Manage">
                      <ActionIcon variant="subtle" size="sm" aria-label="Manage teacher">
                        <MoreVertical size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<DoorOpen size={14} />}
                      color="brick.7"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Leave ${t.teacherDisplayName ?? 'this teacher'}'s classroom? They will lose access to your hifz data until you rejoin.`,
                          )
                        ) {
                          leaveMutation.mutate(t.teacherId);
                        }
                      }}
                    >
                      Leave class
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            ))}
          </Stack>
        )}
      </Card>

      <JoinViaCodeModal
        opened={joinOpen}
        onClose={() => setJoinOpen(false)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['classroom_teachers', user.id] });
        }}
      />
    </Stack>
  );
}

function JoinViaCodeModal({
  opened,
  onClose,
  onSuccess,
}: {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 8) {
      setError('Enter the 8-character code your teacher shared with you.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: rpcError } = await supabase.rpc('enroll_via_code', { p_code: trimmed });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      toastError(rpcError, 'Could not join classroom');
      return;
    }
    await onSuccess();
    toastSuccess('Joined classroom');
    setCode('');
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Join a teacher's classroom" size="sm" centered>
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Ask your teacher for their 8-character invite code, then enter it below.
        </Text>
        <TextInput
          label="Invite code"
          placeholder="ABCD2345"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value.toUpperCase())}
          data-autofocus
          maxLength={8}
          styles={{ input: { letterSpacing: '0.1em', fontFamily: 'monospace', textTransform: 'uppercase' } }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
        {error && (
          <Text size="xs" c="brick.7">
            {error}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button color="sage" onClick={handleSubmit} loading={submitting}>
            Join
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
