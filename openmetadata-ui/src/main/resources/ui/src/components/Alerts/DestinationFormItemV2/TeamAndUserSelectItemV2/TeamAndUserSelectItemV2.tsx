/*
 *  Copyright 2024 Collate.
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
  BadgeWithButton,
  Checkbox,
  Input,
} from '@openmetadata/ui-core-components';
import { debounce, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { SelectOption } from '../../../common/AsyncSelectList/AsyncSelectList.interface';
import { TeamAndUserSelectItemV2Props } from './TeamAndUserSelectItemV2.interface';

function TeamAndUserSelectItemV2({
  entityType,
  onSearch,
  fieldName,
  destinationNumber,
}: Readonly<TeamAndUserSelectItemV2Props>) {
  const { t } = useTranslation();
  const { setValue, control } = useFormContext();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);

  const fieldPath = `destinations.${fieldName.join('.')}`;
  const selectedOptions: string[] =
    useWatch({ name: fieldPath, control }) ?? [];

  const handleSearch = useCallback(
    async (value: string) => {
      try {
        setIsLoadingOptions(true);
        const results = await onSearch(value);
        setOptions(results);
      } catch {
        setOptions([]);
      } finally {
        setIsLoadingOptions(false);
      }
    },
    [onSearch]
  );

  const debouncedSearch = useMemo(
    () => debounce(handleSearch, 500),
    [handleSearch]
  );

  const handleOptionClick = useCallback(
    (value: string) => {
      const isSelected = selectedOptions.includes(value);
      const updated = isSelected
        ? selectedOptions.filter((o) => o !== value)
        : [...selectedOptions, value];
      setValue(fieldPath, updated);
    },
    [selectedOptions, fieldPath, setValue]
  );

  const handleTagClose = useCallback(
    (value: string) => {
      setValue(
        fieldPath,
        selectedOptions.filter((o) => o !== value)
      );
    },
    [selectedOptions, fieldPath, setValue]
  );

  const handleTriggerClick = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    debouncedSearch(searchText);
  }, [searchText, entityType, debouncedSearch]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const clickedOutsideDropdown = !dropdownRef.current?.contains(
        e.target as Node
      );
      const clickedInsideTrigger = triggerRef.current?.contains(
        e.target as Node
      );
      if (clickedOutsideDropdown && !clickedInsideTrigger) {
        setIsDropdownOpen(false);
        setSearchText('');
      }
    };
    document.addEventListener('click', handleOutsideClick);

    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div className="tw:relative tw:w-full">
      <div
        className={[
          'tw:flex tw:min-h-9 tw:w-full tw:cursor-pointer tw:flex-wrap tw:items-center',
          'tw:gap-1.5 tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2',
          'tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset',
        ].join(' ')}
        data-testid={`team-user-select-trigger-${destinationNumber}`}
        ref={triggerRef}
        onClick={handleTriggerClick}>
        {isEmpty(selectedOptions) ? (
          <span
            className="tw:text-sm tw:text-placeholder"
            data-testid="placeholder-text">
            {t('label.please-select-entity', { entity: entityType })}
          </span>
        ) : (
          selectedOptions.map((option) => (
            <BadgeWithButton
              buttonLabel={t('label.remove')}
              color="gray"
              data-testid={`selected-tag-${option}`}
              key={option}
              type="pill-color"
              onButtonClick={(e) => {
                e.stopPropagation();
                handleTagClose(option);
              }}>
              {option}
            </BadgeWithButton>
          ))
        )}
      </div>

      {isDropdownOpen && (
        <div
          className="tw:absolute tw:z-50 tw:mt-1 tw:w-full tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-2 tw:shadow-lg"
          data-testid={`team-user-select-dropdown-${destinationNumber}`}
          ref={dropdownRef}>
          <Input
            autoFocus
            data-testid="search-input"
            inputDataTestId="search-input-field"
            placeholder={t('label.search-by-type', { type: entityType })}
            value={searchText}
            onChange={(val) => setSearchText(val)}
          />
          <div className="tw:mt-2 tw:max-h-48 tw:overflow-y-auto">
            {isLoadingOptions ? (
              <div className="tw:space-y-1 tw:p-2">
                {[1, 2, 3].map((i) => (
                  <div
                    className="tw:h-6 tw:animate-pulse tw:rounded tw:bg-secondary"
                    key={i}
                  />
                ))}
              </div>
            ) : isEmpty(options) ? (
              <p className="tw:p-2 tw:text-center tw:text-sm tw:text-tertiary">
                {t('label.no-data-found')}
              </p>
            ) : (
              options.map(({ label, value }) => (
                <button
                  className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:px-2 tw:py-1.5 tw:text-left hover:tw:bg-secondary"
                  data-testid={value}
                  key={value}
                  type="button"
                  onClick={() => handleOptionClick(value)}>
                  <Checkbox
                    data-testid={`${label}-option-checkbox`}
                    isSelected={selectedOptions.includes(value)}
                  />
                  <span
                    className="tw:truncate tw:text-sm tw:text-primary"
                    data-testid={`${label}-option-label`}>
                    {label}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamAndUserSelectItemV2;
