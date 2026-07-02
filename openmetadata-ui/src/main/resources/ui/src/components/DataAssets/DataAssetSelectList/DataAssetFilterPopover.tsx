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
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataAssetFilterPopoverProps,
  DataAssetPickerOption,
} from './DataAssetPicker.interface';
import DataAssetPickerShell from './DataAssetPickerShell';

const DataAssetFilterPopover: FC<DataAssetFilterPopoverProps> = ({
  options,
  selectedId,
  onChange,
  allowAllOption = true,
  allOptionLabel,
  popoverClassName,
  popoverAlign = 'left',
  placeholder,
  renderTrigger,
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');

  const filteredOptions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return options;
    }

    return options.filter(
      (option) =>
        option.displayName?.toLowerCase().includes(query) ||
        option.name?.toLowerCase().includes(query) ||
        option.id?.toLowerCase().includes(query)
    );
  }, [options, searchText]);

  const handleToggle = useCallback(
    (option: DataAssetPickerOption) => {
      onChange(option.id === selectedId ? '' : option.id);
    },
    [onChange, selectedId]
  );

  const handleSelectAll = useCallback(() => {
    onChange('');
  }, [onChange]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setSearchText('');
    }
  }, []);

  return (
    <DataAssetPickerShell
      allOptionLabel={allOptionLabel}
      allowAllOption={allowAllOption}
      options={filteredOptions}
      placeholder={placeholder ?? t('label.search-assets-by-name-or-path')}
      popoverAlign={popoverAlign}
      popoverClassName={popoverClassName}
      renderTrigger={renderTrigger}
      searchText={searchText}
      selectedIds={selectedId ? new Set([selectedId]) : new Set()}
      selectionMode="single"
      totalCount={options.length}
      onOpenChange={handleOpenChange}
      onSearchChange={setSearchText}
      onSelectAll={handleSelectAll}
      onToggle={handleToggle}
    />
  );
};

export default DataAssetFilterPopover;
