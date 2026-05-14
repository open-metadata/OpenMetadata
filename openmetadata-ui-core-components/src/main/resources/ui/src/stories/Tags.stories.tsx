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
import { Tag, TagGroup, TagList } from '../components/base/tags/tags';

const meta = {
  title: 'Components/Tags',
  component: TagGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TagGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <TagGroup label="Technologies">
      <TagList>
        <Tag id="react">React</Tag>
        <Tag id="typescript">TypeScript</Tag>
        <Tag id="tailwind">Tailwind CSS</Tag>
      </TagList>
    </TagGroup>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TagGroup label="Small" size="sm">
        <TagList>
          <Tag id="sm1">Small Tag</Tag>
          <Tag id="sm2">Another Tag</Tag>
        </TagList>
      </TagGroup>
      <TagGroup label="Medium" size="md">
        <TagList>
          <Tag id="md1">Medium Tag</Tag>
          <Tag id="md2">Another Tag</Tag>
        </TagList>
      </TagGroup>
      <TagGroup label="Large" size="lg">
        <TagList>
          <Tag id="lg1">Large Tag</Tag>
          <Tag id="lg2">Another Tag</Tag>
        </TagList>
      </TagGroup>
    </div>
  ),
};

export const WithDot: StoryObj = {
  render: () => (
    <TagGroup label="Status" size="md">
      <TagList>
        <Tag dot id="active">
          Active
        </Tag>
        <Tag dot id="pending">
          Pending
        </Tag>
        <Tag dot id="inactive">
          Inactive
        </Tag>
      </TagList>
    </TagGroup>
  ),
};

export const WithCount: StoryObj = {
  render: () => (
    <TagGroup label="Filters" size="md">
      <TagList>
        <Tag count={42} id="all">
          All Items
        </Tag>
        <Tag count={15} id="active">
          Active
        </Tag>
        <Tag count={7} id="archived">
          Archived
        </Tag>
      </TagList>
    </TagGroup>
  ),
};

export const WithAvatar: StoryObj = {
  render: () => (
    <TagGroup label="Team" size="md">
      <TagList>
        <Tag avatarSrc="https://i.pravatar.cc/150?img=1" id="user1">
          John Doe
        </Tag>
        <Tag avatarSrc="https://i.pravatar.cc/150?img=2" id="user2">
          Jane Smith
        </Tag>
      </TagList>
    </TagGroup>
  ),
};

export const WithClose: StoryObj = {
  render: () => (
    <TagGroup label="Selected filters" size="md">
      <TagList>
        <Tag id="tag1" onClose={(id) => console.log('Remove:', id)}>
          React
        </Tag>
        <Tag id="tag2" onClose={(id) => console.log('Remove:', id)}>
          TypeScript
        </Tag>
        <Tag id="tag3" onClose={(id) => console.log('Remove:', id)}>
          Tailwind
        </Tag>
      </TagList>
    </TagGroup>
  ),
};

export const SingleSelection: StoryObj = {
  render: () => (
    <TagGroup label="Category" selectionMode="single" size="md">
      <TagList>
        <Tag id="design">Design</Tag>
        <Tag id="engineering">Engineering</Tag>
        <Tag id="product">Product</Tag>
        <Tag id="marketing">Marketing</Tag>
      </TagList>
    </TagGroup>
  ),
};

export const MultipleSelection: StoryObj = {
  render: () => (
    <TagGroup label="Tags" selectionMode="multiple" size="md">
      <TagList>
        <Tag id="react">React</Tag>
        <Tag id="vue">Vue</Tag>
        <Tag id="angular">Angular</Tag>
        <Tag id="svelte">Svelte</Tag>
      </TagList>
    </TagGroup>
  ),
};
