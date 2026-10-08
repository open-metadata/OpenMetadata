/*
 *  Copyright 2022 Collate.
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

import {
  Autocomplete,
  Select,
  SelectItemType,
} from '@openmetadata/ui-core-components';
import { User01, Users01 } from '@openmetadata/ui-core-components/icons';
import { SelectProps } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';

import { debounce } from 'lodash';
import { FC, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OwnerType } from '../../../enums/user.enum';
import { Option } from '../TasksPage.interface';
import './Assignee.less';

interface Props
  extends Omit<
    SelectProps<Option[], DefaultOptionType>,
    'onChange' | 'onSearch' | 'value' | 'options'
  > {
  options: Option[];
  value: Option[];
  onSearch: (value: string) => void;
  onChange: (values: Option[]) => void;
  disabled?: boolean;
  isSingleSelect?: boolean;
}

const Assignees: FC<Props> = ({
  value: assignees = [],
  onSearch,
  onChange,
  options,
  disabled,
  isSingleSelect = false,
  className,
  placeholder,
  status,
}) => {
  const { t } = useTranslation();
  const search = useMemo(() => debounce(onSearch, 300), [onSearch]);
  useEffect(() => () => search.cancel(), [search]);

  const toItem = (option: Option): SelectItemType => ({
    id: option.value,
    label: option['data-label'] ?? option.label,
    icon: option.type === OwnerType.TEAM ? Users01 : User01,
    supportingText: t(
      option.type === OwnerType.TEAM ? 'label.team' : 'label.user'
    ),
  });

  // Selected options retain their metadata when async search replaces the list.
  const selectedItems = assignees.map(toItem);
  const items = options.map(toItem);
  const searchPlaceholder =
    typeof placeholder === 'string' ? placeholder : t('label.select-to-search');

  if (isSingleSelect) {
    const singleItems = [
      ...selectedItems,
      ...items.filter(
        (item) => !selectedItems.some((selected) => selected.id === item.id)
      ),
    ];

    return (
      <div className={className} data-testid="select-assignee">
        <Select.ComboBox
          aria-label={t('label.assignee')}
          isDisabled={disabled}
          isInvalid={status === 'error'}
          items={singleItems}
          placeholder={searchPlaceholder}
          selectedKey={assignees[0]?.value ?? null}
          shortcut={false}
          showSearchIcon={false}
          onInputChange={search}
          onSelectionChange={(key) => {
            const option = [...assignees, ...options].find(
              (item) => item.value === String(key)
            );
            onChange(
              option
                ? [{ ...option, label: option['data-label'] ?? option.label }]
                : []
            );
          }}>
          {(item) => <Select.Item {...item} key={item.id} />}
        </Select.ComboBox>
      </div>
    );
  }

  return (
    <div className={className} data-testid="select-assignee">
      <Autocomplete
        aria-label={t('label.assignee-plural')}
        filterOption={() => true}
        isDisabled={disabled}
        isInvalid={status === 'error'}
        items={items}
        placeholder={searchPlaceholder}
        selectedItems={selectedItems}
        onItemCleared={(key) =>
          onChange(assignees.filter((option) => option.value !== String(key)))
        }
        onItemInserted={(key) => {
          const option = options.find((item) => item.value === String(key));
          if (option) {
            const selected = {
              ...option,
              label: option['data-label'] ?? option.label,
            };
            onChange([...assignees, selected]);
          }
        }}
        onSearchChange={search}>
        {(item) => (
          <Autocomplete.Item
            data-testid={
              options.find((option) => option.value === item.id)?.name
            }
            icon={item.icon}
            id={item.id}
            key={item.id}
            label={item.label}
            supportingText={item.supportingText}
          />
        )}
      </Autocomplete>
    </div>
  );
};

export default Assignees;
