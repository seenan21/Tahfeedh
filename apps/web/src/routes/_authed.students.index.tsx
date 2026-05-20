import { useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Code,
  Collapse,
  CopyButton,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy as CopyIcon,
  Flame,
  Folder,
  FolderInput,
  FolderPlus,
  MoreVertical,
  Pencil,
  RefreshCw,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TestRating } from '@tahfeedh/shared';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  useTeacherStudents,
  type TeacherGroup,
  type TeacherStudent,
} from '../features/teacher/useTeacherStudents';

export const Route = createFileRoute('/_authed/students')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: StudentsPage,
});

function StudentsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { directory, isLoading, refetch } = useTeacherStudents(user.id);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<TeacherGroup | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Stack maw={1080} mx="auto" gap="xl" py="md">
      {/* Hero */}
      <Stack gap={4}>
        <Group gap={6} c="parchment.0" style={{ opacity: 0.85 }}>
          <Users size={14} strokeWidth={2.2} />
          <Text size="xs" tt="uppercase" fw={700} lts={0.8}>
            Students
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
              الطلاب
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
              Directory · Groups · Drill-in
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              variant="white"
              color="dark"
              size="sm"
              leftSection={<Share2 size={14} />}
              onClick={() => setInviteOpen(true)}
            >
              Invite a student
            </Button>
            <Button
              variant="white"
              color="dark"
              size="sm"
              leftSection={<FolderPlus size={14} />}
              onClick={() => setNewGroupOpen(true)}
            >
              New group
            </Button>
          </Group>
        </Group>
      </Stack>

      {/* Directory */}
      <Card padding="lg" radius="xl" shadow="xl">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader size="sm" color="sage.7" />
            <Text size="sm" c="dimmed">
              Loading directory…
            </Text>
          </Group>
        ) : directory.groups.length === 0 && (directory.studentsByGroup.get(null)?.length ?? 0) === 0 ? (
          <Stack align="center" gap="sm" py="xl">
            <Text fw={600}>No students yet</Text>
            <Text size="sm" c="dimmed" ta="center">
              Enroll a student via their 6-digit code to start.
            </Text>
          </Stack>
        ) : (
          <Stack gap="md">
            {directory.groups.map((g) => (
              <GroupSection
                key={g.groupId}
                group={g}
                students={directory.studentsByGroup.get(g.groupId) ?? []}
                allGroups={directory.groups}
                onRename={() => setRenamingGroup(g)}
                refetch={refetch}
              />
            ))}
            <GroupSection
              group={null}
              students={directory.studentsByGroup.get(null) ?? []}
              allGroups={directory.groups}
              refetch={refetch}
            />
          </Stack>
        )}
      </Card>

      <NewGroupModal
        opened={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        teacherId={user.id}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['teacher_groups', user.id] });
          await refetch();
        }}
      />
      <RenameGroupModal
        group={renamingGroup}
        onClose={() => setRenamingGroup(null)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['teacher_groups', user.id] });
          await refetch();
        }}
      />
      <InviteStudentModal opened={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Stack>
  );
}

interface GroupSectionProps {
  group: TeacherGroup | null;
  students: TeacherStudent[];
  allGroups: TeacherGroup[];
  onRename?: () => void;
  refetch: () => Promise<void>;
}

function GroupSection({ group, students, allGroups, onRename, refetch }: GroupSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!group) return;
      const { error } = await supabase.from('student_group').delete().eq('id', group.groupId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refetch();
    },
  });

  const isUngrouped = group == null;
  const label = isUngrouped ? 'Ungrouped' : group.name;

  return (
    <Stack gap={6}>
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group
          gap={8}
          align="center"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Folder size={16} color="var(--mantine-color-sage-7)" strokeWidth={2.2} />
          <Text fw={600}>{label}</Text>
          <Badge size="sm" variant="light" color="gray">
            {students.length}
          </Badge>
        </Group>
        {!isUngrouped && onRename && (
          <Menu shadow="md" width={180} position="bottom-end" withArrow>
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm" aria-label="Group actions">
                <MoreVertical size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Pencil size={14} />} onClick={onRename}>
                Rename
              </Menu.Item>
              <Menu.Item
                leftSection={<Trash2 size={14} />}
                color="brick.7"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete group "${group.name}"? Students in it move to "Ungrouped".`,
                    )
                  ) {
                    deleteMutation.mutate();
                  }
                }}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
      <Collapse in={expanded}>
        <Stack gap={4} pl={28}>
          {students.length === 0 ? (
            <Text size="xs" c="dimmed" fs="italic" py={4}>
              No students in this group.
            </Text>
          ) : (
            students.map((s) => (
              <StudentRow key={s.studentId} student={s} allGroups={allGroups} refetch={refetch} />
            ))
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}

interface LastTestRow {
  rating: TestRating | null;
  ended_at: string | null;
}

async function fetchStreak(studentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('daily_streak', { p_student_id: studentId });
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

async function fetchLastTest(studentId: string): Promise<LastTestRow | null> {
  const { data, error } = await supabase
    .from('test')
    .select('rating, ended_at')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data as LastTestRow | null;
}

function StudentRow({
  student,
  allGroups,
  refetch,
}: {
  student: TeacherStudent;
  allGroups: TeacherGroup[];
  refetch: () => Promise<void>;
}) {
  const navigate = useNavigate();

  const { data: streak } = useQuery({
    queryKey: ['teacher_student_streak', student.studentId],
    queryFn: () => fetchStreak(student.studentId),
    staleTime: 60_000,
  });
  const { data: lastTest } = useQuery({
    queryKey: ['teacher_student_last_test', student.studentId],
    queryFn: () => fetchLastTest(student.studentId),
    staleTime: 30_000,
  });

  const moveMutation = useMutation({
    mutationFn: async (targetGroupId: string | null) => {
      const { error } = await supabase
        .from('enrollment')
        .update({ group_id: targetGroupId })
        .eq('id', student.enrollmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refetch();
    },
  });

  const display = student.displayName ?? 'Unnamed student';

  const goToDrillIn = () =>
    navigate({ to: '/students/$studentId', params: { studentId: student.studentId } });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToDrillIn}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToDrillIn();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: 12,
        flexWrap: 'nowrap',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.55)',
        border: '1px solid rgba(21,53,30,0.06)',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background:
              'linear-gradient(135deg, var(--mantine-color-mihrab-9) 0%, var(--mantine-color-sage-7) 100%)',
            color: 'var(--mantine-color-parchment-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {(display.trim().charAt(0) || '?').toUpperCase()}
        </div>
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text fw={600} size="sm" truncate>
            {display}
          </Text>
          <Group gap={8} align="center">
            <Group gap={3} align="center">
              <Flame size={11} color="var(--mantine-color-brick-6)" strokeWidth={2.2} />
              <Text size="xs" c="dimmed">
                {streak ?? 0} day{(streak ?? 0) === 1 ? '' : 's'}
              </Text>
            </Group>
            {lastTest?.ended_at && (
              <Text size="xs" c="dimmed">
                · last test {relativeTime(lastTest.ended_at)}{lastTest.rating ? ` · ${lastTest.rating}` : ''}
              </Text>
            )}
          </Group>
        </Stack>
      </Group>
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
      >
        <Menu shadow="md" width={200} position="bottom-end" withArrow>
          <Menu.Target>
            <Tooltip label="Move to group">
              <ActionIcon variant="subtle" size="sm" aria-label="Move student to group">
                <FolderInput size={14} />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Move to group</Menu.Label>
            {allGroups.map((g) => (
              <Menu.Item
                key={g.groupId}
                disabled={g.groupId === student.groupId}
                onClick={() => moveMutation.mutate(g.groupId)}
              >
                {g.name}
              </Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item
              disabled={student.groupId == null}
              onClick={() => moveMutation.mutate(null)}
            >
              Remove from group
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'soon';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return day < 30 ? `${day}d ago` : `${Math.floor(day / 30)} mo ago`;
}

function NewGroupModal({
  opened,
  onClose,
  teacherId,
  onSuccess,
}: {
  opened: boolean;
  onClose: () => void;
  teacherId: string;
  onSuccess: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Group name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: insertError } = await supabase
      .from('student_group')
      .insert({ teacher_id: teacherId, name: trimmed });
    setSubmitting(false);
    if (insertError) {
      setError(insertError.code === '23505' ? 'A group with that name already exists.' : insertError.message);
      return;
    }
    await onSuccess();
    setName('');
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New group" size="sm" centered>
      <Stack gap="md">
        <TextInput
          label="Group name"
          placeholder="e.g. Evening Class"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
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
            Create
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function RenameGroupModal({
  group,
  onClose,
  onSuccess,
}: {
  group: TeacherGroup | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset local state when the modal target changes
  if (group && name !== group.name && !submitting && error == null) {
    // run-once initialization per opened-group
    setName(group.name);
  }

  async function handleSubmit() {
    if (!group) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Group name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: updateError } = await supabase
      .from('student_group')
      .update({ name: trimmed })
      .eq('id', group.groupId);
    setSubmitting(false);
    if (updateError) {
      setError(updateError.code === '23505' ? 'A group with that name already exists.' : updateError.message);
      return;
    }
    await onSuccess();
    onClose();
  }

  return (
    <Modal opened={group != null} onClose={onClose} title="Rename group" size="sm" centered>
      <Stack gap="md">
        <TextInput
          label="Group name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          data-autofocus
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
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

interface InviteCodeResult {
  code: string;
  expires_at: string;
}

async function fetchOrCreateInviteCode(): Promise<InviteCodeResult | null> {
  const { data, error } = await supabase.rpc('get_or_create_teacher_invite_code');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { code: row.code as string, expires_at: row.expires_at as string };
}

async function rotateInviteCode(): Promise<InviteCodeResult | null> {
  const { data, error } = await supabase.rpc('rotate_teacher_invite_code');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { code: row.code as string, expires_at: row.expires_at as string };
}

function InviteStudentModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data, isFetching, error } = useQuery({
    queryKey: ['teacher_invite_code'],
    queryFn: fetchOrCreateInviteCode,
    enabled: opened,
    staleTime: 60_000,
  });

  const rotateMutation = useMutation({
    mutationFn: rotateInviteCode,
    onSuccess: (next) => {
      queryClient.setQueryData(['teacher_invite_code'], next);
    },
  });

  const expiresLabel = data?.expires_at
    ? `Expires ${new Date(data.expires_at).toLocaleString()}`
    : '';

  return (
    <Modal opened={opened} onClose={onClose} title="Invite a student" size="md" centered>
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Share this 8-character code with a student. They'll enter it from their{' '}
          <strong>Classroom</strong> tab. The code stays active for 24 hours and can be used by
          multiple students.
        </Text>

        {isFetching && !data ? (
          <Group justify="center" py="md">
            <Loader size="sm" color="sage.7" />
          </Group>
        ) : error ? (
          <Text size="sm" c="brick.7">
            {error instanceof Error ? error.message : 'Could not load invite code.'}
          </Text>
        ) : data ? (
          <Stack gap="xs" align="center">
            <Code
              fz={36}
              fw={700}
              style={{
                letterSpacing: '0.18em',
                padding: '12px 20px',
                fontFamily: 'monospace',
                background: 'var(--mantine-color-parchment-0)',
                border: '1px solid rgba(21,53,30,0.12)',
              }}
            >
              {data.code}
            </Code>
            <Text size="xs" c="dimmed">
              {expiresLabel}
            </Text>
          </Stack>
        ) : null}

        <Group justify="space-between" align="center">
          <CopyButton value={data?.code ?? ''} timeout={1500}>
            {({ copied, copy }) => (
              <Button
                variant="light"
                color={copied ? 'sage' : 'gray'}
                leftSection={copied ? <Check size={14} /> : <CopyIcon size={14} />}
                onClick={copy}
                disabled={!data?.code}
              >
                {copied ? 'Copied' : 'Copy code'}
              </Button>
            )}
          </CopyButton>
          <Button
            variant="subtle"
            color="brick.7"
            leftSection={<RefreshCw size={14} />}
            loading={rotateMutation.isPending}
            onClick={() => {
              if (
                window.confirm(
                  'Rotate the code? The old code stops working immediately for new students.',
                )
              ) {
                rotateMutation.mutate();
              }
            }}
          >
            Rotate code
          </Button>
        </Group>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
