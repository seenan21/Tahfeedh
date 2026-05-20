import { useEffect, useState } from 'react';
import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core';
import { BookmarkPlus, X } from 'lucide-react';
import { startQfConnect, useQfStatus } from './useQfStatus';
import { toastError } from '../../lib/toast';

const QC_TEAL = '#0E7C5C';
const DISMISS_KEY = 'qfBannerDismissed';

export function ConnectQuranComBanner() {
  const { data: status, isLoading } = useQfStatus();
  const [dismissed, setDismissed] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1') {
      setDismissed(true);
    }
  }, []);

  if (isLoading || dismissed) return null;
  if (status?.connected) return null;

  const handleConnect = async () => {
    setStarting(true);
    try {
      await startQfConnect();
    } catch (err) {
      toastError(err, 'Could not start Quran.com connection');
      setStarting(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        background:
          'linear-gradient(135deg, color-mix(in srgb, #0E7C5C 8%, #FFFFC1) 0%, #FFFFC1 100%)',
        border: `1px solid color-mix(in srgb, ${QC_TEAL} 30%, transparent)`,
        padding: '14px 18px',
        boxShadow: '0 4px 14px -8px rgba(14,124,92,0.4)',
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="md" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${QC_TEAL} 0%, #15351E 100%)`,
              color: '#FFFFC1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 6px 12px -6px ${QC_TEAL}`,
            }}
          >
            <BookmarkPlus size={20} strokeWidth={2} />
          </div>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={700} size="sm" c="mihrab.9">
              Sync your hifz to Quran.com
            </Text>
            <Text size="xs" c="mihrab.7" style={{ opacity: 0.85 }}>
              Bookmarks, goals, and your reading streak stay in sync across both apps.
            </Text>
          </Stack>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Button
            size="sm"
            radius="md"
            color="mihrab"
            variant="filled"
            loading={starting}
            onClick={handleConnect}
            style={{
              background: `linear-gradient(135deg, ${QC_TEAL} 0%, #0a5a43 100%)`,
            }}
          >
            Connect Quran.com
          </Button>
          <ActionIcon
            size="lg"
            radius="md"
            variant="subtle"
            color="mihrab"
            aria-label="Dismiss"
            onClick={handleDismiss}
          >
            <X size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </div>
  );
}
