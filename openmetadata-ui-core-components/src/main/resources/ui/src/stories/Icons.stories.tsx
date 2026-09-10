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
import * as Icons from '../icons/index';
import type { IconProps } from '../icons-static/types';

type IconComponent = FC<IconProps>;

const ALL_ICONS = Object.entries(Icons).filter(
  (entry): entry is [string, IconComponent] =>
    typeof entry[1] === 'function' && entry[0] !== 'IconProps'
);

interface IconGridProps {
  size?: number;
}

const IconGrid: FC<IconGridProps> = ({ size = 20 }) => {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const query = search.toLowerCase();
  const filtered = query
    ? ALL_ICONS.filter(([name]) => name.toLowerCase().includes(query))
    : ALL_ICONS;

  const handleCopy = (name: string) => {
    navigator.clipboard
      .writeText(
        `import { ${name} } from '@openmetadata/ui-core-components/icons';`
      )
      .then(() => {
        setCopied(name);
        setTimeout(() => setCopied(null), 1200);
      });
  };

  return (
    <div
      style={{
        fontFamily: 'Inter, sans-serif',
        padding: '16px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
      {/* Search */}
      <div style={{ marginBottom: '12px' }}>
        <input
          placeholder={`Search ${ALL_ICONS.length} icons…`}
          style={{
            border: '1px solid #d0d5dd',
            borderRadius: '6px',
            fontSize: '13px',
            outline: 'none',
            padding: '7px 12px',
            width: '260px',
          }}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {query && (
          <span
            style={{ color: '#667085', fontSize: '12px', marginLeft: '10px' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Flat icon grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <p style={{ color: '#667085', fontSize: '13px' }}>
            No icons match &ldquo;{search}&rdquo;
          </p>
        )}
        <div
          style={{
            display: 'grid',
            gap: '4px',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          }}>
          {filtered.map(([name, Icon]) => (
            <button
              key={name}
              style={{
                alignItems: 'center',
                background: copied === name ? '#f0fdf4' : '#fff',
                border: `1px solid ${copied === name ? '#86efac' : '#f2f4f7'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                padding: '10px 6px',
                transition: 'border-color 0.1s',
              }}
              title={`Click to copy import for ${name}`}
              onClick={() => handleCopy(name)}>
              <Icon
                color={copied === name ? '#16a34a' : '#344054'}
                size={size}
              />
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
