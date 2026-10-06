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
import { FilterSelect } from '@openmetadata/ui-core-components';
import {
  Columns01,
  LayoutAlt04,
  Table,
} from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { TestCaseType } from '../../../../enums/TestSuite.enum';
import { getNameFromFQN } from '../../../../utils/FqnUtils';
import {
  FilterDescriptor,
  FilterValue,
} from '../../../DataQuality/TestCases/FilterChip.interface';
import DqDateRangeFilter from '../../DataQuality/Dashboard/DqDateRangeFilter';

// Leading icons for single-select filter options, per the 2.0 mock. Keyed by
// option value so it naturally extends to other filters (e.g. status).
const FILTER_OPTION_ICONS: Partial<Record<string, typeof Table>> = {
  [TestCaseType.all]: LayoutAlt04,
  [TestCaseType.table]: Table,
  [TestCaseType.column]: Columns01,
};

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
  isOpen,
  onOpenChange,
}: {
  descriptor: FilterDescriptor;
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

  return (
    <FilterSelect
      bordered
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
      triggerVariant="button"
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
};

const DateChip = ({
  descriptor,
  isOpen,
  onOpenChange,
}: {
  descriptor: FilterDescriptor;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const range = (descriptor.value ?? {}) as {
    startTs?: number;
    endTs?: number;
  };

  return (
    <DqDateRangeFilter
      endTs={range.endTs != null ? Number(range.endTs) : undefined}
      isOpen={isOpen}
      startTs={range.startTs != null ? Number(range.startTs) : undefined}
      onApply={(value) => descriptor.onChange(value)}
      onOpenChange={onOpenChange}
    />
  );
};

export const FilterChip = ({
  descriptor,
  isOpen,
  onOpenChange,
}: {
  descriptor: FilterDescriptor;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  if (descriptor.controlType === 'date') {
    return (
      <DateChip
        descriptor={descriptor}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      />
    );
  }

  return (
    <SelectChip
      descriptor={descriptor}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    />
  );
};

export default FilterChip;
