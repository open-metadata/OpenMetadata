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
import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import {
  DataAssetAsyncSelectListProps,
  DataAssetOption,
} from '../DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import {
  DataAssetPickerOption,
  DataAssetPickerTriggerState,
} from './DataAssetPicker.interface';
import DataAssetPickerShell from './DataAssetPickerShell';
import { useAsyncDataAssetOptions } from './useAsyncDataAssetOptions';

interface DataAssetMultiSelectPopoverProps
  extends DataAssetAsyncSelectListProps {
  renderTrigger?: (state: DataAssetPickerTriggerState) => ReactNode;
  popoverClassName?: string;
  popoverAlign?: 'left' | 'right';
  popoverPlacement?: 'top' | 'bottom';
}

const DataAssetMultiSelectPopover: FC<DataAssetMultiSelectPopoverProps> = ({
  onChange,
  debounceTimeout = 800,
  initialOptions,
  searchIndex = SearchIndex.ALL,
  value: selectedValue,
  filterFqns = [],
  queryFilter,
  placeholder,
  renderTrigger,
  popoverClassName,
  popoverAlign,
  popoverPlacement = 'top',
}) => {
  const { t } = useTranslation();
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

  useEffect(() => {
    if (Array.isArray(selectedValue)) {
      setSelected(selectedValue as DataAssetOption[]);
    } else if (selectedValue && typeof selectedValue === 'object') {
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

  const defaultTrigger = useCallback(
    ({ open }: DataAssetPickerTriggerState) => (
      <Button
        className="tw:px-2.5 tw:py-1.5"
        color="tertiary"
        iconLeading={Plus}
        size="sm"
        onPress={open}>
        {t('label.link-an-entity', { entity: t('label.asset') })}
      </Button>
    ),
    [t]
  );

  return (
    <DataAssetPickerShell
      showFooterHints
      allowAllOption={false}
      isLoading={isLoading}
      options={pickerOptions}
      placeholder={placeholder ?? t('label.search-assets-to-link')}
      popoverAlign={popoverAlign}
      popoverClassName={popoverClassName}
      popoverPlacement={popoverPlacement}
      renderTrigger={renderTrigger ?? defaultTrigger}
      searchText={searchText}
      selectedIds={selectedFqns}
      selectionMode="multiple"
      totalCount={totalCount}
      onOpenChange={setIsOpen}
      onScroll={handleScroll}
      onSearchChange={handleSearchChange}
      onToggle={handleToggle}
    />
  );
};

export default DataAssetMultiSelectPopover;
