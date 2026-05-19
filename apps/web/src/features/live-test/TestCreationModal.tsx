import { useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, NumberInput, SegmentedControl, Stack, Text, TextInput } from '@mantine/core';
import type { TestCreateInput, TestType } from '@tahfeedh/shared';
import { apiFetch } from '../../api/client';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (testId: string) => void;
}

export function TestCreationModal({ opened, onClose, onCreated }: Props) {
  const [testType, setTestType] = useState<TestType>('newly_memorized');
  const [pageStart, setPageStart] = useState<number | string>(1);
  const [pageEnd, setPageEnd] = useState<number | string>(1);
  const [witness, setWitness] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (opened) {
      setTestType('newly_memorized');
      setPageStart(1);
      setPageEnd(1);
      setWitness('');
      setError(null);
    }
  }, [opened]);

  const handleSubmit = async () => {
    const start = Number(pageStart);
    const end = Number(pageEnd);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 604) {
      setError('Page range must be 1–604 and end ≥ start.');
      return;
    }
    if (!witness.trim()) {
      setError('A witness name is required for guest-witnessed tests.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: TestCreateInput = {
        test_type: testType,
        test_mode: 'guest_teacher',
        ranges: [{ type: 'page', start, end }],
        guest_tester_name: witness.trim(),
      };
      const res = await apiFetch<{ id: string }>('/api/tests/create', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(res.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Begin Test" size="md" centered>
      <Stack gap="md">
        <Alert color="sage" variant="light" radius="md">
          <Text size="xs">
            Find a witness — a teacher, parent, or anyone who hears Quran. Self-administered tests
            aren’t tests. The pedagogy depends on a human ear (ADR 0004).
          </Text>
        </Alert>

        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            Test type
          </Text>
          <SegmentedControl
            value={testType}
            onChange={(v) => setTestType(v as TestType)}
            data={[
              { label: 'Newly memorized', value: 'newly_memorized' },
              { label: 'Revision', value: 'revision' },
            ]}
          />
        </Stack>

        <Group grow>
          <NumberInput
            label="Start page"
            value={pageStart}
            min={1}
            max={604}
            onChange={setPageStart}
          />
          <NumberInput
            label="End page"
            value={pageEnd}
            min={1}
            max={604}
            onChange={setPageEnd}
          />
        </Group>

        <TextInput
          label="Witness name"
          placeholder="e.g. Imam Yusuf, Mom, Friend"
          value={witness}
          onChange={(e) => setWitness(e.currentTarget.value)}
        />

        {error && (
          <Alert color="brick" variant="light">
            {error}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} color="sage">
            Begin
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
