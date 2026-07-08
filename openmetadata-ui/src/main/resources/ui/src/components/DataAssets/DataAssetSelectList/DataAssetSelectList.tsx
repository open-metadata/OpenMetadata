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
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { SearchIndex } from '../../../enums/search.enum';
import { DataAssetOption } from '../DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import {
  DataAssetPickerOption,
  DataAssetSelectListProps,
} from './DataAssetPicker.interface';
import DataAssetPickerShell from './DataAssetPickerShell';
import { useAsyncDataAssetOptions } from './useAsyncDataAssetOptions';

const DataAssetSelectList: FC<DataAssetSelectListProps> = ({
  onChange,
  debounceTimeout = 800,
  initialOptions,
  allowAllOption = false,
  searchIndex = SearchIndex.DATA_ASSET,
  value: selectedValue,
  filterFqns = [],
  queryFilter,
  placeholder,
  renderTrigger,
  popoverClassName,
  popoverAlign,
  selectionMode = 'multiple',
  popoverPlacement = 'top',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<DataAssetOption[]>(
    initialOptions ?? []
  );

  const {
    options,
    isLoading,
    searchText,
    totalCount,
    loadOptions,
    handleSearchChange,
    handleScroll,
  } = useAsyncDataAssetOptions({
    isOpen,
    searchIndex,
    queryFilter,
    debounceTimeout,
  });

  const handleSelectAll = useCallback(() => {
    onChange?.(undefined);
    setSelected([]);
  }, [onChange]);

  useEffect(() => {
    if (Array.isArray(selectedValue)) {
      setSelected(selectedValue);
    } else if (selectedValue) {
      setSelected([selectedValue]);
    }
  }, [selectedValue]);

  const selectedFqns = useMemo(
    () => new Set(selected.map((o) => String(o.value ?? ''))),
    [selected]
  );

  const visibleOptions = useMemo(
    () =>
      options.filter(
        (op) => !filterFqns.includes(op.reference.fullyQualifiedName ?? '')
      ),
    [options, filterFqns]
  );

  const pickerOptions: DataAssetPickerOption[] = useMemo(
    () =>
      visibleOptions.map((op) => ({
        id: String(op.value ?? ''),
        label: op.label as string,
        displayName: op.displayName,
        name: op.name,
        type: op.reference.type,
      })),
    [visibleOptions]
  );

  const handleToggle = useCallback(
    (pickerOption: DataAssetPickerOption) => {
      const match = visibleOptions.find(
        (op) => String(op.value ?? '') === pickerOption.id
      );
      if (!match) {
        return;
      }

      const isSelected = selectedFqns.has(pickerOption.id);
      if (selectionMode === 'single') {
        setSelected(isSelected ? [] : [match]);
        onChange?.(isSelected ? undefined : match);

        return;
      }
      const next = isSelected
        ? selected.filter((o) => String(o.value ?? '') !== pickerOption.id)
        : [...selected, match];
      setSelected(next);
      onChange?.(next);
    },
    [visibleOptions, selectedFqns, selected, onChange]
  );

  useEffect(() => {
    if (isOpen) {
      loadOptions('');
    }
  }, [isOpen, loadOptions]);

  return (
    <DataAssetPickerShell
      showFooterHints
      allowAllOption={allowAllOption}
      isLoading={isLoading}
      options={pickerOptions}
      placeholder={placeholder}
      popoverAlign={popoverAlign}
      popoverClassName={popoverClassName}
      popoverPlacement={popoverPlacement}
      renderTrigger={renderTrigger}
      searchText={searchText}
      selectedIds={selectedFqns}
      selectionMode={selectionMode}
      totalCount={totalCount}
      onOpenChange={setIsOpen}
      onScroll={handleScroll}
      onSearchChange={handleSearchChange}
      onSelectAll={handleSelectAll}
      onToggle={handleToggle}
    />
  );
};

export default DataAssetSelectList;
