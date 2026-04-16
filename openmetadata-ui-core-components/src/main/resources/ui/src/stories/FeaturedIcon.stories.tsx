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
import { InfoCircle } from '@untitledui/icons';
import { FeaturedIcon } from '../components/foundations/featured-icon/featured-icon';

const meta = {
  title: 'Foundations/FeaturedIcon',
  component: FeaturedIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['brand', 'gray', 'success', 'warning', 'error'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
    },
    theme: {
      control: 'select',
      options: [
        'light',
        'gradient',
        'dark',
        'outline',
        'modern',
        'modern-neue',
      ],
    },
  },
} satisfies Meta<typeof FeaturedIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: InfoCircle,
    color: 'brand',
    size: 'md',
    theme: 'light',
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <FeaturedIcon color="brand" icon={InfoCircle} size="sm" theme="light" />
      <FeaturedIcon color="brand" icon={InfoCircle} size="md" theme="light" />
      <FeaturedIcon color="brand" icon={InfoCircle} size="lg" theme="light" />
      <FeaturedIcon color="brand" icon={InfoCircle} size="xl" theme="light" />
    </div>
  ),
};

export const Themes: StoryObj = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
        maxWidth: 720,
      }}>
      <FeaturedIcon color="brand" icon={InfoCircle} size="lg" theme="light" />
      <FeaturedIcon
        color="brand"
        icon={InfoCircle}
        size="lg"
        theme="gradient"
      />
      <FeaturedIcon color="brand" icon={InfoCircle} size="lg" theme="dark" />
      <FeaturedIcon color="brand" icon={InfoCircle} size="lg" theme="outline" />
      <FeaturedIcon color="brand" icon={InfoCircle} size="lg" theme="modern" />
      <FeaturedIcon
        color="brand"
        icon={InfoCircle}
        size="lg"
        theme="modern-neue"
      />
    </div>
  ),
};

export const Colors: StoryObj = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
        maxWidth: 720,
      }}>
      <FeaturedIcon color="brand" icon={InfoCircle} size="lg" theme="light" />
      <FeaturedIcon color="gray" icon={InfoCircle} size="lg" theme="light" />
      <FeaturedIcon color="success" icon={InfoCircle} size="lg" theme="light" />
      <FeaturedIcon color="warning" icon={InfoCircle} size="lg" theme="light" />
      <FeaturedIcon color="error" icon={InfoCircle} size="lg" theme="light" />
    </div>
  ),
};
