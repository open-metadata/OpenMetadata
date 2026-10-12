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
import {
  Check,
  ChevronDown,
  ChevronUp,
} from '@openmetadata/ui-core-components/icons';
import { FC, useState } from 'react';

// The design's toolbar triggers: 16px icons and 10/8px padding, so the
// sub-tabs and all three filters share one row.
export const ACTIVITY_TRIGGER_CLASS_NAME =
  'tw:gap-1.5 tw:py-2 tw:pr-2 tw:pl-2.5 tw:whitespace-nowrap tw:*:data-icon:size-4';

export interface ActivityToolbarMenuOption {
  value: string;
  label: string;
  icon: FC<{ className?: string }>;
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

/**
 * A single-choice toolbar menu as the design draws it: a heading, an icon per
 * option and a check on the chosen one, rather than a tinted row.
 */
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
        className={ACTIVITY_TRIGGER_CLASS_NAME}
        color="secondary"
        data-testid={testId}
        iconLeading={triggerIcon}
        iconTrailing={isOpen ? ChevronUp : ChevronDown}
        size="sm">
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
                // The check marks the choice, so the row keeps no tint.
                className="tw:[&>div]:bg-transparent! tw:hover:[&>div]:bg-primary_hover!"
                icon={option.icon}
                id={option.value}
                key={option.value}
                textValue={option.label}>
                {({ isSelected }) => (
                  <span className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                    {option.label}
                    {isSelected && (
                      <Check className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary" />
                    )}
                  </span>
                )}
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ActivityToolbarMenu;
