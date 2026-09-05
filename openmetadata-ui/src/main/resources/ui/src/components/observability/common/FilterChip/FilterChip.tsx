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
import {
  borderAfter,
  Box,
  Button,
  Dropdown,
  Input,
} from '@openmetadata/ui-core-components';
import {
  Check,
  ChevronDown,
  Columns01,
  LayoutAlt04,
  SearchLg,
  Table,
} from '@untitledui/icons';
import classNames from 'classnames';
import { isString } from 'lodash';
import { useMemo, useState } from 'react';
import { Button as AriaButton, type Selection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { TestCaseType } from '../../../../enums/TestSuite.enum';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import {
  FilterDescriptor,
  FilterValue,
} from '../../../DataQuality/TestCases/FilterChip.interface';
import DqDateRangeFilter from '../../DataQuality/Dashboard/DqDateRangeFilter';

const TEXT_SECONDARY_CLASS = 'tw:text-secondary';

// Leading icons for single-select filter options, per the 2.0 mock. Keyed by
// option value so it naturally extends to other filters (e.g. status).
const FILTER_OPTION_ICONS: Partial<Record<string, typeof Table>> = {
  [TestCaseType.all]: LayoutAlt04,
  [TestCaseType.table]: Table,
  [TestCaseType.column]: Columns01,
};

/** `chip` = pill button (dashboard/Test Cases); `input` = labeled input box. */
export type FilterChipVariant = 'chip' | 'input';

const FilterChipTrigger = ({
  text,
  testId,
}: {
  text: string;
  testId: string;
}) => (
  <Button
    className="tw:whitespace-nowrap"
    color="secondary"
    data-testid={testId}
    iconTrailing={ChevronDown}
    size="md">
    {text}
  </Button>
);

// Labeled input-style trigger (2.0 incident mock 9027-4660): a bordered box that
// shows the selected value or, when empty, the filter label as placeholder text.
const InputChipTrigger = ({
  text,
  hasSelection,
  testId,
}: {
  text: string;
  hasSelection: boolean;
  testId: string;
}) => (
  <AriaButton
    className="tw:flex tw:w-44 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:px-3 tw:py-2 tw:shadow-xs tw:outline-brand"
    data-testid={testId}>
    <span
      className={classNames(
        'tw:flex-1 tw:truncate tw:text-left tw:text-sm tw:font-medium',
        hasSelection ? TEXT_SECONDARY_CLASS : 'tw:text-placeholder'
      )}>
      {text}
    </span>
    <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
  </AriaButton>
);

const toValueArray = (value: FilterValue): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => item);
  }

  return typeof value === 'string' ? [value] : [];
};

const SelectChip = ({
  descriptor,
  variant,
  isOpen: controlledIsOpen,
  onOpenChange,
}: {
  descriptor: FilterDescriptor;
  variant: FilterChipVariant;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalOpen;
  const [query, setQuery] = useState('');
  const { label, key, controlType, searchable, value, options, onChange } =
    descriptor;
  const isMulti = controlType === 'multiselect';
  const committed = useMemo(() => toValueArray(value), [value]);
  const hasSelection = committed.length > 0;
  const [staged, setStaged] = useState<string[]>(committed);

  // A persisted selection (e.g. a table FQN restored from the URL) may be absent
  // from the fetched option page until it is searched. Surface it as its own
  // option so the chip shows it selected instead of blank.
  const mergedOptions = useMemo(() => {
    const known = new Set(options.map((option) => option.value));
    const missing = committed
      .filter((selectedValue) => !known.has(selectedValue))
      .map((selectedValue) => ({
        value: selectedValue,
        label: getNameFromFQN(selectedValue) || selectedValue,
      }));

    return missing.length > 0 ? [...missing, ...options] : options;
  }, [options, committed]);

  const triggerText = useMemo(() => {
    if (isMulti) {
      return committed.length > 0 ? `${label} · ${committed.length}` : label;
    }
    const selected = mergedOptions.find(
      (option) => option.value === committed[0]
    );

    return selected?.label ?? label;
  }, [isMulti, committed, label, mergedOptions]);

  // Multi-select stages selections (committed on Apply); single-select reflects
  // the committed value and applies on click.
  const selectedKeySet = useMemo<Selection>(
    () => new Set(isMulti ? staged : committed),
    [isMulti, staged, committed]
  );

  const handleOpenChange = (open: boolean) => {
    setInternalOpen(open);
    onOpenChange?.(open);
    setQuery('');
    if (open) {
      setStaged(committed);
      descriptor.onGetInitialOptions();
    }
  };

  const handleSearch = (search: string) => {
    setQuery(search);
    descriptor.onSearch?.(search);
  };

  const handleSelectionChange = (keys: Selection) => {
    if (keys === 'all') {
      return;
    }
    const next = Array.from(keys).map((selectionKey) => String(selectionKey));
    if (isMulti) {
      setStaged(next);
    } else {
      onChange(next[0]);
      handleOpenChange(false);
    }
  };

  const handleClear = () => setStaged([]);

  const handleApply = () => {
    onChange(staged);
    handleOpenChange(false);
  };

  const trigger =
    variant === 'input' ? (
      <InputChipTrigger
        hasSelection={hasSelection}
        testId={`search-dropdown-${key}`}
        text={triggerText}
      />
    ) : (
      <FilterChipTrigger testId={`search-dropdown-${key}`} text={triggerText} />
    );

  const dropdown = (
    <Dropdown.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      {trigger}
      <Dropdown.Popover className="tw:w-64">
        {searchable && (
          <div className="tw:p-2">
            <Input
              icon={SearchLg}
              placeholder={t('label.search')}
              size="sm"
              value={query}
              onChange={handleSearch}
            />
          </div>
        )}
        <Dropdown.Menu
          aria-label={label}
          className="tw:max-h-64 tw:overflow-y-auto"
          disallowEmptySelection={false}
          selectedKeys={selectedKeySet}
          selectionMode={isMulti ? 'multiple' : 'single'}
          onSelectionChange={handleSelectionChange}>
          {mergedOptions.map((option) =>
            isMulti ? (
              <Dropdown.Item
                showCheckbox
                id={option.value}
                key={option.value}
                label={option.label}
                textValue={option.label}
              />
            ) : (
              <Dropdown.Item
                className={(state) =>
                  state.isSelected ? 'tw:[&>div]:bg-utility-brand-50!' : ''
                }
                id={option.value}
                key={option.value}
                textValue={option.label}>
                {(state) => {
                  const OptionIcon = FILTER_OPTION_ICONS[option.value];

                  return (
                    <Box
                      align="center"
                      className="tw:w-full"
                      gap={2}
                      justify="between">
                      <Box
                        align="center"
                        className="tw:min-w-0 tw:grow"
                        gap={2}>
                        {OptionIcon && (
                          <OptionIcon
                            aria-hidden="true"
                            className={classNames(
                              'tw:size-4 tw:shrink-0',
                              state.isSelected
                                ? 'tw:text-utility-brand-700'
                                : 'tw:text-fg-tertiary'
                            )}
                            height={16}
                            width={16}
                          />
                        )}
                        <span
                          className={classNames(
                            'tw:truncate tw:text-sm',
                            state.isSelected
                              ? 'tw:text-utility-brand-700'
                              : TEXT_SECONDARY_CLASS
                          )}>
                          {option.label}
                        </span>
                      </Box>
                      {state.isSelected && (
                        <Check
                          aria-hidden="true"
                          className="tw:size-4 tw:shrink-0 tw:text-utility-brand-700"
                          height={16}
                          width={16}
                        />
                      )}
                    </Box>
                  );
                }}
              </Dropdown.Item>
            )
          )}
        </Dropdown.Menu>
        {isMulti && (
          <Box
            align="center"
            className="tw:border-t tw:border-secondary tw:p-2"
            gap={2}
            justify="between">
            <Button
              color="tertiary"
              data-testid="clear-filter-btn"
              isDisabled={staged.length === 0}
              size="sm"
              onPress={handleClear}>
              {t('label.clear')}
            </Button>
            <Box align="center" gap={2}>
              <Button
                color="secondary"
                data-testid="cancel-filter-btn"
                size="sm"
                onPress={() => handleOpenChange(false)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="apply-filter-btn"
                size="sm"
                onPress={handleApply}>
                {t('label.apply')}
              </Button>
            </Box>
          </Box>
        )}
      </Dropdown.Popover>
    </Dropdown.Root>
  );

  if (variant === 'input') {
    return (
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <span className="tw:text-sm tw:font-medium tw:text-secondary">
          {label}
        </span>
        {dropdown}
      </div>
    );
  }

  return dropdown;
};

const DateChip = ({
  descriptor,
  variant,
  isOpen,
  onOpenChange,
}: {
  descriptor: FilterDescriptor;
  variant: FilterChipVariant;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const range = (descriptor.value ?? {}) as {
    startTs?: number;
    endTs?: number;
  };

  const picker = (
    <DqDateRangeFilter
      endTs={range.endTs != null ? Number(range.endTs) : undefined}
      isOpen={isOpen}
      size={variant === 'input' ? 'sm' : 'md'}
      startTs={range.startTs != null ? Number(range.startTs) : undefined}
      onApply={(value) => descriptor.onChange(value)}
      onOpenChange={onOpenChange}
    />
  );

  if (variant === 'input') {
    return (
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <span className="tw:text-sm tw:font-medium tw:text-secondary">
          {descriptor.label}
        </span>
        {picker}
      </div>
    );
  }

  return picker;
};

// User/team picker (controlType 'user') — reuses the OSS UserTeamSelectableList
// (search, avatars, users/teams) behind the shared chip/input trigger.
const UserChip = ({
  descriptor,
  variant,
  isOpen: controlledIsOpen,
  onOpenChange,
}: {
  descriptor: FilterDescriptor;
  variant: FilterChipVariant;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalOpen;
  const setOpen = (open: boolean) => {
    setInternalOpen(open);
    onOpenChange?.(open);
  };
  const { label, key, value, selectedOwners, onOwnerChange } = descriptor;
  const selected = selectedOwners?.[0];
  let displayText = '';
  if (selected) {
    displayText = selected.displayName ?? selected.name ?? '';
  } else if (isString(value)) {
    displayText = value;
  }
  const hasSelection = Boolean(displayText);

  const trigger =
    variant === 'input' ? (
      <button
        className="tw:flex tw:w-44 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:px-3 tw:py-2 tw:shadow-xs tw:outline-brand"
        data-testid={`search-dropdown-${key}`}
        type="button">
        <span
          className={classNames(
            'tw:flex-1 tw:truncate tw:text-left tw:text-sm tw:font-medium',
            hasSelection ? TEXT_SECONDARY_CLASS : 'tw:text-placeholder'
          )}>
          {hasSelection ? displayText : label}
        </span>
        <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
      </button>
    ) : (
      <button
        className={classNames(
          'tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:gap-1 tw:whitespace-nowrap',
          'tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-2.5 tw:text-sm tw:font-medium tw:text-secondary',
          'tw:relative tw:shadow-xs-skeuomorphic tw:outline-brand',
          borderAfter,
          'tw:after:outline-primary'
        )}
        data-testid={`search-dropdown-${key}`}
        type="button">
        {hasSelection ? `${label} · 1` : label}
        <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
      </button>
    );

  const picker = (
    <UserTeamSelectableList
      hasPermission
      owner={selectedOwners}
      popoverProps={{
        open: isOpen,
        placement: 'bottomLeft',
        onOpenChange: setOpen,
      }}
      onUpdate={(owners) => {
        onOwnerChange?.(owners);
        setOpen(false);
      }}>
      {trigger}
    </UserTeamSelectableList>
  );

  if (variant === 'input') {
    return (
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <span className="tw:text-sm tw:font-medium tw:text-secondary">
          {label}
        </span>
        {picker}
      </div>
    );
  }

  return picker;
};

export const FilterChip = ({
  descriptor,
  variant = 'chip',
  isOpen,
  onOpenChange,
}: {
  descriptor: FilterDescriptor;
  variant?: FilterChipVariant;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  if (descriptor.controlType === 'date') {
    return (
      <DateChip
        descriptor={descriptor}
        isOpen={isOpen}
        variant={variant}
        onOpenChange={onOpenChange}
      />
    );
  }

  if (descriptor.controlType === 'user') {
    return (
      <UserChip
        descriptor={descriptor}
        isOpen={isOpen}
        variant={variant}
        onOpenChange={onOpenChange}
      />
    );
  }

  return (
    <SelectChip
      descriptor={descriptor}
      isOpen={isOpen}
      variant={variant}
      onOpenChange={onOpenChange}
    />
  );
};

export default FilterChip;
