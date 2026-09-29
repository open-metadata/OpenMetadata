/*
 *  Copyright 2023 Collate.
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
import { Autocomplete, SelectItemType } from '@openmetadata/ui-core-components';
import { castArray, isString } from 'lodash';
import { FC, Key, useCallback, useEffect, useMemo, useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityIconSize } from '../../../utils/EntityIconUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { useAsyncDataAssetOptions } from '../DataAssetSelectList/useAsyncDataAssetOptions';
import {
  DataAssetAsyncSelectListProps,
  DataAssetOption,
} from './DataAssetAsyncSelectList.interface';

const getOptionFqn = (option: DataAssetOption) =>
  option.value ?? option.reference.fullyQualifiedName ?? '';

// A bare FQN whose option was never loaded still needs a chip to show.
const toPlaceholderOption = (fqn: string): DataAssetOption => ({
  label: fqn,
  value: fqn,
  displayName: fqn,
  reference: { id: fqn, type: '', fullyQualifiedName: fqn },
});

const toSelectItem = (option: DataAssetOption): SelectItemType => ({
  id: getOptionFqn(option),
  label: option.displayName,
  supportingText: option.reference.type,
});

const DataAssetAsyncSelectList: FC<DataAssetAsyncSelectListProps> = ({
  multiple = false,
  autoFocus = true,
  id,
  placeholder,
  onChange,
  debounceTimeout = 800,
  initialOptions,
  searchIndex = SearchIndex.ALL,
  value,
  filterFqns = [],
  queryFilter,
  popoverClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<DataAssetOption[]>([]);

  const { options, loadOptions, handleSearchChange, handleScroll } =
    useAsyncDataAssetOptions({
      isOpen,
      searchIndex,
      queryFilter,
      debounceTimeout,
    });

  useEffect(() => {
    if (isOpen) {
      loadOptions('');
    }
  }, [isOpen, loadOptions]);

  useEffect(() => {
    const values = value ? castArray<DataAssetOption | string>(value) : [];
    setSelected((prev) => {
      const known = new Map(
        [...(initialOptions ?? []), ...prev].map((o) => [getOptionFqn(o), o])
      );

      return values.map((v) =>
        isString(v) ? known.get(v) ?? toPlaceholderOption(v) : v
      );
    });
  }, [value, initialOptions]);

  const optionMap = useMemo(
    () =>
      new Map(
        options
          .filter(
            (o) => !filterFqns.includes(o.reference.fullyQualifiedName ?? '')
          )
          .map((o) => [getOptionFqn(o), o])
      ),
    [options, filterFqns]
  );

  const items = useMemo(
    () => [...optionMap.values()].map(toSelectItem),
    [optionMap]
  );
  const selectedItems = useMemo(() => selected.map(toSelectItem), [selected]);

  const handleItemInserted = useCallback(
    (key: Key) => {
      const option = optionMap.get(String(key));
      if (!option) {
        return;
      }
      const next = multiple ? [...selected, option] : [option];
      setSelected(next);
      onChange?.(multiple ? next : option);
    },
    [optionMap, selected, multiple, onChange]
  );

  const handleItemCleared = useCallback(
    (key: Key) => {
      const next = selected.filter((o) => getOptionFqn(o) !== key);
      setSelected(next);
      onChange?.(multiple ? next : undefined);
    },
    [selected, multiple, onChange]
  );

  const renderItem = (item: SelectItemType) => {
    const option = optionMap.get(item.id);
    const type = option?.reference.type;
    const isUserOrTeam =
      searchIndex === SearchIndex.USER ||
      searchIndex === SearchIndex.TEAM ||
      type === EntityType.USER ||
      type === EntityType.TEAM;

    if (isUserOrTeam) {
      return (
        <Autocomplete.Item id={item.id} key={item.id} label={item.label}>
          <div className="tw:flex tw:items-center tw:gap-2">
            <ProfilePicture
              isTeam={type === EntityType.TEAM}
              name={option?.name ?? ''}
              width="24"
            />
            <span data-testid={item.label}>{item.label}</span>
          </div>
        </Autocomplete.Item>
      );
    }

    return (
      <Autocomplete.Item
        data-testid={`option-${item.id}`}
        icon={searchClassBase.getEntityIconWithBg(
          type ?? '',
          EntityIconSize.Size14
        )}
        id={item.id}
        key={item.id}
        label={item.label}
        supportingText={type}
      />
    );
  };

  return (
    <Autocomplete
      // eslint-disable-next-line jsx-a11y/no-autofocus -- focus the async select when the list mounts
      autoFocus={autoFocus}
      data-testid="asset-select-list"
      filterOption={() => true}
      id={id}
      items={items}
      multiple={multiple}
      placeholder={placeholder}
      popoverClassName={popoverClassName}
      selectedItems={selectedItems}
      onItemCleared={handleItemCleared}
      onItemInserted={handleItemInserted}
      onOpenChange={setIsOpen}
      onPopoverScroll={handleScroll}
      onSearchChange={handleSearchChange}>
      {renderItem}
    </Autocomplete>
  );
};

export default DataAssetAsyncSelectList;
