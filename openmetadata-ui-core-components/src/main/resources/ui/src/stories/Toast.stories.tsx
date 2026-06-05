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
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'error', 'warning', 'brand', 'default'],
    },
    title: { control: 'text' },
    description: { control: 'text' },
    closable: { control: 'boolean' },
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Static component stories ────────────────────────────────────────────────

export const Default: Story = {
  args: {
    variant: 'default',
    title: 'Dashboard created successfully!',
    closable: true,
    onClose: () => {},
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Changes saved successfully',
    description: 'Your metadata edits have been saved and indexed.',
    closable: true,
    onClose: () => {},
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    title: 'Something went wrong',
    description: 'Unable to reach the data source. Check your credentials.',
    closable: true,
    onClose: () => {},
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'Unsaved changes',
    description: 'You have unsaved changes that will be lost if you leave.',
    closable: true,
    onClose: () => {},
  },
};

export const Brand: Story = {
  args: {
    variant: 'brand',
    title: 'New feature available',
    description: 'You can now connect to more data sources from the dashboard.',
    closable: true,
    onClose: () => {},
  },
};

export const TitleOnly: Story = {
  args: {
    variant: 'success',
    title: 'Dashboard created successfully!',
    closable: false,
  },
};

export const WithoutCloseButton: Story = {
  args: {
    variant: 'brand',
    title: 'Syncing in progress…',
    description: 'This may take a few seconds.',
    closable: false,
  },
};

// ─── All variants at once ─────────────────────────────────────────────────────

export const AllVariants: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 384 }}>
      <Toast
        closable
        title="Dashboard created successfully!"
        variant="default"
        onClose={() => {}}
      />
      <Toast
        closable
        description="Your metadata edits have been saved."
        title="Changes saved"
        variant="success"
        onClose={() => {}}
      />
      <Toast
        closable
        description="Unable to reach the data source. Check your credentials."
        title="Connection failed"
        variant="error"
        onClose={() => {}}
      />
      <Toast
        closable
        description="You have unsaved changes that will be lost if you leave."
        title="Unsaved changes"
        variant="warning"
        onClose={() => {}}
      />
      <Toast
        closable
        description="You can now connect to more data sources from the dashboard."
        title="New feature available"
        variant="brand"
        onClose={() => {}}
      />
    </div>
  ),
};

// ─── Live trigger story ───────────────────────────────────────────────────────

export const LiveTrigger: StoryObj = {
  parameters: { layout: 'centered' },
  render: () => (
    <>
      <ToastProvider position="top-right" />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button
          color="secondary"
          size="sm"
          onClick={() => toast.default('Dashboard created successfully!')}>
          Default
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() =>
            toast.success('Changes saved', {
              description: 'Your metadata edits have been saved and indexed.',
            })
          }>
          Success
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() =>
            toast.error('Something went wrong', {
              description: 'Unable to reach the data source.',
            })
          }>
          Error
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() =>
            toast.warning('Unsaved changes', {
              description: 'Your changes will be lost if you leave.',
            })
          }>
          Warning
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() =>
            toast.info('New feature available', {
              description: 'Connect to more data sources from the dashboard.',
            })
          }>
          Info
        </Button>
        <Button
          color="secondary"
          size="sm"
          onClick={() =>
            toast.success('Saved!', { duration: 0, closable: true })
          }>
          Persistent (no auto-dismiss)
        </Button>
      </div>
    </>
  ),
};
