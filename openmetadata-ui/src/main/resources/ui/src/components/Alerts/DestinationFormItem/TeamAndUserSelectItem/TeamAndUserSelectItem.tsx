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
  Badge,
  BadgeWithButton,
  Checkbox,
  Input,
  Popover,
} from '@openmetadata/ui-core-components';
import { debounce, isEmpty } from 'lodash';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { handleKeyboardActivation } from '../../../../utils/KeyboardUtil';
import { SelectOption } from '../../../common/AsyncSelectList/AsyncSelectList.interface';
import { TeamAndUserSelectItemProps } from './TeamAndUserSelectItem.interface';

function TeamAndUserSelectItem({
  entityType,
  onSearch,
  fieldName,
  destinationNumber,
  isDisabled = false,
}: Readonly<TeamAndUserSelectItemProps>) {
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
      setValue(fieldPath, updated, { shouldValidate: true });
    },
    [selectedOptions, fieldPath, setValue]
  );

  const handleTagClose = useCallback(
    (value: string) => {
      setValue(
        fieldPath,
        selectedOptions.filter((o) => o !== value),
        { shouldValidate: true }
      );
    },
    [selectedOptions, fieldPath, setValue]
  );

  const handleTriggerClick = useCallback(() => {
    if (isDisabled) {
      return;
    }
    setIsDropdownOpen((prev) => !prev);
  }, [isDisabled]);

  useEffect(() => {
    if (isDisabled) {
      debouncedSearch.cancel();

      return;
    }
    debouncedSearch(searchText);

    return () => debouncedSearch.cancel();
  }, [searchText, entityType, debouncedSearch, isDisabled]);

  useEffect(() => {
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      // This picker uses a custom controlled trigger instead of DialogTrigger,
      // so close in the capture phase before a parent can stop propagation.
      if (
        !dropdownRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setIsDropdownOpen(false);
        setSearchText('');
      }
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);

    return () =>
      document.removeEventListener(
        'pointerdown',
        handleOutsidePointerDown,
        true
      );
  }, []);

  let optionsContent: ReactNode;
  if (isLoadingOptions) {
    optionsContent = (
      <div className="tw:space-y-1 tw:p-2">
        {[1, 2, 3].map((i) => (
          <div
            className="tw:h-6 tw:animate-pulse tw:rounded tw:bg-secondary"
            key={i}
          />
        ))}
      </div>
    );
  } else if (isEmpty(options)) {
    optionsContent = (
      <p className="tw:p-2 tw:text-center tw:text-sm tw:text-tertiary">
        {t('label.no-data-found')}
      </p>
    );
  } else {
    optionsContent = options.map(({ label, value }) => (
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
    ));
  }

  return (
    <div className="tw:relative tw:w-full">
      <div
        aria-disabled={isDisabled}
        className={[
          'tw:flex tw:min-h-9 tw:w-full tw:flex-wrap tw:items-center',
          'tw:gap-1.5 tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2',
          'tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary',
          isDisabled ? 'tw:cursor-not-allowed' : 'tw:cursor-pointer',
        ].join(' ')}
        data-testid={`team-user-select-trigger-${destinationNumber}`}
        ref={triggerRef}
        role="button"
        tabIndex={isDisabled ? -1 : 0}
        onClick={handleTriggerClick}
        onKeyDown={handleKeyboardActivation(handleTriggerClick)}>
        {isEmpty(selectedOptions) ? (
          <span
            className="tw:text-sm tw:text-placeholder"
            data-testid="placeholder-text">
            {t('label.please-select-entity', { entity: entityType })}
          </span>
        ) : (
          selectedOptions.map((option) =>
            isDisabled ? (
              <Badge
                color="gray"
                data-testid={`selected-tag-${option}`}
                key={option}
                type="pill-color">
                {option}
              </Badge>
            ) : (
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
            )
          )
        )}
      </div>

      <Popover
        isNonModal
        className="tw:w-(--trigger-width)"
        containerClassName="tw:p-2"
        data-react-aria-top-layer="true"
        isOpen={isDropdownOpen}
        placement="bottom left"
        triggerRef={triggerRef}
        onOpenChange={(isOpen) => {
          setIsDropdownOpen(isOpen);
          if (!isOpen) {
            setSearchText('');
          }
        }}>
        <div
          data-testid={`team-user-select-dropdown-${destinationNumber}`}
          ref={dropdownRef}>
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- search box must focus when dropdown opens
            autoFocus
            data-testid="search-input"
            inputDataTestId="search-input-field"
            placeholder={t('label.search-by-type', { type: entityType })}
            value={searchText}
            onChange={(val) => setSearchText(val)}
          />
          <div className="tw:mt-2 tw:max-h-48 tw:overflow-y-auto">
            {optionsContent}
          </div>
        </div>
      </Popover>
    </div>
  );
}

export default TeamAndUserSelectItem;
