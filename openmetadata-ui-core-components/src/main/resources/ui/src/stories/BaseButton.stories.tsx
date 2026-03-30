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
import { Edit01, Plus, Trash01 } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/base/buttons/button';

const meta = {
  title: 'Components/BaseButton',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Click me',
    color: 'primary',
    size: 'sm',
  },
};

export const Colors: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button color="primary">Primary</Button>
      <Button color="secondary">Secondary</Button>
      <Button color="tertiary">Tertiary</Button>
      <Button color="primary-destructive">Destructive</Button>
      <Button color="secondary-destructive">Secondary Destructive</Button>
      <Button color="tertiary-destructive">Tertiary Destructive</Button>
    </div>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button color="primary" size="sm">
        Small
      </Button>
      <Button color="primary" size="md">
        Medium
      </Button>
      <Button color="primary" size="lg">
        Large
      </Button>
      <Button color="primary" size="xl">
        XLarge
      </Button>
    </div>
  ),
};

export const WithLeadingIcon: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button color="primary" iconLeading={Plus}>
        Add Item
      </Button>
      <Button color="secondary" iconLeading={Edit01}>
        Edit
      </Button>
      <Button color="primary-destructive" iconLeading={Trash01}>
        Delete
      </Button>
    </div>
  ),
};

export const WithTrailingIcon: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Button color="primary" iconTrailing={Plus}>
        Add Item
      </Button>
      <Button color="secondary" iconTrailing={Edit01}>
        Edit
      </Button>
    </div>
  ),
};

export const IconOnly: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button color="primary" iconLeading={Plus} size="sm" />
      <Button color="secondary" iconLeading={Edit01} size="md" />
      <Button color="tertiary" iconLeading={Trash01} size="lg" />
    </div>
  ),
};

export const Loading: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button isLoading color="primary">
        Loading
      </Button>
      <Button isLoading color="secondary">
        Loading
      </Button>
      <Button isLoading showTextWhileLoading color="primary">
        Saving...
      </Button>
    </div>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button isDisabled color="primary">
        Disabled
      </Button>
      <Button isDisabled color="secondary">
        Disabled
      </Button>
      <Button isDisabled color="tertiary">
        Disabled
      </Button>
    </div>
  ),
};

export const LinkColors: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <Button color="link-gray">Link Gray</Button>
      <Button color="link-color">Link Color</Button>
      <Button color="link-destructive">Link Destructive</Button>
    </div>
  ),
};
