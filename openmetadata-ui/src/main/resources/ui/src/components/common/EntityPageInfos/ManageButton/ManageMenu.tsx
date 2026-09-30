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

import { ButtonUtility, Dropdown } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { noop } from 'lodash';
import { isValidElement, Key, ReactNode, useCallback, useMemo } from 'react';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { useIsLimitReached } from '../../../../context/LimitsProvider/useLimitsStore';

/**
 * Click payload handed to an item's `onClick`. Mirrors the antd menu info the
 * existing item builders were written against (several call
 * `e.domEvent.stopPropagation()`); core menu items already stop propagation,
 * so the DOM-event half is a no-op.
 */
export interface ManageMenuClickInfo {
  key: string;
  keyPath: string[];
  domEvent: { stopPropagation: () => void; preventDefault: () => void };
}

export interface ManageMenuItem {
  key: string;
  label: ReactNode;
  disabled?: boolean;
  /**
   * Limit resource the item creates (the `resource` of the `LimitWrapper`
   * around its label). The wrapper only greys out the label, so the menu
   * disables the item itself once that limit is reached.
   */
  limitResource?: string;
  onClick?: (info: ManageMenuClickInfo) => void;
}

interface ManageMenuProps {
  items: ManageMenuItem[];
  /** Accessible name and tooltip of the default trigger. */
  label: string;
  /** Replaces the default icon trigger; must be a single pressable element. */
  trigger?: ReactNode;
  triggerClassName?: string;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  'data-testid'?: string;
  menuTestId?: string;
}

const NOOP_DOM_EVENT = { stopPropagation: noop, preventDefault: noop };

type LegacyMenuItem = {
  key: Key;
  label: ReactNode;
  disabled?: boolean;
  limitResource?: string;
  onClick?: ManageMenuItem['onClick'];
};

const isLegacyMenuItem = (item: unknown): item is LegacyMenuItem =>
  typeof item === 'object' && item !== null && 'key' in item && 'label' in item;

/**
 * Adapts antd-shaped menu items (`{ key, label, onClick, disabled }`), which
 * entity pages still build for `extraDropdownContent`; dividers and other
 * non-item entries are dropped.
 */
export const toManageMenuItems = (
  items?: ReadonlyArray<unknown>
): ManageMenuItem[] =>
  (items ?? []).filter(isLegacyMenuItem).map((item) => ({
    key: String(item.key),
    label: item.label,
    disabled: item.disabled,
    limitResource: item.limitResource,
    onClick: item.onClick,
  }));

/**
 * Typeahead needs plain text, but labels are rich nodes — usually a
 * `ManageButtonItemLabel` (possibly inside a Tooltip or LimitWrapper) — so
 * prefer its `name`, else the label's text content.
 */
const getLabelText = (node: ReactNode): string => {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getLabelText).join('');
  }
  if (isValidElement<{ name?: ReactNode; children?: ReactNode }>(node)) {
    const { name, children } = node.props;

    return typeof name === 'string' ? name : getLabelText(children);
  }

  return '';
};

export const ManageMenu = ({
  items,
  label,
  trigger,
  triggerClassName,
  isOpen,
  onOpenChange,
  'data-testid': dataTestId = 'manage-button',
  menuTestId = 'manage-dropdown-list-container',
}: ManageMenuProps) => {
  const isLimitReached = useIsLimitReached();

  const disabledKeys = useMemo(
    () =>
      items
        .filter((item) => item.disabled || isLimitReached(item.limitResource))
        .map((item) => item.key),
    [items, isLimitReached]
  );

  const handleAction = useCallback(
    (key: Key) => {
      if (disabledKeys.includes(String(key))) {
        return;
      }
      const item = items.find((menuItem) => menuItem.key === String(key));
      item?.onClick?.({
        key: String(key),
        keyPath: [String(key)],
        domEvent: NOOP_DOM_EVENT,
      });
    },
    [items, disabledKeys]
  );

  return (
    <Dropdown.Root isOpen={isOpen} onOpenChange={onOpenChange}>
      {trigger ?? (
        <ButtonUtility
          className={classNames('tw:p-2', triggerClassName)}
          color="secondary"
          data-testid={dataTestId}
          icon={IconDropdown}
          size="xs"
          tooltip={label}
          tooltipPlacement="top end"
        />
      )}
      <Dropdown.Popover className="tw:w-88" placement="bottom end">
        <div data-testid={menuTestId}>
          <Dropdown.Menu
            aria-label={label}
            disabledKeys={disabledKeys}
            selectionMode="none"
            onAction={handleAction}>
            {items.map((item) => (
              <Dropdown.Item
                unstyled
                className={({ isFocused, isDisabled }) =>
                  classNames(
                    'tw:mx-1.5 tw:block tw:cursor-pointer tw:rounded-md tw:px-2.5 tw:py-2 tw:outline-hidden',
                    {
                      'tw:bg-primary_hover': isFocused,
                      'tw:cursor-not-allowed tw:opacity-50': isDisabled,
                    }
                  )
                }
                id={item.key}
                key={item.key}
                textValue={getLabelText(item.label) || item.key}>
                {item.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </div>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};
