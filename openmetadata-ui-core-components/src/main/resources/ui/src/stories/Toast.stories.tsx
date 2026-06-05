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
import { Button } from '../components/base/buttons/button';
import { Toast } from '../components/application/toast/toast';
import { ToastProvider } from '../components/application/toast/toast-provider';
import { toast } from '../components/application/toast/toast-store';

const meta = {
  title: 'Components/Toast',
  component: Toast,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    message: { control: 'text' },
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Static ──────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    message: 'Dashboard created successfully!',
  },
};

export const LongMessage: Story = {
  args: {
    message: 'Sharing settings saved for "Revenue Overview"',
  },
};

// ─── Live trigger ─────────────────────────────────────────────────────────────

export const LiveTrigger: StoryObj = {
  parameters: { layout: 'centered' },
  render: () => (
    <>
      <ToastProvider />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.show('Dashboard created successfully!')}>
          Dashboard created
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.show('Share link copied for "Revenue Overview"')}>
          Link copied
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.show('Added "Revenue Overview" to favorites')}>
          Added to favorites
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.show('Changes saved', { duration: 0 })}>
          Persistent (no auto-dismiss)
        </Button>
      </div>
    </>
  ),
};
