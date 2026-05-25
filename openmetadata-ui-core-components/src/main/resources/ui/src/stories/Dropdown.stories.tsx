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
import { Edit01, HelpCircle, Trash01, User01 } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import { Dropdown } from '../components/base/dropdown/dropdown';

const meta = {
  title: 'Components/Dropdown',
  component: Dropdown.Root,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Dropdown.Root>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dropdown.Root>
      <Dropdown.DotsButton />
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Actions">
          <Dropdown.Item icon={Edit01} label="Edit" />
          <Dropdown.Item icon={User01} label="Invite user" />
          <Dropdown.Separator />
          <Dropdown.Item icon={HelpCircle} label="Help" />
          <Dropdown.Separator />
          <Dropdown.Item icon={Trash01} label="Delete" />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  ),
};

export const WithSections: StoryObj = {
  render: () => (
    <Dropdown.Root>
      <Dropdown.DotsButton />
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Actions with sections">
          <Dropdown.Section>
            <Dropdown.SectionHeader className="tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-fg-quaternary">
              Account
            </Dropdown.SectionHeader>
            <Dropdown.Item icon={User01} label="Profile" />
            <Dropdown.Item icon={HelpCircle} label="Help" />
          </Dropdown.Section>
          <Dropdown.Separator />
          <Dropdown.Section>
            <Dropdown.SectionHeader className="tw:px-3 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-fg-quaternary">
              Danger Zone
            </Dropdown.SectionHeader>
            <Dropdown.Item icon={Trash01} label="Delete" />
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  ),
};

export const WithAddon: StoryObj = {
  render: () => (
    <Dropdown.Root>
      <Dropdown.DotsButton />
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Actions with addons">
          <Dropdown.Item addon="⌘E" label="Edit" />
          <Dropdown.Item addon="⌘C" label="Copy" />
          <Dropdown.Item addon="⌘V" label="Paste" />
          <Dropdown.Separator />
          <Dropdown.Item addon="⌫" label="Delete" />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  ),
};

export const WithDisabledItem: StoryObj = {
  render: () => (
    <Dropdown.Root>
      <Dropdown.DotsButton />
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="Actions with disabled">
          <Dropdown.Item label="Edit" />
          <Dropdown.Item isDisabled label="Disabled Action" />
          <Dropdown.Separator />
          <Dropdown.Item label="Delete" />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  ),
};
