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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronUp } from '@openmetadata/ui-core-components/icons';
import { FC, useState } from 'react';

export interface ActivityToolbarMenuOption {
  value: string;
  label: string;
  icon?: FC<{ className?: string }>;
  // Shown at the row's end, e.g. how many items the option holds.
  count?: string;
}

export interface ActivityToolbarMenuProps {
  // Heading inside the menu, e.g. "Group by".
  title: string;
  // Trigger text; the selected option's label when omitted.
  triggerLabel?: string;
  triggerIcon: FC<{ className?: string }>;
  options: ActivityToolbarMenuOption[];
  value: string;
  onChange: (value: string) => void;
  'data-testid'?: string;
}

/** A single-choice toolbar menu: a heading over one row per option. */
const ActivityToolbarMenu = ({
  title,
  triggerLabel,
  triggerIcon,
  options,
  value,
  onChange,
  'data-testid': testId,
}: ActivityToolbarMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Dropdown.Root onOpenChange={setIsOpen}>
      <Button
        color="secondary"
        data-testid={testId}
        iconLeading={triggerIcon}
        iconTrailing={isOpen ? ChevronUp : ChevronDown}
        // The size FilterSelect gives its bordered trigger, so the Type filter
        // beside these menus stands as tall as they do.
        size="md">
        {triggerLabel ?? selected?.label}
      </Button>
      <Dropdown.Popover className="tw:w-56" placement="bottom end">
        <Dropdown.Menu
          aria-label={title}
          selectedKeys={[value]}
          selectionMode="single"
          onAction={(key) => onChange(String(key))}>
          <Dropdown.Section>
            <Dropdown.SectionHeader className="tw:px-4 tw:pt-2 tw:pb-1 tw:text-xs tw:font-semibold tw:text-quaternary">
              {title}
            </Dropdown.SectionHeader>
            {options.map((option) => (
              <Dropdown.Item
                addon={option.count}
                icon={option.icon}
                id={option.value}
                key={option.value}
                label={option.label}
              />
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ActivityToolbarMenu;
