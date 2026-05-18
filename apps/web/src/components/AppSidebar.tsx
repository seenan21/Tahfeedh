import { Link } from '@tanstack/react-router';
import { Stack, Text } from '@mantine/core';
import type { CSSProperties } from 'react';
import type { UserRole } from '@tahfeedh/shared';

interface NavItem {
  label: string;
  to: string;
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Today',     to: '/today' },
  { label: 'Tests',     to: '/tests' },
  { label: 'Timeline',  to: '/timeline' },
  { label: 'My Mushaf', to: '/mushaf' },
  { label: 'Goals',     to: '/goals' },
  { label: 'Settings',  to: '/settings' },
];

const TEACHER_NAV: NavItem[] = [
  { label: 'Students',  to: '/students' },
  { label: 'Groups',    to: '/groups' },
  { label: 'Tests',     to: '/tests' },
  { label: 'Settings',  to: '/settings' },
];

const baseStyle: CSSProperties = {
  display: 'block',
  padding: '10px 14px',
  borderRadius: 8,
  borderLeft: '3px solid transparent',
  textDecoration: 'none',
  transition: 'background 150ms cubic-bezier(0.4, 0, 0.2, 1)',
};

const activeStyle: CSSProperties = {
  background: 'var(--mantine-color-sage-1)',
  borderLeft: '3px solid var(--mantine-color-mihrab-9)',
  fontWeight: 600,
};

export function AppSidebar({ role }: { role: UserRole }) {
  const items = role === 'student' ? STUDENT_NAV : TEACHER_NAV;
  return (
    <Stack gap="xs" p="md">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          style={baseStyle}
          activeProps={{ style: { ...baseStyle, ...activeStyle } }}
        >
          <Text c="mihrab.9" component="span">
            {item.label}
          </Text>
        </Link>
      ))}
    </Stack>
  );
}
