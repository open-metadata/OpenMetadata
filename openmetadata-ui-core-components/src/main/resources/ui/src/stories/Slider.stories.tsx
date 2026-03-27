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

export const WithBottomLabel: StoryObj = {
  render: () => (
    <div style={{ width: 300, paddingBottom: 32 }}>
      <Slider defaultValue={40} labelPosition="bottom" />
    </div>
  ),
};

export const WithFloatingLabel: StoryObj = {
  render: () => (
    <div style={{ width: 300, paddingTop: 40 }}>
      <Slider defaultValue={60} labelPosition="top-floating" />
    </div>
  ),
};

export const CustomRange: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Slider
        defaultValue={500}
        labelPosition="right"
        maxValue={1000}
        minValue={0}
      />
    </div>
  ),
};

export const CustomFormatter: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Slider
        defaultValue={75}
        labelFormatter={(value) => `${value}%`}
        labelPosition="bottom"
      />
    </div>
  ),
};

export const RangeSlider: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Slider defaultValue={[20, 80]} labelPosition="bottom" />
    </div>
  ),
};
