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
import { Dropdown, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isString } from 'lodash';
import { FC, Key, ReactElement, ReactNode } from 'react';
import { MenuItem as AriaMenuItem } from 'react-aria-components';

export interface ManageMenuItem {
  key: string;
  icon: SvgComponent;
  title: string;
  description?: string;
  disabled?: boolean;
  onClick: () => void;
  /**
   * Optional wrapper for the rendered item content (e.g. a licensing
   * LimitWrapper). Kept generic so this component stays feature-agnostic.
   */
  wrapper?: (node: ReactElement) => ReactNode;
}

export interface ManageMenuButtonProps {
  items: ManageMenuItem[];
  ariaLabel?: string;
  triggerClassName?: string;
  popoverClassName?: string;
}

/**
 * V1 of a core (untitled-ui) "manage" menu: a dots trigger that opens a
 * Dropdown of rich items (icon + title + description). Replaces the antd
 * ManageButton for surfaces that only need a list of actions; takes a plain
 * descriptor so callers don't build antd menu nodes.
 */
const ManageMenuButton: FC<ManageMenuButtonProps> = ({
  items,
  ariaLabel,
  triggerClassName,
  popoverClassName,
}) => {
  const handleAction = (key: Key) => {
    const item = items.find((option) => option.key === String(key));
    if (item && !item.disabled) {
      item.onClick();
    }
  };

  return (
    <Dropdown.Root>
      <Dropdown.DotsButton
        className={classNames(
          'tw:flex tw:items-center tw:justify-center tw:rounded-lg tw:bg-primary tw:p-2 tw:ring-1 tw:ring-primary tw:ring-inset tw:shadow-xs-skeuomorphic',
          triggerClassName
        )}
        data-testid="manage-button"
      />
      <Dropdown.Popover
        className={classNames('tw:w-87.5 tw:p-1.5', popoverClassName)}>
        <Dropdown.Menu
          aria-label={ariaLabel}
          disallowEmptySelection={false}
          selectionMode="none"
          onAction={handleAction}>
          {items.map((item) => {
            const content = (
              <div className="tw:flex tw:items-start tw:gap-3 tw:px-2.5 tw:py-2">
                <item.icon className="tw:mt-0.5 tw:size-5 tw:shrink-0 tw:text-fg-secondary" />
                <div className="tw:flex tw:flex-col tw:gap-0.5">
                  <Typography size="text-sm" weight="medium">
                    {item.title}
                  </Typography>
                  {item.description && (
                    <Typography className="tw:text-tertiary" size="text-xs">
                      {item.description}
                    </Typography>
                  )}
                </div>
              </div>
            );

            return (
              <AriaMenuItem
                className={({ isFocused, isDisabled }) =>
                  classNames(
                    'tw:cursor-pointer tw:rounded-md tw:outline-hidden',
                    {
                      'tw:bg-primary_hover': isFocused && !isDisabled,
                      'tw:cursor-not-allowed tw:opacity-50': isDisabled,
                    }
                  )
                }
                data-testid={item.key}
                id={item.key}
                isDisabled={item.disabled}
                key={item.key}
                textValue={isString(item.title) ? item.title : item.key}>
                {item.wrapper ? item.wrapper(content) : content}
              </AriaMenuItem>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default ManageMenuButton;
