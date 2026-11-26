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
import { Owner } from '../components/application/owner/owner';

const meta = {
  title: 'Components/Owner',
  component: Owner,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Owner>;

export default meta;
type Story = StoryObj<typeof meta>;

const OWNERS = [
  { id: 'u1', name: 'aaron', displayName: 'Aaron Johnson', type: 'user' },
  {
    id: 't1',
    name: 'data-platform',
    displayName: 'Data Platform',
    type: 'team',
  },
];

export const Default: Story = {
  args: {
    owners: OWNERS,
  },
};

export const NonCompact: Story = {
  args: {
    isCompactView: false,
    owners: OWNERS,
  },
};

// Each variant beside the kind of empty value it has to match.
export const EmptyPlaceholderVariants: Story = {
  args: {
    owners: [],
  },
  render: () => (
    <div className="tw:flex tw:flex-col tw:gap-6">
      <div className="tw:flex tw:items-start tw:gap-8">
        <div className="tw:flex tw:flex-col tw:gap-2">
          <span className="tw:text-sm tw:font-medium tw:text-secondary">
            Tier
          </span>
          <span className="tw:text-sm tw:font-medium tw:text-secondary">
            --
          </span>
        </div>
        <Owner
          showDashPlaceholder
          isCompactView={false}
          labelVariant="header"
          owners={[]}
        />
      </div>
      <div className="tw:flex tw:items-center tw:gap-8">
        <span className="tw:text-sm tw:text-quaternary">No description</span>
        <Owner
          isCompactView={false}
          labelVariant="cell"
          owners={[]}
          showLabel={false}
        />
      </div>
      <div className="tw:flex tw:items-center tw:gap-8">
        <span className="tw:text-xs tw:text-quaternary">No Domains</span>
        <Owner
          isCompactView={false}
          labelVariant="subtle"
          owners={[]}
          showLabel={false}
        />
      </div>
    </div>
  ),
};
