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
import { borderAfter, FilterSelect } from '@openmetadata/ui-core-components';
import { ChevronDown, Columns01, LayoutAlt04, Table } from '@untitledui/icons';
import classNames from 'classnames';
import { isString } from 'lodash';
import { useMemo, useState } from 'react';
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




const toValueArray = (value: FilterValue): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => item);
  }

  return typeof value === 'string' ? [value] : [];
};

// Select/multiselect chips render through the unified FilterSelect: staged
// commits for multi-select, immediate apply-and-close for single select.
const SelectChip = ({
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
  const { label, key, controlType, searchable, value, options, onChange } =
    descriptor;
  const isMulti = controlType === 'multiselect';
  const committed = useMemo(() => toValueArray(value), [value]);

  const handleChange = (values: string[]) => {
    onChange(isMulti ? values : values[0] ?? '');
  };

  const dropdown = (
    <FilterSelect
      hideCounts
      commitMode={isMulti ? 'staged' : 'immediate'}
      data-testid={`search-dropdown-${key}`}
      isOpen={isOpen}
      label={label}
      options={options.map((option) => ({
        value: option.value,
        label: option.label,
        textValue: option.label,
        icon: FILTER_OPTION_ICONS[option.value],
      }))}
      resolveMissingLabel={(missing) => getNameFromFQN(missing) || missing}
      searchable={searchable}
      selectedValues={committed}
      selectionMode={isMulti ? 'multiple' : 'single'}
      triggerVariant={variant === 'input' ? 'input' : 'button'}
      onChange={handleChange}
      onOpenChange={(open) => {
        if (open) {
          descriptor.onGetInitialOptions();
        }
        onOpenChange?.(open);
      }}
      onSearch={(search) => descriptor.onSearch?.(search)}
    />
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

const resolveUserChipDisplayText = (
  selectedOwners: FilterDescriptor['selectedOwners'],
  value: FilterValue
): string => {
  const selected = selectedOwners?.[0];
  const selectedText = selected?.displayName ?? selected?.name ?? '';
  const fallbackText = isString(value) ? value : '';

  return selected ? selectedText : fallbackText;
};

const UserChipInputTrigger = ({
  displayText,
  hasSelection,
  label,
  testId,
}: {
  displayText: string;
  hasSelection: boolean;
  label: string;
  testId: string;
}) => (
  <button
    className="tw:flex tw:w-44 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:px-3 tw:py-2 tw:shadow-xs tw:outline-brand"
    data-testid={testId}
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
);

const UserChipPillTrigger = ({
  hasSelection,
  label,
  testId,
}: {
  hasSelection: boolean;
  label: string;
  testId: string;
}) => (
  <button
    className={classNames(
      'tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:gap-1 tw:whitespace-nowrap',
      'tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-2.5 tw:text-sm tw:font-medium tw:text-secondary',
      'tw:relative tw:shadow-xs-skeuomorphic tw:outline-brand',
      borderAfter,
      'tw:after:outline-primary'
    )}
    data-testid={testId}
    type="button">
    {hasSelection ? `${label} · 1` : label}
    <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
  </button>
);

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
  const displayText = resolveUserChipDisplayText(selectedOwners, value);
  const hasSelection = Boolean(displayText);

  const trigger =
    variant === 'input' ? (
      <UserChipInputTrigger
        displayText={displayText}
        hasSelection={hasSelection}
        label={label}
        testId={`search-dropdown-${key}`}
      />
    ) : (
      <UserChipPillTrigger
        hasSelection={hasSelection}
        label={label}
        testId={`search-dropdown-${key}`}
      />
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
