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
  AutocompleteProps,
  Avatar,
} from '@openmetadata/ui-core-components';
import { Users01 } from '@openmetadata/ui-core-components/icons';
import { debounce, uniqBy } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Option } from '../TasksPage.interface';

interface Props
  extends Omit<
    AutocompleteProps,
    | 'children'
    | 'items'
    | 'selectedItems'
    | 'onSearchChange'
    | 'onChange'
    | 'value'
  > {
  options: Option[];
  value: Option[];
  onSearch: (value: string) => void;
  onChange: (values: Option[]) => void;
  disabled?: boolean;
  isSingleSelect?: boolean;
}

const Assignees = ({
  value: assignees = [],
  onSearch,
  onChange,
  options,
  disabled,
  isSingleSelect = false,
  ...rest
}: Props) => {
  const { t } = useTranslation();
  const search = useMemo(() => debounce(onSearch, 300), [onSearch]);
  useEffect(() => () => search.cancel(), [search]);

  const toItem = (option: Option) => ({
    id: option.value,
    label: option.label,
    supportingText: option.type === 'team' ? t('label.team') : t('label.user'),
    icon:
      option.type === 'team' ? (
        <Avatar placeholderIcon={Users01} size="xs" />
      ) : (
        <Avatar initials={option.label?.charAt(0).toUpperCase()} size="xs" />
      ),
  });
  // Selected identities must survive when a remote search replaces the option page.
  const availableOptions = uniqBy([...options, ...assignees], 'value');

  // Form rules validate selected identities; the search query clears after selection.
  return (
    <Autocomplete
      {...rest}
      data-testid="select-assignee"
      filterOption={() => true}
      isDisabled={disabled}
      items={availableOptions.map(toItem)}
      multiple={!isSingleSelect}
      placeholder={rest.placeholder ?? t('label.select-to-search')}
      selectedItems={assignees.map(toItem)}
      validationBehavior="aria"
      onItemCleared={(key) =>
        onChange(assignees.filter((option) => option.value !== key))
      }
      onItemInserted={(key) => {
        const option = availableOptions.find((item) => item.value === key);
        if (option) {
          onChange(
            isSingleSelect ? [option] : uniqBy([...assignees, option], 'value')
          );
        }
      }}
      onSearchChange={search}>
      {(item) => (
        <Autocomplete.Item
          {...item}
          data-testid={
            availableOptions.find((option) => option.value === item.id)?.name
          }
        />
      )}
    </Autocomplete>
  );
};

export default Assignees;
