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
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { FC, Key, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface TaskActionSplitButtonItem {
  key: string;
  label: ReactNode;
  textValue: string;
  icon?: FC<{ className?: string }>;
  'data-testid'?: string;
}

interface TaskActionSplitButtonProps {
  /** Stamped as `${testIdPrefix}-primary` / `${testIdPrefix}-trigger`. */
  testIdPrefix: string;
  'data-testid'?: string;
  label: ReactNode;
  items: TaskActionSplitButtonItem[];
  selectedKey?: string;
  isDisabled?: boolean;
  isMenuDisabled?: boolean;
  isLoading?: boolean;
  onPrimaryPress: () => void;
  onAction: (key: string) => void;
}

/**
 * Primary action plus a caret menu of alternative actions, sharing one border.
 * The menu uses plain `menuitem` semantics; the current action is highlighted
 * rather than checked because picking an item also runs it.
 */
const TaskActionSplitButton = ({
  testIdPrefix,
  'data-testid': dataTestId,
  label,
  items,
  selectedKey,
  isDisabled,
  isMenuDisabled,
  isLoading,
  onPrimaryPress,
  onAction,
}: TaskActionSplitButtonProps) => {
  const { t } = useTranslation();

  return (
    <div className="tw:inline-flex" data-testid={dataTestId}>
      <Button
        className="tw:rounded-r-none"
        color="secondary"
        data-testid={`${testIdPrefix}-primary`}
        isDisabled={isDisabled}
        isLoading={isLoading}
        size="sm"
        onPress={onPrimaryPress}>
        {label}
      </Button>
      <Dropdown.Root>
        <Button
          aria-label={t('label.more-action-plural')}
          className="tw:-ml-px tw:rounded-l-none"
          color="secondary"
          data-testid={`${testIdPrefix}-trigger`}
          iconLeading={<ChevronDown size={14} />}
          isDisabled={isDisabled || isLoading}
          size="sm"
        />
        <Dropdown.Popover
          className="task-action-dropdown tw:w-auto tw:min-w-40"
          placement="bottom end">
          <Dropdown.Menu
            aria-label={t('label.more-action-plural')}
            disabledKeys={isMenuDisabled ? items.map((item) => item.key) : []}
            selectionMode="none"
            onAction={(key: Key) => onAction(String(key))}>
            {items.map((item) => (
              <Dropdown.Item
                className={
                  item.key === selectedKey ? 'tw:[&>div]:bg-active' : undefined
                }
                data-testid={item['data-testid']}
                icon={item.icon}
                id={item.key}
                key={item.key}
                textValue={item.textValue}>
                {item.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
};

export default TaskActionSplitButton;
