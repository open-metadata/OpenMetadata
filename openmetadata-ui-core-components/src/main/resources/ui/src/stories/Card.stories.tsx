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
import { Card } from '../components/base/card/card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: false,
      table: {
        type: { summary: '"default" | "elevated" | "outlined" | "ghost"' },
      },
    },
    color: {
      control: false,
      table: {
        type: {
          summary: '"default" | "brand" | "error" | "warning" | "success"',
        },
      },
    },
    size: {
      control: false,
      table: { type: { summary: '"sm" | "md" | "lg"' } },
    },
    isClickable: { control: false, table: { type: { summary: 'boolean' } } },
    isSelected: { control: false, table: { type: { summary: 'boolean' } } },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card>
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Card title
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          This is a basic card with default styles applied.
        </p>
      </div>
    </Card>
  ),
};

export const WithImage: Story = {
  render: () => (
    <Card>
      <div className="tw:h-40 tw:bg-gradient-to-br tw:from-blue-400 tw:to-purple-500" />
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Card with image
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          Content below an image that overflows the card edges cleanly due to
          overflow-hidden.
        </p>
      </div>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card>
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Card with footer
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          Cards can contain any content including headers, body text, and
          footers.
        </p>
      </div>
      <div className="tw:border-t tw:border-secondary tw:px-6 tw:py-4">
        <p className="tw:text-xs tw:text-tertiary">Footer content</p>
      </div>
    </Card>
  ),
};

export const CustomWidth: Story = {
  render: () => (
    <Card className="tw:max-w-80">
      <div className="tw:p-6">
        <h2 className="tw:text-lg tw:font-semibold tw:text-primary">
          Narrower card
        </h2>
        <p className="tw:mt-2 tw:text-sm tw:text-secondary">
          The max-width can be overridden via className.
        </p>
      </div>
    </Card>
  ),
};

export const WithSubComponents: StoryObj = {
  render: () => (
    <div style={{ width: 360 }}>
      <Card>
        <Card.Header
          extra={
            <button
              className="tw:rounded-md tw:bg-secondary tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:text-secondary tw:cursor-pointer"
              type="button">
              Edit
            </button>
          }
          subtitle="Last updated 2 hours ago"
          title="Dataset: orders"
        />
        <Card.Content>
          <p className="tw:text-sm tw:text-secondary">
            This card uses the composed sub-component API — Card.Header,
            Card.Content, and Card.Footer — each receiving padding from the
            shared size context.
          </p>
        </Card.Content>
        <Card.Footer>
          <p className="tw:text-xs tw:text-tertiary">3 columns · 1.2M rows</p>
        </Card.Footer>
      </Card>
    </div>
  ),
};

export const Variants: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {(['default', 'elevated', 'outlined', 'ghost'] as const).map(
        (variant) => (
          <div key={variant} style={{ width: 200 }}>
            <Card variant={variant}>
              <Card.Header subtitle="variant" title={variant} />
              <Card.Content>
                <p className="tw:text-sm tw:text-secondary">
                  Card with variant="{variant}"
                </p>
              </Card.Content>
            </Card>
          </div>
        )
      )}
    </div>
  ),
};

export const Colors: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {(['default', 'brand', 'error', 'warning', 'success'] as const).map(
        (color) => (
          <div key={color} style={{ width: 180 }}>
            <Card color={color}>
              <Card.Header subtitle="color" title={color} />
              <Card.Content>
                <p className="tw:text-sm tw:text-secondary">color="{color}"</p>
              </Card.Content>
            </Card>
          </div>
        )
      )}
    </div>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div
      style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <Card key={size} size={size}>
          <Card.Header
            subtitle="Padding scales with size"
            title={`size="${size}"`}
          />
          <Card.Content>
            <p className="tw:text-sm tw:text-secondary">
              Body content with size="{size}" padding.
            </p>
          </Card.Content>
          <Card.Footer>
            <p className="tw:text-xs tw:text-tertiary">
              Footer · size="{size}"
            </p>
          </Card.Footer>
        </Card>
      ))}
    </div>
  ),
};

export const Clickable: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ width: 240 }}>
        <Card>
          <Card.Header
            subtitle="isClickable=false (default)"
            title="Not clickable"
          />
          <Card.Content>
            <p className="tw:text-sm tw:text-secondary">
              No cursor change or hover effect.
            </p>
          </Card.Content>
        </Card>
      </div>
      <div style={{ width: 240 }}>
        <Card isClickable>
          <Card.Header subtitle="isClickable=true" title="Clickable" />
          <Card.Content>
            <p className="tw:text-sm tw:text-secondary">
              Cursor pointer and hover background applied.
            </p>
          </Card.Content>
        </Card>
      </div>
    </div>
  ),
};

export const Selected: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ width: 200 }}>
        <Card>
          <Card.Header subtitle="isSelected=false" title="Not selected" />
          <Card.Content>
            <p className="tw:text-sm tw:text-secondary">Default ring.</p>
          </Card.Content>
        </Card>
      </div>
      <div style={{ width: 200 }}>
        <Card isSelected>
          <Card.Header subtitle="isSelected=true" title="Selected" />
          <Card.Content>
            <p className="tw:text-sm tw:text-secondary">Brand ring applied.</p>
          </Card.Content>
        </Card>
      </div>
      <div style={{ width: 200 }}>
        <Card isClickable isSelected variant="elevated">
          <Card.Header subtitle="elevated" title="Selected + Clickable" />
          <Card.Content>
            <p className="tw:text-sm tw:text-secondary">
              Brand ring + hover shadow.
            </p>
          </Card.Content>
        </Card>
      </div>
    </div>
  ),
};

export const CardWithAllProps: StoryObj = {
  render: () => (
    <div style={{ width: 360 }}>
      <Card isClickable isSelected color="brand" size="lg" variant="elevated">
        <Card.Header
          extra={
            <span className="tw:rounded-full tw:bg-utility-brand-100 tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:text-utility-brand-700">
              Active
            </span>
          }
          subtitle="variant=elevated · color=brand · size=lg"
          title="All props combined"
        />
        <Card.Content>
          <p className="tw:text-sm tw:text-secondary">
            This card combines isClickable, isSelected, elevated variant, brand
            color, and lg size — a comprehensive visual test of all props
            coexisting.
          </p>
        </Card.Content>
        <Card.Footer>
          <p className="tw:text-xs tw:text-tertiary">Footer content</p>
        </Card.Footer>
      </Card>
    </div>
  ),
};
