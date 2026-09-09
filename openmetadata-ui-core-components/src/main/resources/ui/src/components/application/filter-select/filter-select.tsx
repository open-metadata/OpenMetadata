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
import { Button } from '@/components/base/buttons/button';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Skeleton } from '@/components/base/skeleton/skeleton';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Input } from '@/components/base/input/input';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { borderAfter } from '@/utils/tailwindClasses';
import { Check, ChevronDown, SearchLg } from '@untitledui/icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Button as AriaButton, type Selection } from 'react-aria-components';
import type {
  FilterSelectOption,
  FilterSelectProps,
  FilterSelectTriggerVariant,
} from './filter-select.types';

// Narrow wrapper so the icon prop's type doesn't widen to the raw
// `@untitledui/icons` FC, whose `children` type clashes with consumers that
// augment ReactNode globally (e.g. react-i18next).
const SearchInputIcon = (props: HTMLAttributes<HTMLOrSVGElement>) => (
  <SearchLg aria-hidden="true" {...props} />
);

const optionText = (option: FilterSelectOption): string =>
  option.textValue ??
  (typeof option.label === 'string' ? option.label : option.value);

const TriggerButton = ({
  hasSelection,
  text,
  testId,
  variant,
  className,
  icon,
  bordered,
}: {
  hasSelection: boolean;
  text: string;
  testId?: string;
  variant: FilterSelectTriggerVariant;
  className?: string;
  icon?: FC<{ className?: string }>;
  bordered?: boolean;
}) => {
  if (variant === 'button') {
    return (
      <Button
        className={cx('tw:whitespace-nowrap', className)}
        color={bordered ? 'secondary' : 'tertiary'}
        data-testid={testId}
        iconLeading={icon}
        iconTrailing={ChevronDown}
        size="md">
        {text}
      </Button>
    );
  }

  if (variant === 'input') {
    return (
      <AriaButton
        className={cx(
          'tw:flex tw:w-44 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:px-3 tw:py-2 tw:shadow-xs tw:outline-brand',
          className
        )}
        data-testid={testId}>
        <span
          className={cx(
            'tw:flex-1 tw:truncate tw:text-left tw:text-sm tw:font-medium',
            hasSelection ? 'tw:text-secondary' : 'tw:text-placeholder'
          )}>
          {text}
        </span>
        <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
      </AriaButton>
    );
  }

  return (
    <AriaButton
      className={cx(
        'tw:relative tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:gap-1 tw:whitespace-nowrap tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-2.5 tw:text-sm tw:font-medium tw:text-secondary tw:shadow-xs-skeuomorphic tw:outline-brand',
        borderAfter,
        'tw:after:outline-primary',
        className
      )}
      data-testid={testId}>
      {text}
      <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
    </AriaButton>
  );
};

const OptionRow = ({
  option,
  hideCounts,
  showCheckbox,
}: {
  option: FilterSelectOption;
  hideCounts?: boolean;
  showCheckbox: boolean;
}) => {
  const iconComponent = isReactComponent(option.icon)
    ? (option.icon as FC<{ className?: string }>)
    : undefined;
  const iconNode = iconComponent ? undefined : (option.icon as ReactNode);

  return (
    <Dropdown.Item
      addon={
        !hideCounts && option.count !== undefined
          ? String(option.count)
          : undefined
      }
      icon={iconComponent}
      id={option.value}
      showCheckbox={showCheckbox}
      textValue={optionText(option)}>
      {(state) => (
        <span className="tw:flex tw:w-full tw:min-w-0 tw:items-center tw:justify-between tw:gap-2">
          {iconNode !== undefined && (
            <span aria-hidden="true" className="tw:flex tw:shrink-0">
              {iconNode}
            </span>
          )}
          <span className="tw:grow tw:truncate">{option.label}</span>
          {!showCheckbox && state.isSelected && (
            <Check
              aria-hidden="true"
              className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary"
            />
          )}
        </span>
      )}
    </Dropdown.Item>
  );
};

/**
 * A filter dropdown: trigger + optional search + checkbox/check rows with
 * counts, an optional pinned null row ("No X"), an optional tri-state
 * "Select all" over the displayed rows, and immediate or staged commits.
 *
 * Every row renders through the same components (`Dropdown.Item`,
 * `CheckboxBase` size `sm`), so checkbox size, alignment, and typography are
 * uniform by construction.
 */
export const FilterSelect = ({
  label,
  options,
  selectedValues,
  onChange,
  bordered,
  className,
  commitMode = 'immediate',
  'data-testid': testId,
  emptyState,
  helperText,
  hideCounts,
  isLoading,
  isOpen: controlledIsOpen,
  nullOption,
  popoverClassName,
  resolveMissingLabel,
  searchable,
  selectionMode = 'multiple',
  showSelectAll,
  triggerIcon,
  triggerVariant = 'chip',
  onOpenChange,
  onSearch,
}: FilterSelectProps) => {
  const { t } = useCoreTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalOpen;
  const [query, setQuery] = useState('');
  const [staged, setStaged] = useState<string[]>(selectedValues);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  const isMulti = selectionMode === 'multiple';
  const isStaged = isMulti && commitMode === 'staged';
  const current = isStaged ? staged : selectedValues;

  // A persisted selection (e.g. restored from the URL) may be absent from the
  // fetched option page until searched — surface it as its own row so the
  // trigger and list show it selected instead of blank.
  const mergedOptions = useMemo(() => {
    const known = new Set(options.map((option) => option.value));
    if (nullOption) {
      known.add(nullOption.value);
    }
    const missing = selectedValues
      .filter((value) => !known.has(value))
      .map((value) => ({
        value,
        label: resolveMissingLabel?.(value) ?? value,
      }));

    return missing.length > 0 ? [...missing, ...options] : options;
  }, [options, selectedValues, nullOption, resolveMissingLabel]);

  // With async search the parent already filters `options`; otherwise filter
  // locally. The null row participates so a search can't strand it.
  const displayedOptions = useMemo(() => {
    if (onSearch || query === '') {
      return mergedOptions;
    }
    const lowerQuery = query.toLowerCase();

    return mergedOptions.filter((option) =>
      optionText(option).toLowerCase().includes(lowerQuery)
    );
  }, [mergedOptions, onSearch, query]);

  const displayedNullOption = useMemo(() => {
    if (!nullOption || onSearch || query === '') {
      return nullOption;
    }

    return optionText(nullOption).toLowerCase().includes(query.toLowerCase())
      ? nullOption
      : undefined;
  }, [nullOption, onSearch, query]);

  const triggerText = useMemo(() => {
    if (isMulti) {
      return selectedValues.length > 0
        ? `${label} · ${selectedValues.length}`
        : label;
    }
    const selected = [
      ...(nullOption ? [nullOption] : []),
      ...mergedOptions,
    ].find((option) => option.value === selectedValues[0]);

    return selected ? optionText(selected) : label;
  }, [isMulti, selectedValues, label, mergedOptions, nullOption]);

  const selectedKeySet = useMemo<Selection>(() => new Set(current), [current]);

  const commit = isStaged ? setStaged : onChange;

  // Resync staged whenever the dropdown transitions open — including a
  // programmatic open via the controlled `isOpen` prop, which never goes
  // through react-aria's onOpenChange.
  useEffect(() => {
    if (isOpen && isStaged) {
      setStaged(selectedValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    setInternalOpen(open);
    onOpenChange?.(open);
    setQuery('');
  };

  const handleSearch = (search: string) => {
    setQuery(search);
    onSearch?.(search);
  };

  const handleSelectionChange = (keys: Selection) => {
    // ⌘A pressed inside the search box selects its text; react-aria still
    // reports the menu's select-all sentinel, so ignore it there.
    if (
      keys === 'all' &&
      searchWrapperRef.current?.contains(document.activeElement)
    ) {
      return;
    }

    // 'all' is react-aria's select-all sentinel (e.g. ⌘A) — resolve it to the
    // displayed rows merged with values selected but currently filtered out.
    const next =
      keys === 'all'
        ? Array.from(
            new Set([
              ...current,
              ...displayedOptions.map((option) => option.value),
              ...(displayedNullOption ? [displayedNullOption.value] : []),
            ])
          )
        : Array.from(keys, String);
    if (isMulti) {
      commit(next);
    } else {
      onChange(next.length > 0 ? [next[0]] : []);
      handleOpenChange(false);
    }
  };

  // "Select all" scope: the displayed (filtered) value rows. Deselecting
  // removes only those, keeping selections hidden by the current search.
  const displayedSelectedCount = displayedOptions.filter((option) =>
    current.includes(option.value)
  ).length;
  const allDisplayedSelected =
    displayedOptions.length > 0 &&
    displayedSelectedCount === displayedOptions.length;

  const handleSelectAll = (checked: boolean) => {
    const displayedValues = displayedOptions.map((option) => option.value);
    commit(
      checked
        ? Array.from(new Set([...current, ...displayedValues]))
        : current.filter((value) => !displayedValues.includes(value))
    );
  };

  const handleApply = () => {
    onChange(staged);
    handleOpenChange(false);
  };

  const showFooter = isStaged;
  const showSelectAllRow =
    isMulti && Boolean(showSelectAll) && displayedOptions.length > 0;
  const isEmpty =
    !isLoading && displayedOptions.length === 0 && !displayedNullOption;

  return (
    <Dropdown.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      <TriggerButton
        bordered={bordered}
        className={className}
        hasSelection={selectedValues.length > 0}
        icon={triggerIcon}
        testId={testId}
        text={triggerText}
        variant={triggerVariant}
      />
      <Dropdown.Popover
        className={cx('tw:w-64', popoverClassName)}
        placement="bottom left">
        {searchable && (
          <div className="tw:p-2" ref={searchWrapperRef}>
            <Input
              icon={SearchInputIcon}
              placeholder={t('label.search')}
              size="sm"
              value={query}
              onChange={handleSearch}
            />
          </div>
        )}

        {helperText !== undefined && (
          <div className="tw:px-4 tw:pb-2 tw:text-xs tw:text-tertiary">
            {helperText}
          </div>
        )}

        {showSelectAllRow && (
          <div className="tw:px-4 tw:py-2">
            <Checkbox
              isIndeterminate={
                displayedSelectedCount > 0 && !allDisplayedSelected
              }
              isSelected={allDisplayedSelected}
              label={t('label.select-all')}
              size="sm"
              onChange={handleSelectAll}
            />
          </div>
        )}

        {isLoading && (
          <div
            aria-label={t('label.loading')}
            className="tw:flex tw:flex-col tw:gap-2 tw:px-4 tw:py-2"
            role="status">
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="70%" />
          </div>
        )}

        {isEmpty && (
          <div className="tw:px-4 tw:py-2 tw:text-sm tw:text-tertiary">
            {emptyState ?? t('label.no-data-found')}
          </div>
        )}

        {!isLoading && !isEmpty && (
          <Dropdown.Menu
            aria-label={label}
            className="tw:max-h-64 tw:overflow-y-auto"
            disallowEmptySelection={false}
            selectedKeys={selectedKeySet}
            selectionMode={selectionMode}
            onSelectionChange={handleSelectionChange}>
            {displayedNullOption && (
              <OptionRow
                hideCounts={hideCounts}
                option={displayedNullOption}
                showCheckbox={isMulti}
              />
            )}
            {displayedOptions.map((option) => (
              <OptionRow
                hideCounts={hideCounts}
                key={option.value}
                option={option}
                showCheckbox={isMulti}
              />
            ))}
          </Dropdown.Menu>
        )}

        {showFooter && (
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:p-2">
            <Button
              color="tertiary"
              data-testid="clear-filter-btn"
              isDisabled={staged.length === 0}
              size="sm"
              onPress={() => setStaged([])}>
              {t('label.clear-all')}
            </Button>
            <div className="tw:flex tw:items-center tw:gap-2">
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
            </div>
          </div>
        )}
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};
