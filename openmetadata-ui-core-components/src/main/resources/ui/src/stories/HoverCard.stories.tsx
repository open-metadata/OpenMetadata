/*
 *  Copyright 2026 Collate.
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
import { HoverCard } from '../components/application/hover-card/hover-card';

const UserCard = () => (
  <div className="tw:flex tw:w-64 tw:items-center tw:gap-3">
    <Avatar initials="JD" size="md" />
    <div className="tw:flex tw:flex-col">
      <span className="tw:text-sm tw:font-semibold tw:text-primary">
        Jane Doe
      </span>
      <span className="tw:text-sm tw:text-tertiary">Data Steward</span>
    </div>
  </div>
);

const meta = {
  title: 'Components/HoverCard',
  component: HoverCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: {
    content: <UserCard />,
    children: (
      <a className="tw:text-sm tw:text-link" href="#jane">
        @jane.doe
      </a>
    ),
  },
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const TopPlacement: Story = {
  args: { placement: 'top', openDelay: 0 },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

export const Dark: Story = {
  parameters: { theme: 'dark' },
};
