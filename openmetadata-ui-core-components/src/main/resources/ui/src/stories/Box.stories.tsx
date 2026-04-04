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
import React from 'react';
import { Box } from '../components/base/box/box';

const meta = {
  title: 'Components/Box',
  component: Box,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    direction: {
      control: false,
      table: {
        type: { summary: '"row" | "col" | "row-reverse" | "col-reverse"' },
      },
    },
    align: {
      control: false,
      table: {
        type: {
          summary: '"start" | "center" | "end" | "stretch" | "baseline"',
        },
      },
    },
    justify: {
      control: false,
      table: {
        type: {
          summary:
            '"start" | "center" | "end" | "between" | "around" | "evenly"',
        },
      },
    },
    wrap: {
      control: false,
      table: { type: { summary: '"wrap" | "nowrap" | "wrap-reverse"' } },
    },
    gap: {
      control: false,
      table: {
        type: {
          summary:
            '0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 14 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64 | 72 | 80 | 96',
        },
      },
    },
    rowGap: {
      control: false,
      table: {
        type: {
          summary:
            '0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 14 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64 | 72 | 80 | 96',
        },
      },
    },
    colGap: {
      control: false,
      table: {
        type: {
          summary:
            '0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 14 | 16 | 20 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56 | 60 | 64 | 72 | 80 | 96',
        },
      },
    },
    inline: { control: false, table: { type: { summary: 'boolean' } } },
  },
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

const Tile = ({ children }: { children: React.ReactNode }) => (
  <div className="tw:rounded tw:bg-blue-100 tw:p-3 tw:text-center tw:text-sm tw:font-medium tw:text-blue-700">
    {children}
  </div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="tw:m-0 tw:text-xs tw:font-semibold tw:text-tertiary tw:uppercase tw:tracking-wide">
    {children}
  </p>
);

export const Default: Story = {
  render: () => (
    <div style={{ width: 500 }}>
      <Box gap={3}>
        <Tile>Item 1</Tile>
        <Tile>Item 2</Tile>
        <Tile>Item 3</Tile>
      </Box>
    </div>
  ),
};

export const Directions: StoryObj = {
  render: () => (
    <div
      style={{ width: 500, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(['row', 'col', 'row-reverse', 'col-reverse'] as const).map((dir) => (
        <div
          key={dir}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>direction="{dir}"</Label>
          <Box direction={dir} gap={2}>
            <Tile>A</Tile>
            <Tile>B</Tile>
            <Tile>C</Tile>
          </Box>
        </div>
      ))}
    </div>
  ),
};

export const AlignItems: StoryObj = {
  render: () => (
    <div
      style={{ width: 500, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(['start', 'center', 'end', 'stretch', 'baseline'] as const).map(
        (align) => (
          <div
            key={align}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>align="{align}"</Label>
            <Box
              align={align}
              gap={2}
              style={{
                height: 80,
                border: '1px dashed #d0d5dd',
                borderRadius: 8,
                padding: 8,
              }}>
              <Tile>Short</Tile>
              <div
                className="tw:rounded tw:bg-blue-100 tw:p-3 tw:text-center tw:text-sm tw:font-medium tw:text-blue-700"
                style={{ paddingTop: 20, paddingBottom: 20 }}>
                Tall
              </div>
              <Tile>Mid</Tile>
            </Box>
          </div>
        )
      )}
    </div>
  ),
};

export const JustifyContent: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(['start', 'center', 'end', 'between', 'around', 'evenly'] as const).map(
        (justify) => (
          <div
            key={justify}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Label>justify="{justify}"</Label>
            <Box
              justify={justify}
              style={{
                width: 400,
                border: '1px dashed #d0d5dd',
                borderRadius: 8,
                padding: 8,
              }}>
              <Tile>A</Tile>
              <Tile>B</Tile>
              <Tile>C</Tile>
            </Box>
          </div>
        )
      )}
    </div>
  ),
};

export const GapScale: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {([1, 2, 4, 6, 8, 12, 16] as const).map((gap) => (
        <div
          key={gap}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>gap={gap}</Label>
          <Box gap={gap}>
            <Tile>One</Tile>
            <Tile>Two</Tile>
            <Tile>Three</Tile>
          </Box>
        </div>
      ))}
    </div>
  ),
};

export const RowAndColGap: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label>rowGap={4} (vertical gap between rows)</Label>
        <Box direction="col" rowGap={4} style={{ width: 300 }}>
          <Box gap={2}>
            <Tile>A</Tile>
            <Tile>B</Tile>
          </Box>
          <Box gap={2}>
            <Tile>C</Tile>
            <Tile>D</Tile>
          </Box>
          <Box gap={2}>
            <Tile>E</Tile>
            <Tile>F</Tile>
          </Box>
        </Box>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Label>colGap={6} (horizontal gap between columns)</Label>
        <Box colGap={6} style={{ width: 300 }}>
          <Tile>Left</Tile>
          <Tile>Center</Tile>
          <Tile>Right</Tile>
        </Box>
      </div>
    </div>
  ),
};

export const Wrap: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {(['wrap', 'nowrap', 'wrap-reverse'] as const).map((w) => (
        <div
          key={w}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label>wrap="{w}"</Label>
          <Box
            gap={2}
            style={{
              width: 200,
              border: '1px dashed #d0d5dd',
              borderRadius: 8,
              padding: 8,
            }}
            wrap={w}>
            {['One', 'Two', 'Three', 'Four', 'Five'].map((n) => (
              <Tile key={n}>{n}</Tile>
            ))}
          </Box>
        </div>
      ))}
    </div>
  ),
};

export const Inline: StoryObj = {
  render: () => (
    <div style={{ maxWidth: 500 }}>
      <p
        className="tw:text-sm tw:text-secondary"
        style={{ margin: '0 0 16px 0' }}>
        Block flex (default): takes full width.
      </p>
      <Box className="tw:mb-4" gap={2}>
        <Tile>A</Tile>
        <Tile>B</Tile>
      </Box>
      <p className="tw:text-sm tw:text-secondary" style={{ margin: '16px 0' }}>
        Inline flex: sits inside text flow —{' '}
        <Box inline className="tw:align-middle" gap={1}>
          <Tile>X</Tile>
          <Tile>Y</Tile>
        </Box>{' '}
        — continues inline.
      </p>
    </div>
  ),
};

export const Composition: StoryObj = {
  render: () => (
    <div style={{ width: 400 }}>
      <Box
        className="tw:rounded-xl tw:ring-1 tw:ring-inset tw:ring-secondary tw:bg-primary tw:overflow-hidden"
        direction="col"
        gap={4}>
        <Box
          align="center"
          className="tw:px-4 tw:pt-4"
          gap={3}
          justify="between">
          <Box direction="col" gap={1}>
            <span className="tw:text-sm tw:font-semibold tw:text-primary">
              Dataset: orders
            </span>
            <span className="tw:text-xs tw:text-tertiary">
              Updated 2 hours ago
            </span>
          </Box>
          <div className="tw:rounded-md tw:bg-utility-brand-50 tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:text-utility-brand-700">
            Active
          </div>
        </Box>
        <Box className="tw:px-4" direction="col" gap={2}>
          <span className="tw:text-sm tw:text-secondary">
            This card layout is built entirely from nested Box primitives using
            direction, justify, align, and gap.
          </span>
        </Box>
        <Box
          className="tw:border-t tw:border-secondary tw:px-4 tw:py-3"
          gap={2}
          justify="end">
          <span className="tw:text-xs tw:text-tertiary">
            3 columns · 1.2M rows
          </span>
        </Box>
      </Box>
    </div>
  ),
};
