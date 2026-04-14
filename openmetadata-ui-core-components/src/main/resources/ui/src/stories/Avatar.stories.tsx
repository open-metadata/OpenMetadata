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
import { Avatar } from '../components/base/avatar/avatar';
import { AvatarLabelGroup } from '../components/base/avatar/avatar-label-group';
import { AvatarProfilePhoto } from '../components/base/avatar/avatar-profile-photo';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    size: 'md',
    initials: 'JD',
  },
};

export const WithImage: Story = {
  args: {
    size: 'md',
    src: 'https://i.pravatar.cc/150?img=1',
    alt: 'User avatar',
  },
};

export const WithInitials: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar initials="JD" size="xxs" />
      <Avatar initials="JD" size="xs" />
      <Avatar initials="JD" size="sm" />
      <Avatar initials="JD" size="md" />
      <Avatar initials="JD" size="lg" />
      <Avatar initials="JD" size="xl" />
      <Avatar initials="JD" size="2xl" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar size="xxs" src="https://i.pravatar.cc/150?img=1" />
      <Avatar size="xs" src="https://i.pravatar.cc/150?img=1" />
      <Avatar size="sm" src="https://i.pravatar.cc/150?img=1" />
      <Avatar size="md" src="https://i.pravatar.cc/150?img=1" />
      <Avatar size="lg" src="https://i.pravatar.cc/150?img=1" />
      <Avatar size="xl" src="https://i.pravatar.cc/150?img=1" />
      <Avatar size="2xl" src="https://i.pravatar.cc/150?img=1" />
    </div>
  ),
};

export const WithOnlineStatus: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar initials="JD" size="md" status="online" />
      <Avatar initials="JD" size="md" status="offline" />
    </div>
  ),
};

export const Verified: Story = {
  args: {
    size: 'md',
    initials: 'JD',
    verified: true,
  },
};

export const LabelGroup: StoryObj = {
  render: () => (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 300 }}>
      <AvatarLabelGroup
        initials="JD"
        size="sm"
        subtitle="john.doe@example.com"
        title="John Doe"
      />
      <AvatarLabelGroup
        size="md"
        src="https://i.pravatar.cc/150?img=1"
        subtitle="Software Engineer"
        title="Jane Smith"
      />
      <AvatarLabelGroup
        initials="AB"
        size="lg"
        subtitle="Product Manager"
        title="Alice Brown"
      />
      <AvatarLabelGroup
        size="xl"
        src="https://i.pravatar.cc/150?img=2"
        subtitle="Design Lead"
        title="Bob Wilson"
      />
    </div>
  ),
};

export const ProfilePhoto: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <AvatarProfilePhoto initials="JD" size="sm" />
      <AvatarProfilePhoto size="md" src="https://i.pravatar.cc/150?img=1" />
      <AvatarProfilePhoto initials="AB" size="lg" />
    </div>
  ),
};

export const ProfilePhotoVerified: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <AvatarProfilePhoto verified initials="JD" size="sm" />
      <AvatarProfilePhoto verified initials="JD" size="md" />
      <AvatarProfilePhoto verified initials="JD" size="lg" />
    </div>
  ),
};
