import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface TeacherStudent {
  studentId: string;
  enrollmentId: string;
  displayName: string | null;
  email: string;
  groupId: string | null;
}

export interface TeacherGroup {
  groupId: string;
  name: string;
}

export interface TeacherDirectory {
  groups: TeacherGroup[];
  studentsByGroup: Map<string | null, TeacherStudent[]>;
}

interface EnrollmentRow {
  id: string;
  student_id: string;
  group_id: string | null;
  status: 'active' | 'paused' | 'completed';
}

interface AppUserRow {
  id: string;
  display_name: string | null;
}

interface StudentGroupRow {
  id: string;
  name: string;
}

async function fetchEnrollments(teacherId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollment')
    .select('id, student_id, group_id, status')
    .eq('teacher_id', teacherId)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []) as EnrollmentRow[];
}

async function fetchAppUsers(ids: string[]): Promise<AppUserRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('app_user')
    .select('id, display_name')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as AppUserRow[];
}

async function fetchGroups(teacherId: string): Promise<StudentGroupRow[]> {
  const { data, error } = await supabase
    .from('student_group')
    .select('id, name')
    .eq('teacher_id', teacherId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StudentGroupRow[];
}

export function useTeacherStudents(teacherId: string) {
  const queryClient = useQueryClient();

  const enrollmentsQuery = useQuery({
    queryKey: ['teacher_enrollments', teacherId],
    queryFn: () => fetchEnrollments(teacherId),
    staleTime: 30_000,
  });

  // ADR 0029: live-update the directory when a student joins (or leaves) via
  // an invite code. RLS gates payload visibility to this teacher's rows.
  useEffect(() => {
    if (!teacherId) return;
    const channel = supabase
      .channel(`teacher-enrollment-${teacherId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollment',
          filter: `teacher_id=eq.${teacherId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['teacher_enrollments', teacherId] });
          void queryClient.invalidateQueries({ queryKey: ['teacher_student_users', teacherId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [teacherId, queryClient]);

  const studentIds = useMemo(
    () => (enrollmentsQuery.data ?? []).map((e) => e.student_id),
    [enrollmentsQuery.data],
  );

  const usersQuery = useQuery({
    queryKey: ['teacher_student_users', teacherId, studentIds.sort().join(',')],
    queryFn: () => fetchAppUsers(studentIds),
    enabled: studentIds.length > 0,
    staleTime: 60_000,
  });

  const groupsQuery = useQuery({
    queryKey: ['teacher_groups', teacherId],
    queryFn: () => fetchGroups(teacherId),
    staleTime: 30_000,
  });

  const directory = useMemo<TeacherDirectory>(() => {
    const groups: TeacherGroup[] = (groupsQuery.data ?? []).map((g) => ({
      groupId: g.id,
      name: g.name,
    }));
    const userById = new Map<string, AppUserRow>();
    for (const u of usersQuery.data ?? []) userById.set(u.id, u);

    const studentsByGroup = new Map<string | null, TeacherStudent[]>();
    studentsByGroup.set(null, []);
    for (const g of groups) studentsByGroup.set(g.groupId, []);

    for (const e of enrollmentsQuery.data ?? []) {
      const u = userById.get(e.student_id);
      const list = studentsByGroup.get(e.group_id) ?? [];
      list.push({
        studentId: e.student_id,
        enrollmentId: e.id,
        displayName: u?.display_name ?? null,
        email: '',
        groupId: e.group_id,
      });
      studentsByGroup.set(e.group_id, list);
    }

    // Sort within each group by display name (case-insensitive), null names last.
    for (const list of studentsByGroup.values()) {
      list.sort((a, b) => {
        const an = (a.displayName ?? '').toLocaleLowerCase();
        const bn = (b.displayName ?? '').toLocaleLowerCase();
        if (!an && bn) return 1;
        if (an && !bn) return -1;
        return an.localeCompare(bn);
      });
    }
    return { groups, studentsByGroup };
  }, [enrollmentsQuery.data, usersQuery.data, groupsQuery.data]);

  return {
    directory,
    isLoading: enrollmentsQuery.isLoading || groupsQuery.isLoading || (studentIds.length > 0 && usersQuery.isLoading),
    refetch: async () => {
      await Promise.all([
        enrollmentsQuery.refetch(),
        usersQuery.refetch(),
        groupsQuery.refetch(),
      ]);
    },
  };
}
