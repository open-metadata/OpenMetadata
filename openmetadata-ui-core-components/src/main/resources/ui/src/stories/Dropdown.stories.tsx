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
import { Folder, Edit01, HelpCircle, Trash01, User01 } from '../icons';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import type { Selection } from 'react-aria-components';
import { Button } from '../components/base/buttons/button';
import { Dropdown } from '../components/base/dropdown/dropdown';

const meta = {
  title: 'Components/Dropdown',
  component: Dropdown.Root,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Action menu built on react-aria `MenuTrigger`. `Dropdown.Item` supports a leading `icon`, a trailing `addon` (shortcut or count), `isDisabled`, `showCheckbox` (`checkboxSize` `xs` · `sm`) and `unstyled`. `Dropdown.Menu` defaults to `selectionMode="single"`: pass `selectedKeys` / `defaultSelectedKeys` and the selected item gets the brand background, icon, label and addon. Compose with `Dropdown.Section`, `Dropdown.SectionHeader` and `Dropdown.Separator`, and nest menus with `Dropdown.SubmenuTrigger`. `Dropdown.Popover` takes any react-aria `placement`.',
      },
    },
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
            <Dropdown.SectionHeader className="tw:px-3 tw:py-1.5 tw:text-xs tw:font-medium tw:text-fg-quaternary">
              Account
            </Dropdown.SectionHeader>
            <Dropdown.Item icon={User01} label="Profile" />
            <Dropdown.Item icon={HelpCircle} label="Help" />
          </Dropdown.Section>
          <Dropdown.Separator />
          <Dropdown.Section>
            <Dropdown.SectionHeader className="tw:px-3 tw:py-1.5 tw:text-xs tw:font-medium tw:text-fg-quaternary">
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

const OPTIONS = [
  { id: 'option-1', label: 'Option 1', count: 1204 },
  { id: 'option-2', label: 'Option 2', count: 387 },
  { id: 'option-3', label: 'Option 3', count: 96 },
];

// Wrapper-based stories show their usage, not `<XExample />`, under "Show code".
const WITH_SELECTION_SOURCE = `const [selected, setSelected] = useState<Selection>(new Set(['option-1']));

<Dropdown.Root>
  <Button color="secondary">Select option</Button>
  <Dropdown.Popover>
    <Dropdown.Menu
      aria-label="Options"
      selectedKeys={selected}
      onSelectionChange={setSelected}>
      {options.map((option) => (
        <Dropdown.Item
          addon={option.count.toLocaleString()}
          icon={Folder}
          id={option.id}
          key={option.id}
          label={option.label}
        />
      ))}
    </Dropdown.Menu>
  </Dropdown.Popover>
</Dropdown.Root>`;

const WITH_CHECKBOXES_SOURCE = `const [selected, setSelected] = useState<Selection>(
  new Set(['option-1', 'option-3'])
);

<Dropdown.Root>
  <Button color="secondary">Select options</Button>
  <Dropdown.Popover>
    <Dropdown.Menu
      aria-label="Options"
      disallowEmptySelection={false}
      selectedKeys={selected}
      selectionMode="multiple"
      onSelectionChange={setSelected}>
      {options.map((option) => (
        <Dropdown.Item
          showCheckbox
          addon={option.count.toLocaleString()}
          id={option.id}
          key={option.id}
          label={option.label}
        />
      ))}
    </Dropdown.Menu>
  </Dropdown.Popover>
</Dropdown.Root>`;

const NESTED_SUBMENUS_SOURCE = `const [theme, setTheme] = useState<Selection>(new Set(['light']));

<Dropdown.Root>
  <Button color="secondary">Open menu</Button>
  <Dropdown.Popover placement="right bottom">
    <Dropdown.Menu aria-label="Account" selectionMode="none">
      <Dropdown.Item id="profile" label="Profile" />
      <Dropdown.SubmenuTrigger>
        <Dropdown.Item id="settings" label="Settings" />
        <Dropdown.Popover placement="end top">
          <Dropdown.Menu aria-label="Settings" selectionMode="none">
            <Dropdown.Item id="general" label="General" />
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item id="appearance" label="Appearance" />
              <Dropdown.Popover placement="end top">
                <Dropdown.Menu
                  aria-label="Appearance"
                  selectedKeys={theme}
                  onSelectionChange={setTheme}>
                  <Dropdown.Item id="light" label="Light" />
                  <Dropdown.Item id="dark" label="Dark" />
                  <Dropdown.Item id="system" label="System" />
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
            <Dropdown.Item id="notifications" label="Notifications" />
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.SubmenuTrigger>
      <Dropdown.Item id="help" label="Help" />
      <Dropdown.Separator />
      <Dropdown.Item id="logout" label="Log out" />
    </Dropdown.Menu>
  </Dropdown.Popover>
</Dropdown.Root>`;

const WithSelectionExample = () => {
  const [selected, setSelected] = useState<Selection>(new Set(['option-1']));

  return (
    <Dropdown.Root>
      <Button color="secondary">Select option</Button>
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label="Options"
          selectedKeys={selected}
          onSelectionChange={setSelected}>
          {OPTIONS.map((option) => (
            <Dropdown.Item
              addon={option.count.toLocaleString()}
              icon={Folder}
              id={option.id}
              key={option.id}
              label={option.label}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export const WithSelection: StoryObj = {
  render: () => <WithSelectionExample />,
  parameters: {
    docs: {
      source: { code: WITH_SELECTION_SOURCE },
      description: {
        story:
          'Single selection via `selectedKeys`. The selected item gets the brand background, and its icon, label and addon switch to the brand tint.',
      },
    },
  },
};

const WithCheckboxesExample = () => {
  const [selected, setSelected] = useState<Selection>(
    new Set(['option-1', 'option-3'])
  );

  return (
    <Dropdown.Root>
      <Button color="secondary">Select options</Button>
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label="Options"
          disallowEmptySelection={false}
          selectedKeys={selected}
          selectionMode="multiple"
          onSelectionChange={setSelected}>
          {OPTIONS.map((option) => (
            <Dropdown.Item
              showCheckbox
              addon={option.count.toLocaleString()}
              id={option.id}
              key={option.id}
              label={option.label}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export const WithCheckboxes: StoryObj = {
  render: () => <WithCheckboxesExample />,
  parameters: {
    docs: {
      source: { code: WITH_CHECKBOXES_SOURCE },
      description: {
        story:
          'Multiple selection with `selectionMode="multiple"` and `showCheckbox` on each item. Pass `disallowEmptySelection={false}` so the last item can be cleared.',
      },
    },
  },
};

const NestedSubmenusExample = () => {
  const [theme, setTheme] = useState<Selection>(new Set(['light']));

  return (
    <Dropdown.Root>
      <Button color="secondary">Open menu</Button>
      <Dropdown.Popover placement="right bottom">
        <Dropdown.Menu aria-label="Account" selectionMode="none">
          <Dropdown.Item id="profile" label="Profile" />
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="settings" label="Settings" />
            <Dropdown.Popover placement="end top">
              <Dropdown.Menu aria-label="Settings" selectionMode="none">
                <Dropdown.Item id="general" label="General" />
                <Dropdown.SubmenuTrigger>
                  <Dropdown.Item id="appearance" label="Appearance" />
                  <Dropdown.Popover placement="end top">
                    <Dropdown.Menu
                      aria-label="Appearance"
                      selectedKeys={theme}
                      onSelectionChange={setTheme}>
                      <Dropdown.Item id="light" label="Light" />
                      <Dropdown.Item id="dark" label="Dark" />
                      <Dropdown.Item id="system" label="System" />
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown.SubmenuTrigger>
                <Dropdown.Item id="notifications" label="Notifications" />
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
          <Dropdown.Item id="help" label="Help" />
          <Dropdown.Separator />
          <Dropdown.Item id="logout" label="Log out" />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export const NestedSubmenus: StoryObj = {
  render: () => <NestedSubmenusExample />,
  parameters: {
    layout: 'padded',
    docs: {
      source: { code: NESTED_SUBMENUS_SOURCE },
      description: {
        story:
          'Three levels via `Dropdown.SubmenuTrigger` (an item followed by a `Dropdown.Popover` with its own `Dropdown.Menu`). Items that open a submenu get a trailing chevron automatically. The root opens to the right of its trigger with `placement="right bottom"`; submenus use `placement="end top"`. The last level is a single-select menu, so the current theme shows the selected style.',
      },
    },
  },
};
