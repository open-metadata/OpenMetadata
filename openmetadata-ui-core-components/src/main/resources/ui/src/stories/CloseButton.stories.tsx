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
import { CloseButton } from '../components/base/buttons/close-button';

const meta = {
  title: 'Components/CloseButton',
  component: CloseButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CloseButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'sm',
    theme: 'light',
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <CloseButton size="xs" />
      <CloseButton size="sm" />
      <CloseButton size="md" />
      <CloseButton size="lg" />
    </div>
  ),
};

export const Themes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{ padding: 8, background: 'white', borderRadius: 8 }}>
        <CloseButton theme="light" />
      </div>
      <div style={{ padding: 8, background: '#1a1a2e', borderRadius: 8 }}>
        <CloseButton theme="dark" />
      </div>
    </div>
  ),
};
