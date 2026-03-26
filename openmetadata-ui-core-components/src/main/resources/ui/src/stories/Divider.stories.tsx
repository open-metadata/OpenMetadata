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
import { Divider } from '../components/base/divider/divider';

const meta = {
  title: 'Components/Divider',
  component: Divider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Divider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: 400 }}>
      <Divider />
    </div>
  ),
};

export const Vertical: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', height: 48, alignItems: 'center', gap: 16 }}>
      <span>Left</span>
      <Divider orientation="vertical" />
      <span>Right</span>
    </div>
  ),
};

export const WithLabelCenter: StoryObj = {
  render: () => (
    <div style={{ width: 400 }}>
      <Divider label="Or continue with" />
    </div>
  ),
};

export const WithLabelStart: StoryObj = {
  render: () => (
    <div style={{ width: 400 }}>
      <Divider label="Section" labelAlign="start" />
    </div>
  ),
};

export const WithLabelEnd: StoryObj = {
  render: () => (
    <div style={{ width: 400 }}>
      <Divider label="End" labelAlign="end" />
    </div>
  ),
};

export const InContext: StoryObj = {
  render: () => (
    <div
      style={{ width: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0 }}>Some content above the divider.</p>
      <Divider />
      <p style={{ margin: 0 }}>Some content below the divider.</p>
      <Divider label="Or" />
      <p style={{ margin: 0 }}>Another section.</p>
    </div>
  ),
};
