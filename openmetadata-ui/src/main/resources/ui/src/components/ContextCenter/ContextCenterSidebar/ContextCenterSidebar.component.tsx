/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { Menu01 } from '@untitledui/icons';
import { FC } from 'react';
import {
  ContextCenterNavItem,
  ContextCenterNavSection,
  ContextCenterSidebarProps,
} from './ContextCenterSidebar.interface';

// ─── Nav Item ─────────────────────────────────────────────────────────────────

interface NavItemProps {
  item: ContextCenterNavItem;
  isActive: boolean;
  onItemClick?: (key: string) => void;
}

const NavItem: FC<NavItemProps> = ({ item, isActive, onItemClick }) => {
  const { key, label, icon: Icon, count } = item;

  return (
    <button
      className={[
        'tw:w-full tw:flex tw:items-center tw:justify-between tw:gap-3 tw:px-3 tw:py-2.5 tw:rounded-lg tw:text-left tw:transition-colors tw:duration-100 tw:cursor-pointer tw:border-0',
        isActive
          ? 'tw:bg-[var(--color-bg-brand-secondary)] tw:text-[var(--color-text-brand)]'
          : 'tw:bg-transparent tw:text-[var(--color-text-secondary)] tw:hover:bg-[var(--color-bg-secondary)] tw:hover:text-[var(--color-text-primary)]',
      ].join(' ')}
      data-testid={`context-center-nav-${key}`}
      type="button"
      onClick={() => {
        item.onClick?.();
        onItemClick?.(key);
      }}>
      <span className="tw:flex tw:items-center tw:gap-3 tw:min-w-0">
        <Icon
          className={[
            'tw:w-5 tw:h-5 tw:flex-shrink-0',
            isActive
              ? 'tw:text-[var(--color-text-brand)]'
              : 'tw:text-[var(--color-text-tertiary)]',
          ].join(' ')}
          strokeWidth={1.5}
        />
        <span className="tw:text-sm tw:font-medium tw:truncate">{label}</span>
      </span>

      {count !== undefined && (
        <span
          className={[
            'tw:flex-shrink-0 tw:min-w-[24px] tw:h-6 tw:px-1.5 tw:rounded-full tw:text-xs tw:font-medium tw:flex tw:items-center tw:justify-center tw:border',
            isActive
              ? 'tw:bg-[var(--color-bg-brand-secondary)] tw:text-[var(--color-text-brand)] tw:border-[var(--color-border-brand)]'
              : 'tw:bg-transparent tw:text-[var(--color-text-tertiary)] tw:border-[var(--color-border-primary)]',
          ].join(' ')}>
          {count}
        </span>
      )}
    </button>
  );
};

// ─── Nav Section ──────────────────────────────────────────────────────────────

interface NavSectionProps {
  section: ContextCenterNavSection;
  activeKey?: string;
  onItemClick?: (key: string) => void;
}

const NavSection: FC<NavSectionProps> = ({
  section,
  activeKey,
  onItemClick,
}) => (
  <div
    className="tw:flex tw:flex-col tw:gap-0.5"
    data-testid={`context-center-section-${section.sectionKey}`}>
    {section.sectionLabel && (
      <p className="tw:text-xs tw:font-medium tw:text-[var(--color-text-tertiary)] tw:uppercase tw:tracking-wider tw:px-3 tw:py-1 tw:m-0">
        {section.sectionLabel}
      </p>
    )}
    {section.items.map((item) => (
      <NavItem
        isActive={activeKey === item.key}
        item={item}
        key={item.key}
        onItemClick={onItemClick}
      />
    ))}
  </div>
);

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const ContextCenterSidebar: FC<ContextCenterSidebarProps> = ({
  title,
  activeKey,
  sections,
  onItemClick,
}) => (
  <aside
    className="tw:w-64 tw:flex-shrink-0 tw:flex tw:flex-col tw:gap-4 tw:p-4 tw:bg-[var(--color-bg-primary)] tw:border-r tw:border-[var(--color-border-primary)] tw:h-full tw:overflow-y-auto"
    data-testid="context-center-sidebar">
    <div className="tw:flex tw:items-center tw:justify-between tw:px-1">
      <h2 className="tw:text-lg tw:font-bold tw:text-[var(--color-text-primary)] tw:m-0">
        {title}
      </h2>
      <button
        className="tw:p-1 tw:rounded-md tw:hover:text-[var(--color-text-primary)] tw:hover:bg-[var(--color-bg-secondary)] tw:border-0 tw:bg-transparent tw:cursor-pointer"
        data-testid="context-center-sidebar-menu"
        type="button">
        <Menu01 className="tw:w-5 tw:h-5" />
      </button>
    </div>

    <div className="tw:flex tw:flex-col tw:gap-5">
      {sections.map((section) => (
        <div key={section.sectionKey}>
          <NavSection
            activeKey={activeKey}
            section={section}
            onItemClick={onItemClick}
          />
        </div>
      ))}
    </div>
  </aside>
);

export default ContextCenterSidebar;
