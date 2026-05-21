import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Button, Group, Loader, Stack, Text } from '@mantine/core';
import { ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { StudentMushafSurface } from '../mushaf/StudentMushafSurface';

export const Route = createFileRoute('/_authed/students/$studentId/mushaf')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: TeacherStudentMushafRoute,
});

interface TeacherStudentMeta {
  studentId: string;
  displayName: string | null;
}

async function fetchTeacherStudentMeta(
  teacherId: string,
  studentId: string,
): Promise<TeacherStudentMeta | null> {
  const { data: enrollment, error: enrErr } = await supabase
    .from('enrollment')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();
  if (enrErr || !enrollment) return null;

  const { data: appUser, error: userErr } = await supabase
    .from('app_user')
    .select('display_name')
    .eq('id', studentId)
    .maybeSingle();
  if (userErr) return null;

  return {
    studentId,
    displayName: (appUser as { display_name: string | null } | null)?.display_name ?? null,
  };
}

function TeacherStudentMushafRoute() {
  const { user } = Route.useRouteContext();
  const { studentId } = Route.useParams();
  const navigate = useNavigate();

  const { data: meta, isLoading } = useQuery({
    queryKey: ['teacher_student_meta', user.id, studentId],
    queryFn: () => fetchTeacherStudentMeta(user.id, studentId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" color="sage.7" />
      </Group>
    );
  }

  if (!meta) {
    return (
      <Stack maw={720} mx="auto" gap="md" py="xl" align="center">
        <Text fw={700} fz="lg" c="parchment.0">
          Student not found
        </Text>
        <Text size="sm" c="parchment.0" style={{ opacity: 0.85 }} ta="center">
          The student isn't actively enrolled with you, or the ID is invalid.
        </Text>
        <Button
          variant="white"
          onClick={() => navigate({ to: '/students' })}
          leftSection={<ArrowLeft size={14} />}
        >
          Back to Students
        </Button>
      </Stack>
    );
  }

  return (
    <StudentMushafSurface
      studentId={studentId}
      viewerRole="teacher"
      studentName={meta.displayName}
      onBack={() => navigate({ to: '/students/$studentId', params: { studentId } })}
    />
  );
}
