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
import { useState } from 'react';
import { Slider } from '../components/base/slider/slider';

const meta = {
  title: 'Components/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultValue: 50,
  },
  render: (args) => (
    <div style={{ width: 300 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithBottomLabel: Story = {
  args: {
    defaultValue: 40,
    labelPosition: 'bottom',
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 32 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithFloatingLabel: Story = {
  args: {
    defaultValue: 60,
    labelPosition: 'top-floating',
  },
  render: (args) => (
    <div style={{ width: 300, paddingTop: 40 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithTopLabel: Story = {
  args: {
    defaultValue: 60,
    labelPosition: 'top',
  },
  render: (args) => (
    <div style={{ width: 300, paddingTop: 32 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithBottomFloatingLabel: Story = {
  args: {
    defaultValue: 60,
    labelPosition: 'bottom-floating',
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 40 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithHoverPreview: Story = {
  args: {
    defaultValue: 3,
    minValue: 1,
    maxValue: 5,
    step: 1,
    showHoverPreview: true,
    showRange: true,
    labelPosition: 'top-floating',
  },
  render: (args) => (
    <div style={{ width: 300, paddingTop: 40, paddingBottom: 16 }}>
      <Slider {...args} />
    </div>
  ),
};

export const CustomRange: Story = {
  args: {
    defaultValue: 500,
    minValue: 0,
    maxValue: 1000,
  },
  render: (args) => (
    <div style={{ width: 300 }}>
      <Slider {...args} />
    </div>
  ),
};

export const CustomFormatter: Story = {
  args: {
    defaultValue: 75,
    labelFormatter: (value) => `${value}%`,
    labelPosition: 'bottom',
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 32 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithFormatOptions: Story = {
  args: {
    defaultValue: 500,
    minValue: 0,
    maxValue: 1000,
    labelPosition: 'bottom',
    formatOptions: {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    },
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 32 }}>
      <Slider {...args} />
    </div>
  ),
};

export const RangeSlider: Story = {
  args: {
    defaultValue: [20, 80],
    labelPosition: 'bottom',
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 32 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithRange: Story = {
  args: {
    defaultValue: 50,
    showRange: true,
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 16 }}>
      <Slider {...args} />
    </div>
  ),
};

export const StepSliderWithRange: Story = {
  args: {
    defaultValue: 5,
    minValue: 1,
    maxValue: 10,
    step: 1,
    showRange: true,
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 16 }}>
      <Slider {...args} />
    </div>
  ),
};

export const WithRangeCount: Story = {
  args: {
    defaultValue: 5,
    minValue: 1,
    maxValue: 9,
    step: 1,
    rangeCount: 9,
    showRange: true,
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 16 }}>
      <Slider {...args} />
    </div>
  ),
};

// Verifies that the label prop is wired through to AriaLabel.
export const WithLabel: Story = {
  args: {
    label: 'Volume',
    defaultValue: 60,
    labelPosition: 'bottom',
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 32 }}>
      <Slider {...args} />
    </div>
  ),
};

const ControlledSliderDemo = () => {
  const [value, setValue] = useState(30);

  return (
    <div style={{ width: 300, paddingBottom: 16 }}>
      <Slider
        showRange
        label="Controlled"
        maxValue={100}
        minValue={0}
        step={10}
        value={value}
        onChange={(v) => {
          if (typeof v === 'number') {
            setValue(v);
          }
        }}
      />
      <button
        style={{ marginTop: 8, padding: '4px 12px' }}
        type="button"
        onClick={() => setValue(70)}>
        Set to 70
      </button>
    </div>
  );
};

// Verifies that showRange highlights stay in sync when the value is driven
// externally (controlled mode). Click "Set to 70" to confirm the marker
// highlight updates without moving the slider manually.
export const ControlledSlider: Story = {
  render: () => <ControlledSliderDemo />,
};

// Verifies that rangeCount={1} does not produce NaN labels.
// The component clamps rangeCount to a minimum of 2 internally.
export const RangeCountOne: Story = {
  args: {
    defaultValue: 50,
    showRange: true,
    rangeCount: 1,
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 16 }}>
      <Slider {...args} />
    </div>
  ),
};

// Verifies disabled state styling: filled track uses the disabled token,
// thumb becomes semi-transparent with a not-allowed cursor, and the hover
// preview ghost / tooltip are suppressed entirely.
export const Disabled: Story = {
  args: {
    defaultValue: 50,
    isDisabled: true,
    label: 'Disabled slider',
    labelPosition: 'bottom',
    showRange: true,
  },
  render: (args) => (
    <div style={{ width: 300, paddingBottom: 32 }}>
      <Slider {...args} />
    </div>
  ),
};
