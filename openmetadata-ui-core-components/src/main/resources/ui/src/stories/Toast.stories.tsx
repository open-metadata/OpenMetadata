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
      useEffect(
        () => () => {
          toastQueue.clear();
        },
        []
      );

      return <Story />;
    },
  ],
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Individual variant previews ─────────────────────────────────────────────

export const Success: Story = {
  args: { position: 'bottom-center' },
  render: (args) => {
    useEffect(() => {
      toast.success('Dashboard created successfully!', { timeout: 0 });
    }, []);

    return <ToastProvider {...args} />;
  },
};

export const Error: Story = {
  args: { position: 'bottom-center' },
  render: (args) => {
    useEffect(() => {
      toast.error('Failed to save changes. Please try again.', { timeout: 0 });
    }, []);

    return <ToastProvider {...args} />;
  },
};

export const Warning: Story = {
  args: { position: 'bottom-center' },
  render: (args) => {
    useEffect(() => {
      toast.warning('You have unsaved changes.', { autoDismiss: false });
    }, []);

    return <ToastProvider {...args} />;
  },
};

export const Info: Story = {
  args: { position: 'bottom-center' },
  render: (args) => {
    useEffect(() => {
      toast.info('A new version is available.', { timeout: 0 });
    }, []);

    return <ToastProvider {...args} />;
  },
};

// ─── Stacking ─────────────────────────────────────────────────────────────────

export const Stacked: Story = {
  args: { position: 'bottom-center' },
  render: (args) => {
    useEffect(() => {
      toast.success('Dashboard created successfully!', { timeout: 0 });
      toast.warning('You have unsaved changes.', { autoDismiss: false });
      toast.error('Failed to connect to the data source.', { timeout: 0 });
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
          onClick={() => toast.success('Dashboard created successfully!')}>
          Success
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() =>
            toast.error('Failed to save changes. Please try again.')
          }>
          Error (with close)
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.warning('You have unsaved changes.')}>
          Warning
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.info('A new version is available.')}>
          Info
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.show('Link copied to clipboard.')}>
          Default
        </Button>
      </div>
    </>
  ),
};
