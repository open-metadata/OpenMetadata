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
import { ButtonUtility, Dropdown } from '@openmetadata/ui-core-components';
import { DotsVertical } from '@openmetadata/ui-core-components/icons';
import { Key, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface MoreOption {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface WidgetMoreOptionsProps {
  menuItems: MoreOption[];
  onMenuClick: (key: string) => void;
  className?: string;
}

const WidgetMoreOptions = ({
  menuItems,
  onMenuClick,
  className = '',
}: WidgetMoreOptionsProps) => {
  const { t } = useTranslation();

  return (
    <Dropdown.Root>
      <ButtonUtility
        aria-label={t('label.more-action-plural')}
        className={className}
        color="secondary"
        data-testid="more-options-button"
        icon={DotsVertical}
        size="sm"
      />
      <Dropdown.Popover className="tw:w-42" placement="bottom start">
        <Dropdown.Menu
          aria-label={t('label.more-action-plural')}
          disabledKeys={menuItems
            .filter((item) => item.disabled)
            .map((item) => item.key)}
          selectionMode="none"
          onAction={(key: Key) => onMenuClick?.(String(key))}>
          {menuItems.map((item) => (
            <Dropdown.Item id={item.key} key={item.key} textValue={item.label}>
              <span className="tw:flex tw:items-center tw:gap-2">
                {item.icon}
                {item.label}
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default WidgetMoreOptions;
