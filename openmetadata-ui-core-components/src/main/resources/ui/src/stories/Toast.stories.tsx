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

import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/base/buttons/button';
import { ToastProvider } from '../components/application/toast/toast-provider';
import { toast, toastQueue } from '../components/application/toast/toast-store';

const meta = {
  title: 'Components/Toast',
  component: ToastProvider,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    position: {
      control: 'select',
      options: [
        'top-right',
        'top-left',
        'top-center',
        'bottom-right',
        'bottom-left',
        'bottom-center',
      ],
    },
  },
  decorators: [
    (Story) => {
      useEffect(() => () => { toastQueue.clear(); }, []);
      return <Story />;
    },
  ],
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Static previews (fire on mount, no auto-dismiss) ────────────────────────

export const Default: Story = {
  args: { position: 'bottom-center' },
  render: (args) => {
    useEffect(() => {
      toast.show('Dashboard created successfully!', { timeout: 0 });
    }, []);
    return <ToastProvider {...args} />;
  },
};

export const LongMessage: Story = {
  args: { position: 'bottom-center' },
  render: (args) => {
    useEffect(() => {
      toast.show('Sharing settings saved for "Revenue Overview"', { timeout: 0 });
    }, []);
    return <ToastProvider {...args} />;
  },
};

// ─── Live trigger ─────────────────────────────────────────────────────────────

export const LiveTrigger: Story = {
  args: { position: 'bottom-center' },
  render: (args) => (
    <>
      <ToastProvider {...args} />
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
          onClick={() => toast.show('Changes saved', { timeout: 0 })}>
          Persistent (no auto-dismiss)
        </Button>
      </div>
    </>
  ),
};

// ─── Position showcase ────────────────────────────────────────────────────────

export const TopRight: Story = {
  args: { position: 'top-right' },
  render: (args) => {
    useEffect(() => {
      toast.show('Saved to top-right!', { timeout: 0 });
    }, []);
    return <ToastProvider {...args} />;
  },
};

export const TopCenter: Story = {
  args: { position: 'top-center' },
  render: (args) => {
    useEffect(() => {
      toast.show('Saved to top-center!', { timeout: 0 });
    }, []);
    return <ToastProvider {...args} />;
  },
};
