/*
 *  Copyright 2025 Collate.
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

import type { Meta, StoryObj } from '@storybook/react';
import React, { FC, useState } from 'react';
import { ICON_CATEGORIES } from '../icons/categories';
import * as Icons from '../icons/index';
import type { IconProps } from '../icons/types';

type IconComponent = FC<IconProps>;

const ALL_ICONS = Object.entries(Icons).filter(
  (entry): entry is [string, IconComponent] =>
    typeof entry[1] === 'function' && entry[0] !== 'IconProps'
);
const ALL_ICON_NAMES = new Set(ALL_ICONS.map(([name]) => name));

// Build resolved category list (only names that exist in the library)
const RESOLVED: Array<{ label: string; icons: Array<[string, IconComponent]> }> = [];
const CATEGORISED_NAMES = new Set<string>();

for (const [label, names] of Object.entries(ICON_CATEGORIES)) {
  const entries = names
    .filter((n) => ALL_ICON_NAMES.has(n))
    .map((n) => [n, Icons[n as keyof typeof Icons] as IconComponent] as [string, IconComponent]);
  if (entries.length > 0) {
    RESOLVED.push({ label, icons: entries });
    names.forEach((n) => CATEGORISED_NAMES.add(n));
  }
}

// Icons not assigned to any category
const UNCATEGORISED = ALL_ICONS.filter(([name]) => !CATEGORISED_NAMES.has(name));
if (UNCATEGORISED.length > 0) {
  RESOLVED.push({ label: 'Uncategorised', icons: UNCATEGORISED });
}

const TAB_LABELS = ['All', ...RESOLVED.map((c) => c.label)];

interface IconGridProps {
  size?: number;
}

const IconGrid: FC<IconGridProps> = ({ size = 20 }) => {
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const query = search.toLowerCase();

  const handleCopy = (name: string) => {
    navigator.clipboard
      .writeText(`import { ${name} } from '@openmetadata/ui-core-components/icons';`)
      .then(() => {
        setCopied(name);
        setTimeout(() => setCopied(null), 1200);
      });
  };

  const visibleCategories =
    activeTab === 'All'
      ? RESOLVED
      : RESOLVED.filter((c) => c.label === activeTab);

  const filteredCategories = visibleCategories
    .map(({ label, icons }) => ({
      label,
      icons: query ? icons.filter(([name]) => name.toLowerCase().includes(query)) : icons,
    }))
    .filter(({ icons }) => icons.length > 0);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div
        style={{
          borderBottom: '1px solid #eaecf0',
          display: 'flex',
          gap: '2px',
          overflowX: 'auto',
          padding: '8px 16px 0',
          scrollbarWidth: 'none',
          flexShrink: 0,
        }}>
        {TAB_LABELS.map((tab) => (
          <button
            key={tab}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #7f56d9' : '2px solid transparent',
              color: activeTab === tab ? '#6941c6' : '#667085',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: '11px',
              fontWeight: activeTab === tab ? 600 : 400,
              marginBottom: '-1px',
              padding: '6px 10px',
              whiteSpace: 'nowrap',
            }}
            onClick={() => {
              setActiveTab(tab);
              setSearch('');
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px 6px', flexShrink: 0 }}>
        <input
          placeholder="Search icons…"
          style={{
            border: '1px solid #d0d5dd',
            borderRadius: '6px',
            fontSize: '12px',
            outline: 'none',
            padding: '6px 10px',
            width: '220px',
          }}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Icon grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
        {filteredCategories.length === 0 && (
          <p style={{ color: '#667085', fontSize: '12px', marginTop: '16px' }}>
            No icons match &ldquo;{search}&rdquo;
          </p>
        )}

        {filteredCategories.map(({ label, icons }) => (
          <section key={label} style={{ marginBottom: '24px' }}>
            {/* Show section headings only in All tab */}
            {activeTab === 'All' && (
              <h2
                style={{
                  borderBottom: '1px solid #f2f4f7',
                  color: '#344054',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  margin: '0 0 10px',
                  paddingBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                {label}
                <span style={{ color: '#98a2b3', fontWeight: 400, marginLeft: '6px' }}>
                  {icons.length}
                </span>
              </h2>
            )}

            <div
              style={{
                display: 'grid',
                gap: '4px',
                gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
              }}>
              {icons.map(([name, Icon]) => (
                <button
                  key={name}
                  title={`Click to copy import for ${name}`}
                  style={{
                    alignItems: 'center',
                    background: copied === name ? '#f0fdf4' : '#fff',
                    border: `1px solid ${copied === name ? '#86efac' : '#f2f4f7'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px 4px',
                    transition: 'border-color 0.1s',
                  }}
                  onClick={() => handleCopy(name)}>
                  <Icon color={copied === name ? '#16a34a' : '#344054'} size={size} />
                  <span
                    style={{
                      color: copied === name ? '#16a34a' : '#667085',
                      fontSize: '9px',
                      lineHeight: 1.3,
                      overflowWrap: 'break-word',
                      textAlign: 'center',
                      wordBreak: 'break-all',
                    }}>
                    {copied === name ? 'Copied!' : name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const meta = {
  title: 'Icons/Library',
  component: IconGrid,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    size: {
      control: { type: 'range', min: 12, max: 40, step: 4 },
      description: 'Icon size in px',
    },
  },
} satisfies Meta<typeof IconGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {
  name: 'All Icons',
  args: { size: 20 },
};
