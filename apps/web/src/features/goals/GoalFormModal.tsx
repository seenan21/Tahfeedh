import { useEffect, useState } from 'react';
import {
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { apiFetch } from '../../api/client';
import { toastError, toastSuccess } from '../../lib/toast';

interface GoalFormModalProps {
  opened: boolean;
  onClose: () => void;
  studentId: string;
  /** Pre-fill for edit mode. Omit for create. */
  initial?: {
    id: string;
    title: string;
    description: string | null;
    target_date: string | null;
  };
}

interface QfGoalResponse {
  connected: boolean;
  qf_goal_id?: string | null;
  error?: boolean;
}

export function GoalFormModal({ opened, onClose, studentId, initial }: GoalFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = initial != null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState<string>('');
  const [targetPages, setTargetPages] = useState<number | ''>('');

  useEffect(() => {
    if (opened && initial) {
      setTitle(initial.title);
      setDescription(initial.description ?? '');
      setTargetDate(initial.target_date ?? '');
      setTargetPages('');
    } else if (opened && !initial) {
      setTitle('');
      setDescription('');
      setTargetDate('');
      setTargetPages('');
    }
  }, [opened, initial]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required');

      if (isEdit) {
        const { error } = await supabase
          .from('goal')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            target_date: targetDate || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initial!.id);
        if (error) throw error;
        return { id: initial!.id };
      }

      // Insert local row first.
      const { data: row, error } = await supabase
        .from('goal')
        .insert({
          student_id: studentId,
          title: title.trim(),
          description: description.trim() || null,
          target_date: targetDate || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Fire QF Goals create (best-effort). If we get a qf_goal_id back,
      // patch the local row so future edits/deletes can target the QF copy.
      try {
        const qfRes = await apiFetch<QfGoalResponse>('/api/qf-user/goals', {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            target_pages: typeof targetPages === 'number' ? targetPages : 0,
            target_date: targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10),
          }),
        });
        if (qfRes.qf_goal_id) {
          await supabase
            .from('goal')
            .update({ qf_goal_id: qfRes.qf_goal_id })
            .eq('id', row.id);
        } else if (qfRes.connected && qfRes.error) {
          // Saved locally; QF rejected.
          toastError(
            'Goal saved locally — couldn’t sync to Quran.com. It will retry next time.',
            'Quran.com sync',
          );
        }
      } catch (qfErr) {
        console.warn('[goal] QF create call failed:', qfErr);
      }

      return { id: row.id };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['goals', studentId] });
      toastSuccess(isEdit ? 'Goal updated' : 'Goal added');
      onClose();
    },
    onError: (err) => toastError(err, isEdit ? 'Could not update goal' : 'Could not add goal'),
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Edit goal' : 'New goal'}
      size="md"
      centered
    >
      <Stack gap="md">
        <TextInput
          label="Goal title"
          placeholder="Memorize Juz 30 by Ramadan"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
          data-autofocus
        />
        <Textarea
          label="Description"
          placeholder="Why this goal matters to you (optional)."
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          minRows={2}
          autosize
        />
        <Group grow>
          <TextInput
            label="Target date"
            description="ISO date — YYYY-MM-DD"
            placeholder="2026-09-01"
            value={targetDate}
            onChange={(e) => setTargetDate(e.currentTarget.value)}
            type="date"
          />
          {!isEdit && (
            <NumberInput
              label="Target pages"
              description="Sent to Quran.com to drive their weekly plan."
              value={targetPages}
              onChange={(v) => setTargetPages(typeof v === 'number' ? v : Number(v) || '')}
              min={1}
              max={604}
            />
          )}
        </Group>
        {!isEdit && (
          <Text size="xs" c="dimmed">
            If your Quran.com account is connected, this goal also syncs there so
            their app can show your progress against the same target.
          </Text>
        )}
        <Group justify="flex-end" gap="xs">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="mihrab"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {isEdit ? 'Save changes' : 'Add goal'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
