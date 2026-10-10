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
import { sizes } from '@/components/base/select/select';
import { Skeleton } from '@/components/base/skeleton/skeleton';
import { Dropdown } from '@/components/base/dropdown/dropdown';
import { Typography } from '@/components/foundations/typography';
import {
  DropdownSearchField,
  DropdownStagedFooter,
  DropdownStatusFooter,
  selectedTriggerClassName,
  TriggerCountBadge,
} from './filter-select.shared';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { borderAfter } from '@/utils/tailwindClasses';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  RefreshCw01,
  XClose,
} from '../../../icons';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from 'react';
import { Button as AriaButton, type Selection } from 'react-aria-components';
import type {
  FilterSelectOption,
  FilterSelectProps,
  FilterSelectTriggerVariant,
} from './filter-select.types';
import {
  DROPDOWN_CHROME_WIDTH,
  TreeSelect,
  useDropdownPlacement,
} from '../tree-select/tree-select';

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
  isDisabled,
  labelledBy,
  size = 'sm',
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
  isDisabled?: boolean;
  /** Id of an external label; the trigger's own text still names the value. */
  labelledBy?: string;
  size?: 'sm' | 'md';
}) => {
  const textId = useId();
  const ariaLabelledBy = labelledBy ? `${labelledBy} ${textId}` : undefined;
  const countBadge =
    count !== undefined && count > 0 ? (
      <TriggerCountBadge count={count} />
    ) : null;

  if (variant === 'button') {
    return (
      <Button
        aria-labelledby={ariaLabelledBy}
        className={cx(
          'tw:whitespace-nowrap',
          // The borderless trigger hugs its label like the legacy quick
          // filters (4px padding, 14px chevron), so a full toolbar of them
          // fits on one row beside same-sized toolbar controls.
          !bordered && 'tw:p-1 tw:*:data-icon:size-3.5',
          hasSelection && selectedTriggerClassName(bordered),
          className
        )}
        color={bordered ? 'secondary' : 'tertiary'}
        data-testid={testId}
        iconLeading={icon}
        iconTrailing={isOpen ? ChevronUp : ChevronDown}
        isDisabled={isDisabled}
        size={bordered ? 'md' : 'sm'}>
        <span data-testid={`search-dropdown-${label}`} id={textId}>
          {text}
        </span>
        {countBadge}
      </Button>
    );
  }

  if (variant === 'input') {
    return (
      <AriaButton
        aria-labelledby={ariaLabelledBy}
        className={cx(
          // Sized and outlined like the core Select, so it stands as tall as a
          // Select, Input or Button of the same size: an outline, unlike a
          // border, adds no height. Fills the width its container gives it
          // (constrain via className).
          'tw:flex tw:w-full tw:min-w-24 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:bg-surface tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-brand',
          sizes[size].root,
          isOpen && 'tw:outline-2 tw:-outline-offset-2 tw:outline-brand',
          isDisabled && 'tw:cursor-not-allowed tw:bg-disabled_subtle',
          className
        )}
        data-testid={testId}
        isDisabled={isDisabled}>
        <span
          className={cx(
            'tw:flex-1 tw:truncate tw:text-left tw:text-sm tw:font-medium',
            hasSelection ? 'tw:text-secondary' : 'tw:text-placeholder'
          )}
          data-testid={`search-dropdown-${label}`}
          id={textId}>
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
      aria-labelledby={ariaLabelledBy}
      className={cx(
        'tw:relative tw:inline-flex tw:h-max tw:cursor-pointer tw:items-center tw:gap-1 tw:whitespace-nowrap tw:rounded-lg tw:bg-surface tw:px-3.5 tw:py-2.5 tw:text-sm tw:font-medium tw:text-secondary tw:shadow-xs-skeuomorphic tw:outline-brand',
        borderAfter,
        'tw:after:outline-primary',
        className
      )}
      data-testid={testId}
      isDisabled={isDisabled}>
      <span data-testid={`search-dropdown-${label}`} id={textId}>
        {text}
      </span>
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
  showRadio,
  isNullOption,
  isExpanded,
  onToggleExpand,
}: {
  option: FilterSelectOption;
  hideCounts?: boolean;
  showCheckbox: boolean;
  showRadio?: boolean;
  /** The pinned "No <X>" row, which the design mutes relative to real options. */
  isNullOption?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: (expand?: boolean) => void;
}) => {
  const iconComponent = isReactComponent(option.icon)
    ? (option.icon as FC<{ className?: string }>)
    : undefined;
  const iconNode = iconComponent ? undefined : (option.icon as ReactNode);
  const hasIndicator = showCheckbox || Boolean(showRadio);
  const hasDetails = option.details !== undefined;

  // Pressing the chevron or the details must not select the row underneath.
  const stopRowPress = {
    onClick: (event: ReactMouseEvent) => event.stopPropagation(),
    onMouseDown: (event: ReactMouseEvent) => event.stopPropagation(),
    onMouseUp: (event: ReactMouseEvent) => event.stopPropagation(),
    onPointerDown: (event: ReactPointerEvent) => event.stopPropagation(),
    // A menu item also selects on pointer up (press-drag-release).
    onPointerUp: (event: ReactPointerEvent) => event.stopPropagation(),
  };

  return (
    <Dropdown.Item
      checkboxSize="xs"
      // A checkbox or radio alone conveys selection — suppress the selected
      // background, keeping the hover/focus tint. Plain single select keeps
      // Dropdown.Item's selected style, which matches the sidebar selected item.
      className={(state) =>
        cx(
          hasIndicator &&
            state.isSelected &&
            (state.isFocused
              ? 'tw:[&>div]:bg-primary_hover!'
              : 'tw:[&>div]:bg-transparent!'),
          !hasIndicator &&
            state.isSelected &&
            'tw:[&_svg]:text-fg-brand-secondary_alt!',
          // A multi-line row keeps its indicator on the first line.
          hasDetails && 'tw:[&>div]:items-start'
        )
      }
      data-testid={option.value}
      icon={iconComponent}
      id={option.value}
      showCheckbox={showCheckbox}
      showRadio={showRadio}
      textValue={optionText(option)}>
      {(state) => {
        const row = (
          <span
            className={cx(
              'tw:relative tw:flex tw:w-full tw:min-w-0 tw:items-center tw:justify-between tw:gap-2 tw:text-sm tw:font-normal',
              // Real options read at full strength whether or not they are
              // selected; only the pinned null row is muted. Plain single select
              // has no indicator, so its selected row goes brand instead.
              !hasIndicator && state.isSelected
                ? 'tw:text-brand-secondary'
                : isNullOption
                ? 'tw:text-secondary'
                : 'tw:text-primary'
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
                  !hasIndicator && state.isSelected
                    ? 'tw:border-utility-brand-200 tw:text-brand-secondary'
                    : 'tw:border-secondary',
                  hasIndicator && state.isSelected && 'tw:text-tertiary',
                  !state.isSelected && 'tw:text-placeholder'
                )}
                data-testid="filter-count"
                size="text-xs"
                weight="regular">
                {option.count.toLocaleString()}
              </Typography>
            )}
            {hasDetails && (
              <span
                aria-hidden="true"
                className="tw:flex tw:size-5 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded tw:text-fg-quaternary tw:hover:bg-tertiary"
                data-testid={`${option.value}-expand`}
                {...stopRowPress}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleExpand?.();
                }}>
                <ChevronRight
                  className={cx(
                    'tw:size-4 tw:transition-transform tw:duration-150',
                    isExpanded && 'tw:rotate-90'
                  )}
                />
              </span>
            )}
          </span>
        );

        return hasDetails ? (
          <span className="tw:flex tw:w-full tw:min-w-0 tw:flex-col">
            {row}
            {isExpanded && (
              <span
                className="tw:block tw:cursor-default tw:pt-1.5 tw:pr-7 tw:text-xs tw:text-secondary"
                data-testid={`${option.value}-details`}
                {...stopRowPress}>
                {option.details}
              </span>
            )}
          </span>
        ) : (
          row
        );
      }}
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
  isDisabled,
  isLoading,
  isOpen: controlledIsOpen,
  nullOption,
  placeholder,
  popoverClassName,
  popoverStyle,
  resolveMissingLabel,
  searchable,
  selectionMode = 'multiple',
  showRadio,
  showSelectAll,
  size = 'sm',
  trigger,
  triggerDisplay = 'count',
  triggerIcon,
  triggerVariant = 'chip',
  typography = 'medium',
  onOpenChange,
  onSearch,
  onLoadMore,
  isLoadingMore,
  'aria-labelledby': ariaLabelledBy,
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
  const hasAnyDetails = options.some((option) => option.details !== undefined);
  // Rows the user expanded or collapsed; any other row opens with its selection.
  const [toggledRows, setToggledRows] = useState<Map<string, boolean>>(
    () => new Map()
  );
  const isRadio = !isMulti && Boolean(showRadio);
  const isStaged = commitMode === 'staged';
  const isChips =
    isMulti && triggerVariant === 'input' && triggerDisplay === 'chips';
  const hasCustomTrigger = trigger !== undefined && trigger !== null;

  // What the popover hangs off; undefined leaves it on MenuTrigger's button.
  const anchorRef = isChips
    ? chipsFieldRef
    : hasCustomTrigger
    ? triggerWrapRef
    : undefined;
  // Placement measures that element. MenuTrigger's button sits in a
  // `display: contents` wrapper with no box of its own, so take the button.
  const placementRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    placementRef.current =
      anchorRef?.current ??
      (triggerWrapRef.current?.firstElementChild as HTMLElement | null);
  }, [isOpen, anchorRef]);
  // Left-aligned to the trigger, right-aligned when it would overflow the
  // viewport — the same rule as TreeSelect.
  const { placement } = useDropdownPlacement(
    placementRef,
    isOpen,
    DROPDOWN_CHROME_WIDTH
  );
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

  useEffect(() => {
    if (!isOpen) {
      setToggledRows(new Map());
    }
  }, [isOpen]);

  const isRowExpanded = (value: string, toggled = toggledRows) =>
    toggled.get(value) ?? selectedValues.includes(value);

  const toggleExpanded = (value: string, expand?: boolean) =>
    setToggledRows((prev) =>
      new Map(prev).set(value, expand ?? !isRowExpanded(value, prev))
    );

  // MenuItem takes no key handlers, so ArrowRight / ArrowLeft are read here
  // off whichever row holds focus.
  const handleDetailsKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const isExpandKey = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
    const row = (event.target as HTMLElement).closest?.('[role^="menuitem"]');
    // FilterSelect sets each row's test id to its option value.
    const value = row?.getAttribute('data-testid');
    const option = options.find((item) => item.value === value);
    if (isExpandKey && value && option?.details !== undefined) {
      toggleExpanded(value, event.key === 'ArrowRight');
    }
  };

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

  // Single select closes on any commit, a clear included.
  const handleClear = () => {
    onChange([]);
    if (!isMulti) {
      handleOpenChange(false);
    }
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
      const target = event.target as Element;
      // React Aria's MenuTrigger only ever *opens* on press start, so pressing
      // the trigger of an open filter must close it here — and the press must
      // not reach the trigger, or it reopens in the same gesture. Matched on
      // the trigger button (`aria-expanded`) so chip remove buttons inside the
      // chips field keep the popover open.
      const isTriggerPress = Boolean(
        triggerWrapRef.current?.contains(target.closest('[aria-expanded]'))
      );
      if (isTriggerPress) {
        event.stopPropagation();
      }
      if (
        !isTriggerPress &&
        (triggerWrapRef.current?.contains(target) ||
          popoverContentRef.current?.contains(target))
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

  // Scroll doesn't bubble, so the capture listener sees the menu's own scroll.
  const handleMenuScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const isNearEnd =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 40;
    if (target.getAttribute('role') === 'menu' && isNearEnd) {
      onLoadMore?.();
    }
  };

  const showFooter = isStaged;
  // Immediate mode has nothing to apply, so it gets a quiet footer instead:
  // what is selected, and a way to drop it all without closing the menu.
  const showStatusFooter = (isMulti || isRadio) && !isStaged;
  const showSelectAllRow =
    isMulti && Boolean(showSelectAll) && displayedOptions.length > 0;
  // The null row is a synthetic filter, not a search result: an unmatched
  // search shows the empty state even while "No <entity>" stays available
  // (legacy SearchDropdown stacked exactly these two).
  const isEmpty = !isLoading && displayedOptions.length === 0;
  const showMenu = !isLoading && (!isEmpty || Boolean(displayedNullOption));

  const content = (
    <>
      {hasCustomTrigger ? (
        <span
          className={cx('tw:inline-flex tw:max-w-full', className)}
          ref={triggerWrapRef}
          onClickCapture={() => handleOpenChange(!isOpen)}>
          {trigger}
        </span>
      ) : (
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
                onChange(
                  selectedValues.filter((selected) => selected !== value)
                )
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
              isDisabled={isDisabled}
              isOpen={isOpen}
              label={label}
              labelledBy={ariaLabelledBy}
              placeholder={placeholder}
              size={size}
              testId={testId}
              text={triggerText}
              variant={triggerVariant}
            />
          )}
        </span>
      )}
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
            // DROPDOWN_CHROME_WIDTH mirrors this width for placement.
            'tw:w-80',
            state.isExiting && 'tw:hidden tw:animate-none',
            popoverClassName
          )
        }
        data-testid="drop-down-menu"
        placement={placement}
        style={popoverStyle}
        // A custom trigger has no MenuTrigger around it, so the popover takes
        // its open state directly. React Aria's only close request here is
        // from `isNonModal`'s close-on-ancestor-scroll, which fires when a
        // page still settling scrolls just after opening. Dismissal is owned
        // above, so like TreeSelect only the open request is honoured.
        {...(hasCustomTrigger && {
          isOpen,
          onOpenChange: (open: boolean) => open && handleOpenChange(true),
        })}
        triggerRef={anchorRef}>
        <div
          className="tw:contents"
          ref={popoverContentRef}
          onKeyDownCapture={hasAnyDetails ? handleDetailsKeyDown : undefined}
          onScrollCapture={onLoadMore && handleMenuScroll}>
          {searchable && (
            <DropdownSearchField
              autoFocus={hasCustomTrigger}
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
              // A radio row cannot be unpicked by clicking it again.
              disallowEmptySelection={isRadio}
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
                  showRadio={isRadio}
                />
              )}
              {displayedOptions.map((option) => (
                <OptionRow
                  hideCounts={hideCounts}
                  isExpanded={isRowExpanded(option.value)}
                  key={option.value}
                  option={option}
                  showCheckbox={isMulti}
                  showRadio={isRadio}
                  onToggleExpand={(expand) =>
                    toggleExpanded(option.value, expand)
                  }
                />
              ))}
            </Dropdown.Menu>
          )}

          {isLoadingMore && (
            <div
              aria-label={t('label.loading')}
              className="tw:flex tw:justify-center tw:py-2"
              role="status">
              <RefreshCw01
                aria-hidden="true"
                className="tw:size-4 tw:animate-spin tw:text-fg-quaternary"
              />
            </div>
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
              clearLabel={isMulti ? undefined : t('label.clear')}
              count={selectedValues.length}
              onClear={handleClear}
            />
          )}
        </div>
      </Dropdown.Popover>
    </>
  );

  // A custom trigger stays outside MenuTrigger: its press responder would
  // otherwise bind to the first react-aria button inside the caller's trigger.
  return hasCustomTrigger ? (
    content
  ) : (
    <Dropdown.Root isOpen={isOpen} onOpenChange={handleOpenChange}>
      {content}
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
