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
import { Typography } from '@openmetadata/ui-core-components';
import { ChevronDown, Database01 } from '@untitledui/icons';
import classNames from 'classnames';
import { FC, useCallback, useMemo, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  DataAssetFilterPopoverProps,
  DataAssetPickerOption,
  DataAssetPickerTriggerState,
} from './DataAssetPicker.interface';
import DataAssetPickerShell from './DataAssetPickerShell';

const FILTER_BUTTON_BASE_CLS =
  'tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:px-3' +
  ' tw:py-2 tw:text-sm tw:font-medium tw:shadow-xs tw:ring-1 tw:ring-inset' +
  ' tw:cursor-pointer tw:transition tw:duration-100' +
  ' tw:ease-linear hover:tw:ring-brand tw:outline-hidden tw:whitespace-nowrap';

const FILTER_BUTTON_CLS = `${FILTER_BUTTON_BASE_CLS} tw:bg-primary tw:ring-primary`;
const FILTER_BUTTON_ACTIVE_CLS = `${FILTER_BUTTON_BASE_CLS} tw:bg-utility-brand-50 tw:ring-utility-brand-200`;

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

  const selectedOption = options.find((option) => option.id === selectedId);
  const isActive = Boolean(selectedId);

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

  const defaultTrigger = useCallback(
    ({ open }: DataAssetPickerTriggerState) => (
      <AriaButton
        className={classNames(
          isActive ? FILTER_BUTTON_ACTIVE_CLS : FILTER_BUTTON_CLS
        )}
        onPress={open}>
        <Database01
          className={classNames('tw:shrink-0', {
            'tw:text-brand-secondary': isActive,
            'tw:text-secondary': !isActive,
          })}
          size={14}
        />
        <div className="tw:max-w-50">
          <Typography
            ellipsis
            className={
              isActive ? 'tw:text-utility-brand-700' : 'tw:text-secondary'
            }
            weight="medium">
            {selectedOption?.label ??
              allOptionLabel ??
              t('label.all-entity', { entity: t('label.asset-plural') })}
          </Typography>
        </div>
        <ChevronDown
          className="tw:ml-1 tw:text-fg-quaternary tw:shrink-0"
          size={16}
          strokeWidth={2.5}
        />
      </AriaButton>
    ),
    [isActive, selectedOption, allOptionLabel, t]
  );

  return (
    <DataAssetPickerShell
      allowAllOption={allowAllOption}
      options={filteredOptions}
      placeholder={placeholder ?? t('label.search-assets-by-name-or-path')}
      popoverAlign={popoverAlign}
      popoverClassName={popoverClassName}
      renderTrigger={renderTrigger ?? defaultTrigger}
      searchText={searchText}
      selectedIds={selectedId ? new Set([selectedId]) : new Set()}
      selectionMode="single"
      onSearchChange={setSearchText}
      onSelectAll={handleSelectAll}
      onToggle={handleToggle}
    />
  );
};

export default DataAssetFilterPopover;
