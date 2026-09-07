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
  Button,
  Dropdown,
  Input,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { Check, ChevronDown, SearchLg } from '@untitledui/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Id for the disabled empty-state row. Prefixed so it cannot collide with a real option value. */
const NO_RESULTS_KEY = '__filter_button_no_results__';

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
 * Shared filter dropdown: trigger button showing the active selection, with
 * a popover list whose selected item is indicated by a light-brand
 * background, blue label text, and a checkmark — the canonical selected-item
 * treatment for filter dropdowns across the app.
 *
 * Multi-select is opt-in via `multiple`. `Dropdown.Menu` applies its
 * `selectionMode`/`disallowEmptySelection` defaults before spreading props, so both are overridable
 * from here without touching the core component.
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
  const [query, setQuery] = useState('');

  const selectedValues = props.multiple ? props.value : [props.value];
  const labelOf = (optionValue: string) =>
    options.find((option) => option.value === optionValue)?.label;

  // One selection reads better as the thing selected; several only fit as a count, so the
  // trigger carries a tooltip naming them — otherwise "3 selected" is unreadable without
  // reopening the menu.
  const selectedLabels = selectedValues.map((value) => labelOf(value) ?? value);
  const multiSelectionLabel =
    selectedValues.length === 0
      ? label
      : t('label.n-selected', { count: selectedValues.length });
  const triggerLabel =
    selectedValues.length === 1 ? selectedLabels[0] : multiSelectionLabel;
  const triggerTitle =
    selectedLabels.length > 1 ? selectedLabels.join(', ') : undefined;

  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? options.filter((option) => option.label.toLowerCase().includes(needle))
      : options;

    // Selected first, so a selection stays visible without scrolling to find it. Stable within
    // each group, so the underlying order (alphabetical) still holds.
    const selected = new Set(selectedValues);

    return [
      ...matching.filter((option) => selected.has(option.value)),
      ...matching.filter((option) => !selected.has(option.value)),
    ];
  }, [options, query, selectedValues.join(',')]);

  const handleSelectionChange = (keys: 'all' | Iterable<React.Key>) => {
    // react-aria signals select-all with the literal string 'all', which satisfies
    // Iterable<React.Key> — Array.from would silently split it into ['a','l','l'] and write three
    // bogus values to the caller.
    const next =
      keys === 'all'
        ? options.map((option) => option.value)
        : Array.from(keys).map(String);
    if (props.multiple) {
      props.onChange(next);
    } else if (next[0] !== undefined) {
      props.onChange(next[0]);
    }
  };

  const trigger = (
    <Button
      color="secondary"
      data-testid={testId}
      iconLeading={iconLeading}
      iconTrailing={ChevronDown}>
      {triggerLabel}
    </Button>
  );

  return (
    // Reopening should start from the full list, not from whatever was typed last time — a stale
    // query reads as "this filter has no options".
    <Dropdown.Root
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setQuery('');
        }
      }}>
      {/* The trigger collapses to "N selected" once there is more than one, so the tooltip is the
          only way to see which. It wraps the button rather than the whole Dropdown.Root so the menu
          stays the trigger's sibling.

          Rendered only when there is something to show, rather than always-rendered-and-disabled:
          at one-or-zero selections the label already says everything, and a single-select caller
          then never pulls Tooltip into its render tree at all. That matters because several
          unrelated call sites mock the component library, and an unconditional Tooltip made every
          one of their suites fail on a mock that had no reason to stub it. */}
      {triggerTitle ? (
        <Tooltip placement="top" title={triggerTitle}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <Dropdown.Popover
        // A search box needs room to be usable; without one the popover should still hug its
        // options rather than reserving that width.
        className={searchable ? 'tw:w-64' : 'tw:min-w-36'}
        placement="bottom left">
        {searchable && (
          <div className="tw:p-2">
            <Input
              data-testid={testId ? `${testId}-search` : undefined}
              icon={SearchLg}
              placeholder={t('label.search')}
              size="sm"
              value={query}
              onChange={setQuery}
            />
          </div>
        )}
        <Dropdown.Menu
          // The base Dropdown moved scroll to consumers (OpenMetadata #30031 dropped
          // overflow-y-auto from DropdownMenu), so without this a long list runs off screen
          // instead of scrolling.
          className="tw:max-h-64 tw:overflow-y-auto"
          disallowEmptySelection={!props.multiple}
          selectedKeys={selectedValues}
          selectionMode={props.multiple ? 'multiple' : 'single'}
          onSelectionChange={handleSelectionChange}>
          {/* Without this a search that matches nothing renders an empty popover, which is
              indistinguishable from the menu failing to load. */}
          {visibleOptions.length === 0 ? (
            <Dropdown.Item isDisabled id={NO_RESULTS_KEY} key={NO_RESULTS_KEY}>
              {() => (
                <span className="tw:px-2.5 tw:py-2 tw:text-sm tw:text-tertiary">
                  {emptyLabel
                    ? t('label.no-entity', { entity: emptyLabel })
                    : t('label.no-options')}
                </span>
              )}
            </Dropdown.Item>
          ) : (
            visibleOptions.map((opt) => (
              <Dropdown.Item
                className={(state) =>
                  state.isSelected ? 'tw:[&>div]:!bg-brand-50' : ''
                }
                id={opt.value}
                key={opt.value}>
                {(state) => {
                  const optionTextClass = state.isSelected
                    ? 'tw:text-brand-700'
                    : 'tw:text-secondary';

                  return (
                    <div className="tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-2">
                      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2">
                        {renderItemIcon?.(opt.value)}
                        <span
                          className={[
                            'tw:grow tw:truncate tw:text-sm',
                            state.isDisabled
                              ? 'tw:text-disabled'
                              : optionTextClass,
                          ].join(' ')}>
                          {opt.label}
                        </span>
                        {opt.supportingText && (
                          <span className="tw:shrink-0 tw:text-xs tw:text-tertiary">
                            {opt.supportingText}
                          </span>
                        )}
                      </div>
                      {state.isSelected && (
                        <Check
                          aria-hidden="true"
                          className="tw:size-4 tw:shrink-0 tw:text-brand-700"
                          height={16}
                          width={16}
                        />
                      )}
                    </div>
                  );
                }}
              </Dropdown.Item>
            ))
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default FilterButton;
