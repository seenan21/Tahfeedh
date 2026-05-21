import { useState } from 'react';
import { Button, Group, Text } from '@mantine/core';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { apiFetch } from '../api/client';
import { startQfConnect, useQfStatus } from '../features/integrations/useQfStatus';
import { toastError, toastSuccess } from '../lib/toast';

/**
 * Bookmark CTA for the verse-detail modal. When connected to Quran.com, the
 * button POSTs to /api/qf-user/bookmarks and shows a toast. When disconnected,
 * the same row turns into a Connect CTA. ADR 0045 — explicit per-click is the
 * only path that writes to QF bookmarks now.
 */
export function VerseBookmarkButton({ surah, ayah }: { surah: number; ayah: number }) {
  const { data: status } = useQfStatus();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!status?.connected) {
    return (
      <Group
        gap="sm"
        wrap="nowrap"
        p="xs"
        style={{
          background: 'rgba(14, 124, 92, 0.08)',
          border: '1px solid rgba(14, 124, 92, 0.22)',
          borderRadius: 8,
        }}
      >
        <Bookmark size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
        <Text size="xs" style={{ flex: 1, minWidth: 0 }}>
          Connect Quran.com to bookmark this verse.
        </Text>
        <Button
          size="xs"
          variant="filled"
          color="sage.7"
          onClick={() => {
            void startQfConnect();
          }}
        >
          Connect
        </Button>
      </Group>
    );
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch<{ ok: true }>('/api/qf-user/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ surah, ayah }),
      });
      setSaved(true);
      toastSuccess(`Saved ${surah}:${ayah} to your Tahfeedh collection on Quran.com`);
    } catch (err) {
      toastError(err, "Couldn't save bookmark");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      onClick={save}
      loading={saving}
      disabled={saved}
      leftSection={saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      variant={saved ? 'light' : 'filled'}
      color="sage.7"
      fullWidth
    >
      {saved ? 'Saved to Quran.com' : 'Bookmark on Quran.com'}
    </Button>
  );
}
