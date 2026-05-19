import { Link, useMatchRoute } from '@tanstack/react-router';
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  Settings as SettingsIcon,
  Sun,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@tahfeedh/shared';
import classes from './AppSidebar.module.css';

interface NavItem {
  label: string;
  arabic: string;
  to: string;
  icon: LucideIcon;
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Today',     arabic: 'اليوم',     to: '/today',    icon: Sun },
  { label: 'Tests',     arabic: 'الاختبارات', to: '/tests',    icon: GraduationCap },
  { label: 'Timeline',  arabic: 'السجل',     to: '/timeline', icon: CalendarDays },
  { label: 'My Mushaf', arabic: 'مصحفي',     to: '/mushaf',   icon: BookOpen },
  { label: 'Goals',     arabic: 'الأهداف',   to: '/goals',    icon: Target },
  { label: 'Settings',  arabic: 'الإعدادات', to: '/settings', icon: SettingsIcon },
];

const TEACHER_NAV: NavItem[] = [
  { label: 'Students',  arabic: 'الطلاب',     to: '/students', icon: Users },
  { label: 'Groups',    arabic: 'الحلقات',    to: '/groups',   icon: LayoutGrid },
  { label: 'Tests',     arabic: 'الاختبارات', to: '/tests',    icon: GraduationCap },
  { label: 'Settings',  arabic: 'الإعدادات',  to: '/settings', icon: SettingsIcon },
];

function NavRow({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute();
  const isActive = !!matchRoute({ to: item.to, fuzzy: false });
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={classes.navItem}
      data-active={isActive}
      title={item.label}
      aria-label={item.label}
    >
      <Icon className={classes.icon} size={20} strokeWidth={1.75} />
      <span className={classes.label}>{item.label}</span>
      <span className={classes.labelArabic}>{item.arabic}</span>
    </Link>
  );
}

/**
 * Icon-rail with hover-expand overlay. The outer wrap stays 64px wide so the
 * AppShell layout reserves that space; on hover the inner panel grows to
 * 268px ABOVE the main content (z-index 50, box-shadow). Main content does
 * not resize.
 */
export function AppSidebar({ role }: { role: UserRole }) {
  const items = role === 'student' ? STUDENT_NAV : TEACHER_NAV;
  return (
    <div className={classes.railWrap}>
      <nav className={classes.rail} aria-label="Primary navigation">
        <div className={classes.brandMark}>
          <div className={classes.brandArabic}>تَحفِيظ</div>
          <div className={classes.brandEnglish}>Tahfeedh</div>
        </div>
        <div className={classes.items}>
          {items.map((item) => (
            <NavRow key={item.to} item={item} />
          ))}
        </div>
        <div className={classes.footer}>
          <span className={classes.footerCollapsed}>v0.1</span>
          <span className={classes.footerExpanded}>v0.1 · hackathon build</span>
        </div>
      </nav>
    </div>
  );
}
