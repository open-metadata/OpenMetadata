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
import { Check, ChevronDown, SearchLg, XClose } from '@untitledui/icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
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

const TriggerCountBadge = ({ count }: { count: number }) => (
  <span
    className="tw:ml-1.5 tw:inline-flex tw:h-[18px] tw:min-w-[18px] tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-brand-50 tw:px-[5px] tw:text-xs tw:font-medium tw:text-utility-brand-700 tw:tabular-nums"
    data-testid="filter-count-badge">
    {count}
  </span>
);

const TriggerButton = ({
  hasSelection,
  text,
  count,
  placeholder,
  testId,
  variant,
  className,
  icon,
  bordered,
}: {
  hasSelection: boolean;
  text: string;
  count?: number;
  placeholder?: string;
  testId?: string;
  variant: FilterSelectTriggerVariant;
  className?: string;
  icon?: FC<{ className?: string }>;
  bordered?: boolean;
}) => {
  const countBadge =
    count !== undefined && count > 0 ? (
      <TriggerCountBadge count={count} />
    ) : null;

  if (variant === 'button') {
    return (
      <Button
        className={cx(
          'tw:whitespace-nowrap',
          // The borderless trigger hugs its label like the legacy quick
          // filters (4px padding, 14px chevron), so a full toolbar of them
          // fits on one row beside same-sized toolbar controls.
          !bordered && 'tw:p-1 tw:*:data-icon:size-3.5',
          hasSelection &&
            'tw:text-fg-brand-primary tw:hover:text-fg-brand-primary',
          hasSelection && bordered && 'tw:after:outline-brand',
          className
        )}
        color={bordered ? 'secondary' : 'tertiary'}
        data-testid={testId}
        iconLeading={icon}
        iconTrailing={ChevronDown}
        size={bordered ? 'md' : 'sm'}>
        {text}
        {countBadge}
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
          {hasSelection ? text : placeholder ?? text}
        </span>
        {countBadge}
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
      {countBadge}
      <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
    </AriaButton>
  );
};

/**
 * Input-variant trigger that echoes the selection as removable chips.
 *
 * The remove buttons are native buttons on purpose: `MenuTrigger` publishes
 * its press-to-open props through `ButtonContext`, which every react-aria
 * `Button` descendant consumes, so an aria button here would both remove the
 * chip and toggle the popover — and would fight the trailing button over the
 * trigger ref. The single aria button stays the sole menu trigger, and the
 * popover anchors to the whole field via `fieldRef`.
 */
const ChipsField = ({
  chips,
  placeholder,
  testId,
  className,
  fieldRef,
  onRemove,
}: {
  chips: { value: string; label: ReactNode }[];
  placeholder: string;
  testId?: string;
  className?: string;
  fieldRef: RefObject<HTMLDivElement>;
  onRemove: (value: string) => void;
}) => {
  const { t } = useCoreTranslation();

  return (
    <div
      className={cx(
        'tw:flex tw:min-h-10 tw:w-64 tw:flex-wrap tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:py-1 tw:pr-2.5 tw:pl-1.5 tw:shadow-xs',
        className
      )}
      ref={fieldRef}>
      {chips.map((chip) => (
        <span
          className="tw:flex tw:max-w-44 tw:items-center tw:gap-0.5 tw:rounded-md tw:border tw:border-secondary tw:bg-secondary tw:py-px tw:pr-0.5 tw:pl-2 tw:text-xs tw:font-medium tw:text-secondary"
          data-testid="filter-chip"
          key={chip.value}>
          <span className="tw:truncate">{chip.label}</span>
          <button
            aria-label={t('label.remove-filter')}
            className="tw:flex tw:cursor-pointer tw:rounded-xs tw:p-0.5 tw:text-placeholder tw:outline-brand tw:hover:text-secondary tw:focus-visible:outline-2"
            type="button"
            onClick={() => onRemove(chip.value)}>
            <XClose
              aria-hidden="true"
              className="tw:size-3"
              strokeWidth={2.5}
            />
          </button>
        </span>
      ))}
      <AriaButton
        className="tw:flex tw:min-w-10 tw:flex-1 tw:cursor-pointer tw:items-center tw:justify-between tw:gap-2 tw:self-stretch tw:rounded-sm tw:pl-1.5 tw:outline-brand"
        data-testid={testId}>
        {chips.length === 0 ? (
          <span className="tw:truncate tw:text-sm tw:font-normal tw:text-placeholder">
            {placeholder}
          </span>
        ) : (
          <span />
        )}
        <ChevronDown className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
      </AriaButton>
    </div>
  );
};

const OptionRow = ({
  option,
  hideCounts,
  showCheckbox,
  testId,
}: {
  option: FilterSelectOption;
  hideCounts?: boolean;
  showCheckbox: boolean;
  testId: string;
}) => {
  const iconComponent = isReactComponent(option.icon)
    ? (option.icon as FC<{ className?: string }>)
    : undefined;
  const iconNode = iconComponent ? undefined : (option.icon as ReactNode);

  return (
    <Dropdown.Item
      checkboxSize="xs"
      // Selection is conveyed by the checkbox alone — suppress the default
      // selected background, keeping the hover/focus tint.
      className={(state) =>
        state.isSelected && !state.isFocused ? 'tw:[&>div]:bg-transparent!' : ''
      }
      data-testid={testId}
      icon={iconComponent}
      id={option.value}
      showCheckbox={showCheckbox}
      textValue={optionText(option)}>
      {(state) => (
        <span
          className={cx(
            'tw:flex tw:w-full tw:min-w-0 tw:items-center tw:justify-between tw:gap-2 tw:text-xs tw:font-normal',
            state.isSelected ? 'tw:text-primary' : 'tw:text-secondary'
          )}>
          {iconNode !== undefined && (
            <span aria-hidden="true" className="tw:flex tw:shrink-0">
              {iconNode}
            </span>
          )}
          <span className="tw:grow tw:truncate">{option.label}</span>
          {!hideCounts && option.count !== undefined && (
            <span
              className={cx(
                'tw:shrink-0 tw:rounded-md tw:border tw:border-secondary tw:px-1.5 tw:text-xs tw:font-normal tw:tabular-nums',
                state.isSelected ? 'tw:text-tertiary' : 'tw:text-placeholder'
              )}>
              {option.count.toLocaleString()}
            </span>
          )}
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
  placeholder,
  popoverClassName,
  resolveMissingLabel,
  searchable,
  selectionMode = 'multiple',
  showSelectAll,
  triggerDisplay = 'count',
  triggerIcon,
  triggerVariant = 'chip',
  typography = 'medium',
  onOpenChange,
  onSearch,
}: FilterSelectProps) => {
  const { t } = useCoreTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledIsOpen ?? internalOpen;
  const [query, setQuery] = useState('');
  const [staged, setStaged] = useState<string[]>(selectedValues);
  const searchWrapperRef = useRef<HTMLDivElement>(null);
  const chipsFieldRef = useRef<HTMLDivElement>(null);

  const isMulti = selectionMode === 'multiple';
  const isStaged = isMulti && commitMode === 'staged';
  const isChips =
    isMulti && triggerVariant === 'input' && triggerDisplay === 'chips';
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
      // The selection count renders as a separate pill badge on the trigger.
      return label;
    }
    const selected = [
      ...(nullOption ? [nullOption] : []),
      ...mergedOptions,
    ].find((option) => option.value === selectedValues[0]);

    return selected ? optionText(selected) : label;
  }, [isMulti, selectedValues, label, mergedOptions, nullOption]);

  const chips = useMemo(() => {
    if (!isChips) {
      return [];
    }
    const all = [...(nullOption ? [nullOption] : []), ...mergedOptions];

    return selectedValues.map((value) => ({
      value,
      label: all.find((option) => option.value === value)?.label ?? value,
    }));
  }, [isChips, nullOption, mergedOptions, selectedValues]);

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
  // Immediate mode has nothing to apply, so it gets a quiet footer instead:
  // what is selected, and a way to drop it all without closing the menu.
  const showStatusFooter = isMulti && !isStaged;
  const showSelectAllRow =
    isMulti && Boolean(showSelectAll) && displayedOptions.length > 0;
  const isEmpty =
    !isLoading && displayedOptions.length === 0 && !displayedNullOption;

  return (
    <Dropdown.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      {isChips ? (
        <ChipsField
          chips={chips}
          className={className}
          fieldRef={chipsFieldRef}
          placeholder={placeholder ?? label}
          testId={testId}
          onRemove={(value) =>
            onChange(selectedValues.filter((selected) => selected !== value))
          }
        />
      ) : (
        <TriggerButton
          bordered={bordered}
          className={cx(
            typography === 'regular' && 'tw:font-normal',
            className
          )}
          count={isMulti ? selectedValues.length : undefined}
          hasSelection={selectedValues.length > 0}
          icon={triggerIcon}
          placeholder={placeholder}
          testId={testId}
          text={triggerText}
          variant={triggerVariant}
        />
      )}
      <Dropdown.Popover
        className={cx('tw:w-80', popoverClassName)}
        data-testid="drop-down-menu"
        placement="bottom left"
        triggerRef={isChips ? chipsFieldRef : undefined}>
        {searchable && (
          <div className="tw:p-2" ref={searchWrapperRef}>
            <Input
              icon={SearchInputIcon}
              inputDataTestId="search-input"
              placeholder={t('label.search')}
              size="sm"
              value={query}
              onChange={handleSearch}
            />
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
              size="xs"
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
            // A search box owns focus while it is there: the menu remounts
            // whenever results land, and MenuTrigger's autofocus would pull
            // the caret out of the box mid-query.
            autoFocus={searchable ? false : undefined}
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
                testId={isMulti ? 'no-option-checkbox' : 'no-option-radio'}
              />
            )}
            {displayedOptions.map((option) => (
              <OptionRow
                hideCounts={hideCounts}
                key={option.value}
                option={option}
                showCheckbox={isMulti}
                testId={`${option.value}-checkbox`}
              />
            ))}
          </Dropdown.Menu>
        )}

        {helperText !== undefined && (
          <div className="tw:border-t tw:border-secondary tw:px-3 tw:py-2 tw:text-xs tw:text-tertiary">
            {helperText}
          </div>
        )}

        {showFooter && (
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:p-3">
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
                data-testid="close-btn"
                size="sm"
                onPress={() => handleOpenChange(false)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="update-btn"
                size="sm"
                onPress={handleApply}>
                {staged.length > 0
                  ? t('label.apply-count', { count: staged.length })
                  : t('label.apply')}
              </Button>
            </div>
          </div>
        )}

        {showStatusFooter && (
          <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:border-secondary tw:py-1.5 tw:pr-1.5 tw:pl-3">
            <span
              className="tw:text-xs tw:font-normal tw:text-tertiary"
              data-testid="selected-count">
              {selectedValues.length === 0
                ? t('label.none-selected')
                : t('label.count-selected', { count: selectedValues.length })}
            </span>
            <Button
              color="tertiary"
              data-testid="clear-filter-btn"
              isDisabled={selectedValues.length === 0}
              size="sm"
              onPress={() => onChange([])}>
              {t('label.clear-all')}
            </Button>
          </div>
        )}
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};
