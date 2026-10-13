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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface FilterButtonOption {
  value: string;
  label: string;
  /** Optional trailing text (e.g. a count) rendered after the label. */
  supportingText?: string;
}

interface FilterButtonBaseProps {
  /**
   * Trigger fallback label when nothing is selected. Optional — a call site
   * that always has a value (e.g. a single-select filter with a persisted
   * default) can omit it, in which case the trigger renders empty in the
   * zero-selected state.
   */
  label?: string;
  options: FilterButtonOption[];
  iconLeading?: React.FC<{ className?: string }>;
  /** Optional per-item leading node (e.g. a colored swatch/icon) rendered before the label. */
  renderItemIcon?: (optionValue: string) => React.ReactNode;
  testId?: string;
  /** Show a search box above the list. Worth it once the list outgrows a glance. */
  searchable?: boolean;
  /** Custom label for the empty-state row, rendered as "No <emptyLabel>". Falls back to "No options". */
  emptyLabel?: string;
}

interface SingleFilterButtonProps extends FilterButtonBaseProps {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
}

interface MultiFilterButtonProps extends FilterButtonBaseProps {
  multiple: true;
  /** Empty means "no filter", not "match nothing" — the trigger falls back to `label`. */
  value: string[];
  onChange: (value: string[]) => void;
}

/**
 * A discriminated union rather than a widened `string | string[]`, so single-select call sites keep
 * their existing prop types and cannot be handed an array by mistake.
 */
export type FilterButtonProps =
  | SingleFilterButtonProps
  | MultiFilterButtonProps;

/**
 * Shared filter dropdown, rendered through the unified FilterSelect core
 * component: immediate commits, local search, and the app-wide row treatment
 * (checkbox rows for multi-select, check glyph for single select).
 */
export const FilterButton: React.FC<FilterButtonProps> = (props) => {
  const {
    label,
    options,
    iconLeading,
    renderItemIcon,
    testId,
    searchable,
    emptyLabel,
  } = props;
  const { t } = useTranslation();

  const singleValue = !props.multiple && props.value ? [props.value] : [];
  const selectedValues = props.multiple ? props.value : singleValue;

  // Selected first, so a selection stays visible without scrolling to find it.
  // Stable within each group, so the underlying order (alphabetical) holds.
  const orderedOptions = useMemo(() => {
    const selected = new Set(selectedValues);

    return [
      ...options.filter((option) => selected.has(option.value)),
      ...options.filter((option) => !selected.has(option.value)),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, selectedValues.join(',')]);

  const handleChange = (values: string[]) => {
    if (props.multiple) {
      props.onChange(values);
    } else if (values[0] !== undefined) {
      props.onChange(values[0]);
    }
  };

  return (
    <FilterSelect
      bordered
      hideCounts
      commitMode="immediate"
      data-testid={testId}
      emptyState={
        emptyLabel
          ? t('label.no-entity', { entity: emptyLabel })
          : t('label.no-options')
      }
      label={label ?? ''}
      options={orderedOptions.map((option) => ({
        value: option.value,
        label: option.supportingText ? (
          // Fills the row and pushes the count to the right edge, matching the
          // alignment this filter had before it moved onto FilterSelect.
          <span className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:justify-between tw:gap-2">
            <span className="tw:grow tw:truncate">{option.label}</span>
            <span className="tw:shrink-0 tw:text-xs tw:text-tertiary">
              {option.supportingText}
            </span>
          </span>
        ) : (
          option.label
        ),
        textValue: option.label,
        icon: renderItemIcon?.(option.value),
      }))}
      searchable={searchable}
      selectedValues={selectedValues}
      selectionMode={props.multiple ? 'multiple' : 'single'}
      triggerIcon={iconLeading}
      triggerVariant="button"
      onChange={handleChange}
    />
  );
};

export default FilterButton;
