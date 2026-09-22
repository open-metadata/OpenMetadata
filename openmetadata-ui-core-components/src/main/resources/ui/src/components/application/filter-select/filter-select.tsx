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
import { Typography } from '@/components/foundations/typography';
import {
  DropdownSearchField,
  DropdownStagedFooter,
  DropdownStatusFooter,
  TriggerCountBadge,
} from './filter-select.shared';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { borderAfter } from '@/utils/tailwindClasses';
import { ChevronDown, ChevronUp, XClose } from '@untitledui/icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
  type RefObject,
} from 'react';
import { Button as AriaButton, type Selection } from 'react-aria-components';
import type {
  FilterSelectOption,
  FilterSelectProps,
  FilterSelectTriggerVariant,
} from './filter-select.types';
import { TreeSelect } from '../tree-select/tree-select';

const optionText = (option: FilterSelectOption): string =>
  option.textValue ??
  (typeof option.label === 'string' ? option.label : option.value);

export const TriggerButton = ({
  hasSelection,
  isOpen,
  text,
  label,
  count,
  placeholder,
  testId,
  variant,
  className,
  icon,
  bordered,
}: {
  hasSelection: boolean;
  isOpen?: boolean;
  text: string;
  label: string;
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
            'tw:text-fg-brand-primary tw:hover:text-fg-brand-primary tw:*:data-icon:text-fg-brand-primary',
          // Active-filter border is brand blue in light, but neutral (gray-700)
          // in dark per the palette guideline — dark:*_alt flips only the dark
          // value and leaves light frozen.
          hasSelection &&
            bordered &&
            'tw:after:outline-brand tw:dark:after:outline-brand_alt',
          className
        )}
        color={bordered ? 'secondary' : 'tertiary'}
        data-testid={testId}
        iconLeading={icon}
        iconTrailing={isOpen ? ChevronUp : ChevronDown}
        size={bordered ? 'md' : 'sm'}>
        <span data-testid={`search-dropdown-${label}`}>{text}</span>
        {countBadge}
      </Button>
    );
  }

  if (variant === 'input') {
    return (
      <AriaButton
        className={cx(
          // Sized like the toolbar selects this trigger replaces: 32px tall,
          // filling the width its container gives it (constrain via className).
          'tw:flex tw:h-8 tw:w-full tw:min-w-24 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-primary tw:bg-primary tw:px-3 tw:shadow-xs tw:outline-brand',
          className
        )}
        data-testid={testId}>
        <span
          className={cx(
            'tw:flex-1 tw:truncate tw:text-left tw:text-sm tw:font-medium',
            hasSelection ? 'tw:text-secondary' : 'tw:text-placeholder'
          )}
          data-testid={`search-dropdown-${label}`}>
          {hasSelection ? text : placeholder ?? text}
        </span>
        {countBadge}
        <ChevronDown
          className={cx(
            'tw:size-5 tw:shrink-0 tw:text-fg-quaternary tw:transition-transform tw:duration-200',
            isOpen && 'tw:rotate-180'
          )}
        />
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
      <span data-testid={`search-dropdown-${label}`}>{text}</span>
      {countBadge}
      <ChevronDown
        className={cx(
          'tw:size-5 tw:shrink-0 tw:transition-transform tw:duration-200',
          isOpen && 'tw:rotate-180',
          hasSelection ? 'tw:text-fg-brand-primary' : 'tw:text-fg-quaternary'
        )}
      />
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
  isOpen,
  placeholder,
  testId,
  className,
  fieldRef,
  onRemove,
}: {
  chips: { value: string; label: ReactNode }[];
  isOpen?: boolean;
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
          <Typography className="tw:truncate">{chip.label}</Typography>
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
          <Typography
            className="not-prose tw:truncate tw:text-placeholder"
            size="text-sm"
            weight="regular">
            {placeholder}
          </Typography>
        ) : (
          <span />
        )}
        <ChevronDown
          className={cx(
            'tw:size-5 tw:shrink-0 tw:text-fg-quaternary tw:transition-transform tw:duration-200',
            isOpen && 'tw:rotate-180'
          )}
        />
      </AriaButton>
    </div>
  );
};

const OptionRow = ({
  option,
  hideCounts,
  showCheckbox,
  isNullOption,
}: {
  option: FilterSelectOption;
  hideCounts?: boolean;
  showCheckbox: boolean;
  /** The pinned "No <X>" row, which the design mutes relative to real options. */
  isNullOption?: boolean;
}) => {
  const iconComponent = isReactComponent(option.icon)
    ? (option.icon as FC<{ className?: string }>)
    : undefined;
  const iconNode = iconComponent ? undefined : (option.icon as ReactNode);

  return (
    <Dropdown.Item
      checkboxSize="xs"
      // Multi select: the checkbox alone conveys selection — suppress the
      // default selected background, keeping the hover/focus tint. Single
      // select has no checkbox, so the selected row itself goes brand: blue
      // tint, blue label, blue icon.
      className={(state) =>
        cx(
          showCheckbox &&
            state.isSelected &&
            !state.isFocused &&
            'tw:[&>div]:bg-transparent!',
          !showCheckbox &&
            state.isSelected &&
            'tw:[&>div]:bg-utility-brand-50! tw:[&_svg]:text-fg-brand-primary!'
        )
      }
      data-testid={option.value}
      icon={iconComponent}
      id={option.value}
      showCheckbox={showCheckbox}
      textValue={optionText(option)}>
      {(state) => (
        <span
          className={cx(
            'tw:relative tw:flex tw:w-full tw:min-w-0 tw:items-center tw:justify-between tw:gap-2 tw:text-sm tw:font-normal',
            // Real options read at full strength whether or not they are
            // selected; only the pinned null row is muted. Single select has no
            // checkbox, so its selected row goes brand instead.
            isNullOption ? 'tw:text-secondary' : 'tw:text-primary',
            !showCheckbox && state.isSelected && 'tw:text-fg-brand-primary'
          )}>
          {iconNode !== undefined && (
            <span aria-hidden="true" className="tw:flex tw:shrink-0">
              {iconNode}
            </span>
          )}
          <Typography
            className="not-prose tw:grow tw:truncate"
            title={optionText(option)}>
            {option.label}
          </Typography>
          {!hideCounts && option.count !== undefined && (
            <Typography
              className={cx(
                'not-prose tw:shrink-0 tw:rounded-md tw:border tw:px-1.5 tw:tabular-nums',
                !showCheckbox && state.isSelected
                  ? 'tw:border-utility-brand-200 tw:text-fg-brand-primary'
                  : 'tw:border-secondary',
                showCheckbox && state.isSelected && 'tw:text-tertiary',
                !state.isSelected && 'tw:text-placeholder'
              )}
              data-testid="filter-count"
              size="text-xs"
              weight="regular">
              {option.count.toLocaleString()}
            </Typography>
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
const FilterSelect = ({
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
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  const isMulti = selectionMode === 'multiple';
  const isStaged = commitMode === 'staged';
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

  // While open, resync on a genuine change to the selected values, keyed on the
  // values rather than the array. Consumers pass `selectedValues` as a memo over
  // server-fetched options, so a suggestions request resolving mid-edit hands
  // over a new array holding the same values; syncing on that would discard the
  // row the user just clicked. A real external change — Explore quick filters
  // stay mounted and open across query-string-only navigation, so a filter
  // cleared that way must reach the staged set — still applies, which keeps
  // Apply from writing a stale value back.
  const selectedValuesKey = useMemo(
    () => JSON.stringify(selectedValues),
    [selectedValues]
  );
  useEffect(() => {
    if (isOpen && isStaged) {
      setStaged(selectedValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValuesKey]);

  const handleOpenChange = (open: boolean) => {
    setInternalOpen(open);
    onOpenChange?.(open);
    setQuery('');
  };

  // A closing popover's subtree survives until its exit transition ends, so
  // keystrokes can land in the *previous* filter's search box after a sibling
  // swap — its onSearch would then repaint the consumer's (often shared)
  // options with the wrong facet's results. Ignore input once closed; the
  // box is also disabled below so automation waits for the live one instead.
  const handleSearch = (search: string) => {
    if (!isOpen) {
      return;
    }
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
      // Staged single-select keeps legacy parity: the pick waits for Apply
      // and the popover stays open; immediate mode commits and closes.
      commit(next.length > 0 ? [next[0]] : []);
      if (!isStaged) {
        handleOpenChange(false);
      }
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

  // Non-modal keeps the page interactive while a filter is open, but React
  // Aria then dismisses on neither outside interaction nor Escape — so
  // dismissal is owned here. Closing on pointerdown (not click) restores the
  // legacy one-click behaviour: pressing a sibling filter closes this one and
  // opens that one in the same gesture.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const closeOnOutsidePointerDown = (event: Event) => {
      const target = event.target as Node;
      if (
        triggerWrapRef.current?.contains(target) ||
        popoverContentRef.current?.contains(target)
      ) {
        return;
      }
      handleOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Consume the keystroke: this listener runs in the capture phase, and
        // letting it continue hands Escape to the host drawer/modal as well,
        // tearing down the surface the filter sits in.
        event.stopPropagation();
        event.preventDefault();
        handleOpenChange(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown, true);
    document.addEventListener('keydown', closeOnEscape, true);

    return () => {
      document.removeEventListener(
        'pointerdown',
        closeOnOutsidePointerDown,
        true
      );
      document.removeEventListener('keydown', closeOnEscape, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // React Aria yanks the option list back to the top when focus enters the
  // menu mid-press (it focuses the first item / restores a stale scroll
  // position), and menus commit selection on pointer *release* — so a click
  // on a scrolled-down row can land on whichever row slides under the cursor,
  // toggling the wrong option. Pin the scroll position for the duration of a
  // mouse/pen press on an option row. Touch is exempt so swipe-scrolling a
  // press started on a row keeps working.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let scroller: HTMLElement | null = null;
    let pinnedTop = 0;
    const holdScroll = (event: Event) => {
      if (
        scroller &&
        event.target === scroller &&
        scroller.scrollTop !== pinnedTop
      ) {
        scroller.scrollTop = pinnedTop;
      }
    };
    const releasePress = () => {
      scroller = null;
    };
    const pinOnRowPress = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        return;
      }
      const row = (event.target as HTMLElement).closest?.('[role^="menuitem"]');
      if (!row || !popoverContentRef.current?.contains(row)) {
        return;
      }
      scroller = row.closest('[role="menu"]');
      pinnedTop = scroller?.scrollTop ?? 0;
    };
    // The reset happens synchronously inside React Aria's focus handler, so
    // undo it in the same focusin dispatch (document bubble runs after the
    // React root's delegated handlers) — a later async 'scroll' correction
    // could lose the race against the pointerup hit-test.
    const holdScrollOnFocus = () => {
      if (scroller && scroller.scrollTop !== pinnedTop) {
        scroller.scrollTop = pinnedTop;
      }
    };
    document.addEventListener('pointerdown', pinOnRowPress, true);
    document.addEventListener('focusin', holdScrollOnFocus);
    document.addEventListener('scroll', holdScroll, true);
    document.addEventListener('pointerup', releasePress, true);
    document.addEventListener('pointercancel', releasePress, true);

    return () => {
      document.removeEventListener('pointerdown', pinOnRowPress, true);
      document.removeEventListener('focusin', holdScrollOnFocus);
      document.removeEventListener('scroll', holdScroll, true);
      document.removeEventListener('pointerup', releasePress, true);
      document.removeEventListener('pointercancel', releasePress, true);
    };
  }, [isOpen]);

  const showFooter = isStaged;
  // Immediate mode has nothing to apply, so it gets a quiet footer instead:
  // what is selected, and a way to drop it all without closing the menu.
  const showStatusFooter = isMulti && !isStaged;
  const showSelectAllRow =
    isMulti && Boolean(showSelectAll) && displayedOptions.length > 0;
  // The null row is a synthetic filter, not a search result: an unmatched
  // search shows the empty state even while "No <entity>" stays available
  // (legacy SearchDropdown stacked exactly these two).
  const isEmpty = !isLoading && displayedOptions.length === 0;
  const showMenu = !isLoading && (!isEmpty || Boolean(displayedNullOption));

  return (
    <Dropdown.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      <span className="tw:contents" ref={triggerWrapRef}>
        {isChips ? (
          <ChipsField
            chips={chips}
            className={className}
            fieldRef={chipsFieldRef}
            isOpen={isOpen}
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
            isOpen={isOpen}
            label={label}
            placeholder={placeholder}
            testId={testId}
            text={triggerText}
            variant={triggerVariant}
          />
        )}
      </span>
      <Dropdown.Popover
        // A filter popover is not a modal. React Aria's default blocks every
        // pointer event outside the overlay, so with one filter open the page
        // — including the trigger that opened it, and every sibling filter —
        // stops taking clicks until it is dismissed. The component this
        // replaces let those clicks through.
        isNonModal
        // Close without an exit animation: the closing subtree otherwise
        // stays visible (and hit-testable) for the animation's duration, so a
        // fast sibling swap can read or type into the dying filter instead of
        // the one just opened. animate-none makes react-aria unmount at once;
        // hidden covers the same frame.
        className={(state) =>
          cx(
            'tw:w-80',
            state.isExiting && 'tw:hidden tw:animate-none',
            popoverClassName
          )
        }
        data-testid="drop-down-menu"
        placement="bottom left"
        triggerRef={isChips ? chipsFieldRef : undefined}>
        <div className="tw:contents" ref={popoverContentRef}>
          {searchable && (
            <DropdownSearchField
              inputDataTestId="search-input"
              isDisabled={!isOpen}
              placeholder={t('label.search')}
              value={query}
              wrapperRef={searchWrapperRef}
              onChange={handleSearch}
            />
          )}

          {showSelectAllRow && (
            <div className="tw:px-4 tw:py-2">
              <Checkbox
                isIndeterminate={
                  displayedSelectedCount > 0 && !allDisplayedSelected
                }
                isSelected={allDisplayedSelected}
                label={
                  <span className="tw:text-sm tw:text-primary">
                    {t('label.select-all')}
                  </span>
                }
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

          {showMenu && (
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
              // Closing is owned by this component (immediate single-select
              // closes on commit; staged waits for Apply/Cancel), so the menu
              // must never close itself on selection.
              shouldCloseOnSelect={false}
              onSelectionChange={handleSelectionChange}>
              {displayedNullOption && (
                <OptionRow
                  isNullOption
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

          {isEmpty && (
            <div className="tw:px-4 tw:py-2 tw:text-center">
              <Typography
                className="not-prose"
                color="secondary"
                size="text-xs">
                {emptyState ?? t('label.no-data-found')}
              </Typography>
            </div>
          )}

          {helperText !== undefined && (
            <div className="tw:border-t tw:border-secondary tw:px-3 tw:py-2">
              <Typography className="tw:text-tertiary" size="text-xs">
                {helperText}
              </Typography>
            </div>
          )}

          {showFooter && (
            <DropdownStagedFooter
              count={staged.length}
              onApply={handleApply}
              onCancel={() => handleOpenChange(false)}
              onClear={() => setStaged([])}
            />
          )}

          {showStatusFooter && (
            <DropdownStatusFooter
              count={selectedValues.length}
              onClear={() => onChange([])}
            />
          )}
        </div>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const _FilterSelect = FilterSelect as typeof FilterSelect & {
  Tree: typeof TreeSelect;
};
_FilterSelect.Tree = TreeSelect;

export {
  DropdownSearchField,
  SearchInputIcon,
  TriggerCountBadge,
} from './filter-select.shared';
export { _FilterSelect as FilterSelect };
