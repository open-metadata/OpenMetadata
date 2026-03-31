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

import { InfoCircle } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { Alert } from '../components/base/alert/alert';
import { Button } from '../components/base/buttons/button';

const textBlock = (subtitle: string) => <p style={{ margin: 0 }}>{subtitle}</p>;

const actions = (...buttons: React.ReactNode[]) => (
  <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>{buttons}</div>
);

const meta = {
  title: 'Components/Alert',
  component: Alert,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'error', 'brand', 'gray'],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: "We've just released a new feature",
    closable: true,
    onClose: () => {},
    children: (
      <>
        {textBlock(
          'lorem ipsum dolor sit amet consectetur adipisicing elit. aliquid pariatur, ipsum dolor.'
        )}
        {actions(
          <Button color="link-gray" key="dismiss" size="sm" onClick={() => {}}>
            Dismiss
          </Button>,
          <Button color="link-color" key="view" size="sm" onClick={() => {}}>
            View Changes
          </Button>
        )}
      </>
    ),
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Successfully published',
    closable: true,
    onClose: () => {},
    children: (
      <>
        {textBlock(
          'Your data asset has been published and is now visible to your team.'
        )}
        {actions(
          <Button color="link-color" key="view" size="sm" onClick={() => {}}>
            View asset
          </Button>
        )}
      </>
    ),
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    title: 'There was a problem with your request',
    closable: true,
    onClose: () => {},
    children: (
      <>
        {textBlock(
          'Your changes could not be saved. Please try again or contact support.'
        )}
        {actions(
          <Button color="link-gray" key="dismiss" size="sm" onClick={() => {}}>
            Dismiss
          </Button>,
          <Button color="link-color" key="retry" size="sm" onClick={() => {}}>
            Try again
          </Button>
        )}
      </>
    ),
  },
};

export const Brand: Story = {
  args: {
    variant: 'brand',
    title: 'New feature available',
    closable: true,
    onClose: () => {},
    children: (
      <>
        {textBlock(
          'You can now connect to more data sources directly from the dashboard.'
        )}
        {actions(
          <Button color="link-color" key="learn" size="sm" onClick={() => {}}>
            Learn more
          </Button>
        )}
      </>
    ),
  },
};

export const Gray: Story = {
  args: {
    variant: 'gray',
    title: 'Scheduled maintenance on Sunday at 2am UTC',
    closable: true,
    onClose: () => {},
    children: (
      <>
        {textBlock(
          'All services will be unavailable for approximately 30 minutes.'
        )}
        {actions(
          <Button color="link-gray" key="dismiss" size="sm" onClick={() => {}}>
            Dismiss
          </Button>,
          <Button color="link-color" key="details" size="sm" onClick={() => {}}>
            View details
          </Button>
        )}
      </>
    ),
  },
};

export const CustomIcon: Story = {
  args: {
    variant: 'warning',
    icon: InfoCircle,
    title: 'Your trial expires in 3 days',
    closable: true,
    onClose: () => {},
    children: (
      <>
        {textBlock('Upgrade your plan to keep access to all features.')}
        {actions(
          <Button color="link-color" key="upgrade" size="sm" onClick={() => {}}>
            Upgrade plan
          </Button>
        )}
      </>
    ),
  },
};

export const TitleOnly: Story = {
  args: {
    variant: 'warning',
    title: 'Scheduled maintenance on Sunday at 2am UTC.',
  },
};

export const WithoutCloseButton: Story = {
  args: {
    variant: 'warning',
    title: 'Scheduled maintenance on Sunday at 2am UTC.',
    closable: false,
    children: textBlock(
      'All services will be unavailable for approximately 30 minutes.'
    ),
  },
};

export const AllVariants: StoryObj = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 720,
      }}>
      <Alert
        closable
        title="Changes saved successfully"
        variant="success"
        onClose={() => {}}>
        {textBlock('Your metadata edits have been saved and indexed.')}
        {actions(
          <Button color="link-color" key="v" size="sm" onClick={() => {}}>
            View asset
          </Button>
        )}
      </Alert>
      <Alert
        closable
        title="We've just released a new feature"
        variant="warning"
        onClose={() => {}}>
        {textBlock(
          'lorem ipsum dolor sit amet consectetur adipisicing elit. aliquid pariatur, ipsum dolor.'
        )}
        {actions(
          <Button color="link-gray" key="d" size="sm" onClick={() => {}}>
            Dismiss
          </Button>,
          <Button color="link-color" key="v" size="sm" onClick={() => {}}>
            View Changes
          </Button>
        )}
      </Alert>
      <Alert
        closable
        title="Connection to the database failed"
        variant="error"
        onClose={() => {}}>
        {textBlock(
          'Unable to reach the configured data source. Check your credentials and network.'
        )}
        {actions(
          <Button color="link-gray" key="d" size="sm" onClick={() => {}}>
            Dismiss
          </Button>,
          <Button color="link-color" key="r" size="sm" onClick={() => {}}>
            Retry
          </Button>
        )}
      </Alert>
      <Alert
        closable
        title="New feature available"
        variant="brand"
        onClose={() => {}}>
        {textBlock(
          'You can now connect to more data sources directly from the dashboard.'
        )}
        {actions(
          <Button color="link-color" key="l" size="sm" onClick={() => {}}>
            Learn more
          </Button>
        )}
      </Alert>
      <Alert
        closable
        title="Scheduled maintenance on Sunday at 2am UTC"
        variant="gray"
        onClose={() => {}}>
        {textBlock(
          'All services will be unavailable for approximately 30 minutes.'
        )}
        {actions(
          <Button color="link-gray" key="d" size="sm" onClick={() => {}}>
            Dismiss
          </Button>,
          <Button color="link-color" key="v" size="sm" onClick={() => {}}>
            View details
          </Button>
        )}
      </Alert>
    </div>
  ),
};
