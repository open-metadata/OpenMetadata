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
import {
  ProgressBar,
  ProgressBarBase,
} from '../components/base/progress-indicators/progress-indicators';

const meta = {
  title: 'Components/ProgressIndicators',
  component: ProgressBar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: 65,
  },
  render: (args) => (
    <div style={{ width: 300 }}>
      <ProgressBar {...args} />
    </div>
  ),
};

export const BasicBar: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 300 }}>
      <ProgressBarBase value={0} />
      <ProgressBarBase value={25} />
      <ProgressBarBase value={50} />
      <ProgressBarBase value={75} />
      <ProgressBarBase value={100} />
    </div>
  ),
};

export const WithTextRight: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 300 }}>
      <ProgressBar labelPosition="right" value={25} />
      <ProgressBar labelPosition="right" value={50} />
      <ProgressBar labelPosition="right" value={75} />
    </div>
  ),
};

export const WithTextBottom: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 300 }}>
      <ProgressBar labelPosition="bottom" value={30} />
      <ProgressBar labelPosition="bottom" value={60} />
    </div>
  ),
};

export const WithFloatingLabel: StoryObj = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        width: 300,
        paddingTop: 32,
      }}>
      <ProgressBar labelPosition="top-floating" value={40} />
      <ProgressBar labelPosition="bottom-floating" value={70} />
    </div>
  ),
};

export const CustomFormatter: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 300 }}>
      <ProgressBar
        labelPosition="right"
        value={45}
        valueFormatter={(value) => `${value}/100`}
      />
      <ProgressBar
        labelPosition="right"
        max={200}
        min={0}
        value={120}
        valueFormatter={(value) => `${value} items`}
      />
    </div>
  ),
};
