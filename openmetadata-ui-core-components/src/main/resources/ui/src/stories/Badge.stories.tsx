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
import { HelpCircle } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Badge,
  BadgeIcon,
  BadgeWithButton,
  BadgeWithDot,
  BadgeWithIcon,
} from '../components/base/badges/badges';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Badge',
    type: 'pill-color',
    size: 'md',
    color: 'gray',
  },
};

export const PillColors: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge color="gray" type="pill-color">
        Gray
      </Badge>
      <Badge color="brand" type="pill-color">
        Brand
      </Badge>
      <Badge color="error" type="pill-color">
        Error
      </Badge>
      <Badge color="warning" type="pill-color">
        Warning
      </Badge>
      <Badge color="success" type="pill-color">
        Success
      </Badge>
      <Badge color="blue" type="pill-color">
        Blue
      </Badge>
      <Badge color="indigo" type="pill-color">
        Indigo
      </Badge>
      <Badge color="purple" type="pill-color">
        Purple
      </Badge>
      <Badge color="pink" type="pill-color">
        Pink
      </Badge>
      <Badge color="orange" type="pill-color">
        Orange
      </Badge>
      <Badge color="blue-dark" type="pill-color">
        Blue Dark
      </Badge>
    </div>
  ),
};

export const BadgeColors: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge color="gray" type="color">
        Gray
      </Badge>
      <Badge color="brand" type="color">
        Brand
      </Badge>
      <Badge color="error" type="color">
        Error
      </Badge>
      <Badge color="warning" type="color">
        Warning
      </Badge>
      <Badge color="success" type="color">
        Success
      </Badge>
      <Badge color="blue" type="color">
        Blue
      </Badge>
      <Badge color="indigo" type="color">
        Indigo
      </Badge>
      <Badge color="blue-dark" type="color">
        Blue Dark
      </Badge>
    </div>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Badge color="brand" size="sm" type="pill-color">
        Small
      </Badge>
      <Badge color="brand" size="md" type="pill-color">
        Medium
      </Badge>
      <Badge color="brand" size="lg" type="pill-color">
        Large
      </Badge>
    </div>
  ),
};

export const WithDot: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <BadgeWithDot color="gray" type="pill-color">
        Gray
      </BadgeWithDot>
      <BadgeWithDot color="brand" type="pill-color">
        Brand
      </BadgeWithDot>
      <BadgeWithDot color="error" type="pill-color">
        Error
      </BadgeWithDot>
      <BadgeWithDot color="success" type="pill-color">
        Success
      </BadgeWithDot>
      <BadgeWithDot color="warning" type="pill-color">
        Warning
      </BadgeWithDot>
    </div>
  ),
};

export const WithIcon: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <BadgeWithIcon color="gray" iconLeading={HelpCircle} type="pill-color">
        Gray Leading
      </BadgeWithIcon>
      <BadgeWithIcon color="brand" iconTrailing={HelpCircle} type="pill-color">
        Brand Trailing
      </BadgeWithIcon>
      <BadgeWithIcon color="success" iconLeading={HelpCircle} type="color">
        Success
      </BadgeWithIcon>
    </div>
  ),
};

export const WithButton: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <BadgeWithButton color="gray" type="pill-color">
        Gray
      </BadgeWithButton>
      <BadgeWithButton color="brand" type="pill-color">
        Brand
      </BadgeWithButton>
      <BadgeWithButton color="error" type="pill-color">
        Error
      </BadgeWithButton>
      <BadgeWithButton color="success" type="pill-color">
        Success
      </BadgeWithButton>
    </div>
  ),
};

export const IconOnly: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <BadgeIcon color="gray" icon={HelpCircle} type="pill-color" />
      <BadgeIcon color="brand" icon={HelpCircle} type="pill-color" />
      <BadgeIcon color="error" icon={HelpCircle} type="pill-color" />
      <BadgeIcon color="success" icon={HelpCircle} type="color" />
    </div>
  ),
};

/**
 * This badge is used for tags.
 */
export const BlueDarkTag: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge color="blue-dark" type="pill-color">
        Tag
      </Badge>
      <Badge color="blue-dark" size="lg" type="pill-color">
        Tag Large
      </Badge>
      <BadgeWithDot color="blue-dark" type="pill-color">
        Tag with Dot
      </BadgeWithDot>
      <BadgeWithIcon
        color="blue-dark"
        iconLeading={HelpCircle}
        type="pill-color">
        Tag with Icon
      </BadgeWithIcon>
      <BadgeWithButton color="blue-dark" type="pill-color">
        Removable Tag
      </BadgeWithButton>
    </div>
  ),
};

export const ModernStyle: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Badge color="gray" type="modern">
        Modern Badge
      </Badge>
      <BadgeWithDot color="gray" type="modern">
        With Dot
      </BadgeWithDot>
    </div>
  ),
};
