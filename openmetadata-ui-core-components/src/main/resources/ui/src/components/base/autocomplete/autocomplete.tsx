import type { IconComponentType } from '@/components/base/badges/badge-types';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { Popover } from '@/components/base/select/popover';
import {
  type SelectItemType,
  SelectContext,
  SelectEmptyState,
  sizes,
} from '@/components/base/select/select';
import { Typography } from '@/components/foundations/typography';
import { useResizeObserver } from '@/hooks/use-resize-observer';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { Search } from '../../../icons';
import type {
  CSSProperties,
  FocusEventHandler,
  KeyboardEvent,
  PointerEventHandler,
  UIEvent,
  ReactNode,
  RefAttributes,
  RefObject,
  UIEventHandler,
} from 'react';
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FocusScope, useFilter, useFocusManager } from 'react-aria';
import type {
  ComboBoxProps as AriaComboBoxProps,
  GroupProps as AriaGroupProps,
  ListBoxProps as AriaListBoxProps,
  Key,
} from 'react-aria-components';
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Group as AriaGroup,
  Input as AriaInput,
  ListBox as AriaListBox,
  ComboBoxStateContext,
  ListLayout,
  Virtualizer,
} from 'react-aria-components';
import type { ListData } from 'react-stately';
import { Avatar } from '../avatar/avatar';
import { Badge, BadgeWithButton } from '../badges/badges';
import { Tooltip } from '../tooltip/tooltip';
import {
  AutocompleteCheckedKeysContext,
  AutocompleteItem,
} from './autocomplete-item';

interface AutocompleteContextValue {
  size: 'sm' | 'md';
  selectedKeys: Key[];
  selectedItems: SelectItemType[];
  onRemove: (keys: Set<Key>) => void;
  onInputChange: (value: string) => void;
  onCreateItem?: (value: string) => void;
  allowsCreation: boolean;
  hideDropdown: boolean;
  renderTag?: (item: SelectItemType, onRemove: () => void) => ReactNode;
  maxVisibleItems?: number;
  wrapsSelectedItems: boolean;
  isReadOnly: boolean;
  multiple: boolean;
  visibleItemCount: number;
  triggerRef: RefObject<HTMLDivElement | null>;
  onShowSelection: () => void;
}

const AutocompleteContext = createContext<AutocompleteContextValue>({
  size: 'sm',
  selectedKeys: [],
  selectedItems: [],
  onRemove: () => {},
  onInputChange: () => {},
  onCreateItem: undefined,
  allowsCreation: false,
  hideDropdown: false,
  maxVisibleItems: undefined,
  wrapsSelectedItems: true,
  isReadOnly: false,
  multiple: true,
  visibleItemCount: 0,
  triggerRef: { current: null },
  onShowSelection: () => {},
});

interface AutocompleteTriggerProps extends AriaGroupProps {
  size: 'sm' | 'md';
  isDisabled?: boolean;
  placeholder?: string;
  icon?: IconComponentType | null;
  onFocus?: FocusEventHandler;
  onPointerEnter?: PointerEventHandler;
}

export interface AutocompleteProps
  extends Omit<AriaComboBoxProps<SelectItemType>, 'children' | 'items'>,
    RefAttributes<HTMLDivElement> {
  hint?: string;
  label?: string;
  tooltip?: string;
  placeholder?: string;
  items?: SelectItemType[];
  popoverClassName?: string;
  /** Fires when the dropdown list scrolls — use it to page in more async results. */
  onPopoverScroll?: UIEventHandler<HTMLElement>;
  /** Pinned above the dropdown list (e.g. a result count); the list scrolls beneath it. */
  popoverHeader?: ReactNode;
  /** Pinned below the dropdown list (e.g. keyboard hints). */
  popoverFooter?: ReactNode;
  /** Shown when the list is empty, in place of the default "no data" state (e.g. while loading). */
  emptyState?: ReactNode;
  selectedItems: SelectItemType[] | ListData<SelectItemType>;
  icon?: IconComponentType | null;
  children: AriaListBoxProps<SelectItemType>['children'];
  onItemInserted?: (key: Key) => void;
  onItemCleared?: (key: Key) => void;
  onFocus?: FocusEventHandler;
  renderTag?: (item: SelectItemType, onRemove: () => void) => ReactNode;
  filterOption?: (item: SelectItemType, filterText: string) => boolean;
  onSearchChange?: (value: string) => void;
  /** Chips drawn before the rest collapse into a +N button that opens the list with them checked. */
  maxVisibleItems?: number;
  /**
   * Wrap the chips onto more lines. Defaults to true without `maxVisibleItems`;
   * a capped field stays on one line, so set this when the cap is large.
   */
  wrapSelectedItems?: boolean;
  multiple?: boolean;
  allowsCreation?: boolean;
  hideDropdown?: boolean;
}

const CHIP_MIN_VISIBLE_CHARS = 5;
// Rem left of the chips' share: +N (2.5) plus the gaps beside it and the input (0.75).
const CHIP_ROW_RESERVED_REM = 3.25;
const CHIP_GAP_REM = 0.375;

// In a one-line (capped) field the chips shrink to fit, and without a floor the
// shortest label shrank first, down to one letter. Each chip keeps about four
// letters (all of a short label), but never more than its share of the row,
// so a narrow field still fits. The rem is the badge's own padding, gap and
// remove button, plus the leading icon if any.
const chipMinWidth = (item: SelectItemType) => {
  const chars = Math.min((item.label ?? '').length, CHIP_MIN_VISIBLE_CHARS);
  const chromeRem = item.avatarUrl || item.icon ? 3.25 : 2.125;

  return `min(calc(${chars}ch + ${chromeRem}rem), var(--autocomplete-chip-share))`;
};

// The input keeps 20% of the row; the chips split what +N and the gaps leave.
const chipShare = (chipCount: number) =>
  `calc((80% - ${
    CHIP_ROW_RESERVED_REM + chipCount * CHIP_GAP_REM
  }rem) / ${chipCount})`;

const renderChipIcon = (item: SelectItemType) => {
  if (item.avatarUrl) {
    return <Avatar alt={item.label} size="xs" src={item.avatarUrl} />;
  }
  const Icon = item.icon;
  if (isReactComponent(Icon)) {
    return (
      <Icon
        aria-hidden="true"
        className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
      />
    );
  }
  if (isValidElement(Icon)) {
    return Icon;
  }

  return null;
};

const InnerAutocomplete = ({
  isDisabled,
  placeholder,
}: {
  isDisabled?: boolean;
  placeholder?: string;
}) => {
  const { t } = useCoreTranslation();
  const focusManager = useFocusManager();
  const context = useContext(AutocompleteContext);
  const comboBoxStateContext = useContext(ComboBoxStateContext);
  const inputRef = useRef<HTMLInputElement>(null);

  const canCreateItem =
    context.allowsCreation &&
    (context.hideDropdown || context.visibleItemCount === 0);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const inputValue = event.currentTarget.value;
    const isCaretAtStart =
      event.currentTarget.selectionStart === 0 &&
      event.currentTarget.selectionEnd === 0;

    if (event.key === 'Enter' && canCreateItem && inputValue.trim() !== '') {
      event.preventDefault();
      context.onCreateItem?.(inputValue.trim());

      return;
    }

    if (!isCaretAtStart && inputValue !== '') {
      return;
    }

    switch (event.key) {
      case 'Backspace':
      case 'ArrowLeft':
        focusManager?.focusPrevious({ wrap: false, tabbable: false });

        break;
      case 'ArrowRight':
        focusManager?.focusNext({ wrap: false, tabbable: false });

        break;
      case 'ArrowDown':
        if (comboBoxStateContext && !comboBoxStateContext.isOpen) {
          comboBoxStateContext.open();
        }

        break;
    }
  };

  const handleInputMouseDown = (_event: React.MouseEvent<HTMLInputElement>) => {
    if (comboBoxStateContext && !comboBoxStateContext.isOpen) {
      comboBoxStateContext.open();
    }
  };

  const handleTagKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    value: Key
  ) => {
    if (event.key === 'Tab') {
      return;
    }

    event.preventDefault();

    const isFirstTag = context?.selectedItems?.[0]?.id === value;

    switch (event.key) {
      case ' ':
      case 'Enter':
      case 'Backspace':
        if (isFirstTag) {
          focusManager?.focusNext({ wrap: false, tabbable: false });
        } else {
          focusManager?.focusPrevious({ wrap: false, tabbable: false });
        }
        context.onRemove(new Set([value]));

        break;
      case 'ArrowLeft':
        focusManager?.focusPrevious({ wrap: false, tabbable: false });

        break;
      case 'ArrowRight':
        focusManager?.focusNext({ wrap: false, tabbable: false });

        break;
      case 'Escape':
        comboBoxStateContext?.close();

        break;
    }
  };

  // +N sits between the chips and the input, so it passes the same
  // Backspace/arrow walk along instead of ending it.
  const handleOverflowKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Backspace' || event.key === 'ArrowLeft') {
      focusManager?.focusPrevious({ wrap: false, tabbable: false });
    } else if (event.key === 'ArrowRight') {
      focusManager?.focusNext({ wrap: false, tabbable: false });
    }
  };

  const isSelectionEmpty = context?.selectedItems?.length === 0;
  const { maxVisibleItems, multiple } = context;
  const allSelected = context?.selectedItems ?? [];
  const visibleSelected =
    maxVisibleItems === undefined
      ? allSelected
      : allSelected.slice(0, maxVisibleItems);
  const overflowCount = allSelected.length - visibleSelected.length;

  const renderChip = (item: SelectItemType) =>
    context.renderTag ? (
      context.renderTag(item, () => context.onRemove(new Set([item.id])))
    ) : (
      <BadgeWithButton
        // Capped at the field width so a long label ends in an ellipsis.
        buttonLabel={t('label.remove-entity', { entity: item.label })}
        className="tw:max-w-full"
        color="gray"
        data-testid="autocomplete-selected-item"
        isDisabled={isDisabled}
        key={item.id}
        size="lg"
        style={
          context.wrapsSelectedItems
            ? undefined
            : { minWidth: chipMinWidth(item) }
        }
        type="modern"
        onButtonClick={() => context.onRemove(new Set([item.id]))}
        onButtonKeyDown={(e) => handleTagKeyDown(e, item.id)}>
        {renderChipIcon(item)}
        {/* Not the badge's own `tooltip`: that wraps the label in a w-max
            button, which stops the truncation and joins the ComboBox's ButtonContext. */}
        <Tooltip
          excludeTriggerFromTabOrder
          title={item.label}
          triggerClassName="tw:block tw:min-w-0 tw:max-w-40">
          <Typography ellipsis as="p" weight="medium">
            {item.label}
          </Typography>
        </Tooltip>
      </BadgeWithButton>
    );

  return (
    <div
      className={cx(
        'tw:relative tw:flex tw:w-full tw:min-w-0 tw:flex-1 tw:flex-row tw:items-center tw:justify-start tw:gap-1.5',
        // A capped field stays one line: chips truncate, +N holds the rest.
        context.wrapsSelectedItems ? 'tw:flex-wrap' : 'tw:flex-nowrap'
      )}
      style={
        context.wrapsSelectedItems || visibleSelected.length === 0
          ? undefined
          : ({
              '--autocomplete-chip-share': chipShare(visibleSelected.length),
            } as CSSProperties)
      }>
      {!isSelectionEmpty && visibleSelected.map((item) => renderChip(item))}

      {overflowCount > 0 && (
        // Opens the list in its checkbox view: selected values stay as checked rows.
        <AriaButton
          preventFocusOnPress
          aria-label={t('label.show-count-more', { count: overflowCount })}
          className="tw:shrink-0 tw:cursor-pointer tw:rounded-md tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2"
          data-testid="autocomplete-overflow-trigger"
          // slot={null} also drops the ComboBox's disabled state, so pass it here.
          isDisabled={isDisabled || context.isReadOnly}
          // Opt out of the ComboBox's ButtonContext so this is not the menu trigger.
          slot={null}
          onKeyDown={handleOverflowKeyDown}
          onPress={() => {
            context.onShowSelection();
            inputRef.current?.focus();
            comboBoxStateContext?.open();
          }}>
          <Badge color="gray" size="lg" type="modern">
            +{overflowCount}
          </Badge>
        </AriaButton>
      )}

      <div
        className={cx(
          'tw:relative tw:flex tw:min-w-[20%] tw:flex-1 tw:flex-row tw:items-center',
          !isSelectionEmpty && 'tw:ml-0.5',
          !multiple && !isSelectionEmpty && 'tw:hidden'
        )}>
        <AriaInput
          className="tw:w-full tw:flex-[1_0_0] tw:appearance-none tw:bg-transparent tw:text-sm tw:text-ellipsis tw:text-primary tw:caret-text-primary tw:outline-hidden tw:placeholder:text-placeholder tw:focus:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-disabled tw:disabled:placeholder:text-disabled"
          placeholder={placeholder}
          ref={inputRef}
          onBlur={(event) => {
            const inputValue = event.target.value.trim();
            const isMovingInsideWidget = context.triggerRef?.current?.contains(
              event.relatedTarget
            );
            if (!isMovingInsideWidget && canCreateItem && inputValue !== '') {
              context.onCreateItem?.(inputValue);
            }
          }}
          onKeyDown={handleInputKeyDown}
          onMouseDown={handleInputMouseDown}
        />
      </div>
    </div>
  );
};

const AutocompleteTrigger = ({
  size,
  placeholder,
  icon: Icon = Search,
  isDisabled: _isDisabled,
  isInvalid,
  ...otherProps
}: AutocompleteTriggerProps) => {
  return (
    <AriaGroup
      {...otherProps}
      className={({ isFocusWithin, isDisabled }) =>
        cx(
          // Border drawn with outline, not a ring (WebKit does not pixel-snap box-shadow,
          // so rings thin/vanish in Safari when zoomed out). `outline-hidden` is gone — the
          // outline IS the border and focus indicator, as in input.tsx.
          'tw:relative tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:transition tw:duration-100 tw:ease-linear',
          isDisabled && 'tw:cursor-not-allowed tw:bg-disabled_subtle',
          isInvalid && 'tw:outline-error_subtle',
          isFocusWithin && 'tw:outline-2 tw:-outline-offset-2 tw:outline-brand',
          isFocusWithin &&
            isInvalid &&
            'tw:outline-2 tw:-outline-offset-2 tw:outline-error',
          sizes[size].root
        )
      }
      isInvalid={isInvalid}>
      {({ isDisabled }) => (
        <>
          {Icon && (
            <Icon className="tw:pointer-events-none tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
          )}
          <FocusScope autoFocus={false} contain={false} restoreFocus={false}>
            <InnerAutocomplete
              isDisabled={isDisabled}
              placeholder={placeholder}
            />
          </FocusScope>
        </>
      )}
    </AriaGroup>
  );
};

/**
 * Option count above which the listbox renders only the rows in view. Small
 * lists keep plain DOM rows so their height and styling stay as they are.
 */
const AUTOCOMPLETE_VIRTUALIZATION_THRESHOLD = 200;

// Estimate only: ListLayout measures each row, so wrapped labels and
// supporting text still get their real height.
const VIRTUALIZED_LAYOUT_OPTIONS = { estimatedRowHeight: 40 };

const resolveSelectedItems = (
  value: SelectItemType[] | ListData<SelectItemType>
): SelectItemType[] => (Array.isArray(value) ? value : value.items);

export const AutocompleteBase = ({
  items,
  children,
  label,
  tooltip,
  hint,
  isInvalid,
  selectedItems,
  onItemCleared,
  onItemInserted,
  placeholder = 'Search',
  popoverClassName,
  onPopoverScroll,
  popoverHeader,
  popoverFooter,
  emptyState,
  renderTag,
  filterOption,
  onFocus,
  multiple = true,
  onSearchChange,
  maxVisibleItems,
  wrapSelectedItems = maxVisibleItems === undefined,
  allowsCreation = false,
  hideDropdown = false,
  onOpenChange,
  name: _name,
  className: _className,
  ...props
}: AutocompleteProps) => {
  const { contains } = useFilter({ sensitivity: 'base' });

  const [internalSelected, setInternalSelected] = useState<SelectItemType[]>(
    resolveSelectedItems(selectedItems)
  );
  const selectedKeys = internalSelected.map((item) => item.id);

  useEffect(() => {
    setInternalSelected(resolveSelectedItems(selectedItems));
  }, [selectedItems]);

  const [allItems, setAllItems] = useState<SelectItemType[]>(items ?? []);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    setAllItems(items ?? []);
  }, [items]);

  // Opened from +N, the list switches to a checkbox view that keeps selected
  // values as checked rows; it reverts when the list closes.
  // ADR:2026-10-21-capped-autocomplete-stays-on-one-line
  // It keeps the selection it opened with, so an unchecked value that is not
  // in the loaded items stays listed and can be checked again.
  const [openedSelection, setOpenedSelection] = useState<SelectItemType[]>([]);
  const [isSelectionView, setIsSelectionView] = useState(false);
  const listsSelection = multiple && isSelectionView;
  const onShowSelection = useCallback(() => {
    setOpenedSelection(internalSelected);
    setIsSelectionView(true);
  }, [internalSelected]);
  const handleOpenChange = (
    isOpen: boolean,
    trigger?: Parameters<NonNullable<typeof onOpenChange>>[1]
  ) => {
    if (!isOpen) {
      setIsSelectionView(false);
    }
    onOpenChange?.(isOpen, trigger);
  };

  const itemMap = useMemo(
    () => new Map(allItems.map((item) => [item.id, item])),
    [allItems]
  );

  // The saved selection matching the search. Matched locally, not through
  // `filterOption`: async callers pass one that accepts everything.
  const matchingOpenedSelection = useMemo(
    () =>
      listsSelection
        ? openedSelection.filter((item) =>
            contains(item.label || item.supportingText || '', filterText)
          )
        : [],
    [listsSelection, openedSelection, filterText, contains]
  );

  // Selections outside the loaded (e.g. async) items, listed first in the view.
  const unloadedSelection = useMemo(
    () => matchingOpenedSelection.filter((item) => !itemMap.has(item.id)),
    [matchingOpenedSelection, itemMap]
  );

  const visibleItems = useMemo(() => {
    const matches = allItems.filter((item) => {
      if (!listsSelection && selectedKeys.includes(item.id)) {
        return false;
      }
      if (filterOption) {
        return filterOption(item, filterText);
      }

      return contains(item.label || item.supportingText || '', filterText);
    });

    return [...unloadedSelection, ...matches];
  }, [
    allItems,
    filterText,
    selectedKeys,
    filterOption,
    contains,
    listsSelection,
    unloadedSelection,
  ]);

  const checkedKeys = useMemo(
    () => (listsSelection ? new Set<Key>(selectedKeys) : null),
    [listsSelection, selectedKeys]
  );

  // The ListBox renders the caller's static children. Filter them by the
  // computed `visibleItems` so the default `contains` filter actually narrows
  // the list as the user types. Async callers neutralize this by passing
  // `filterOption={() => true}` (visibleItems === allItems), and any non-item
  // child (create/footer rows, whose id isn't in the collection) is preserved.
  const visibleIds = useMemo(
    () => new Set(visibleItems.map((item) => String(item.id))),
    [visibleItems]
  );
  // Static children render only the caller's items, so a selection they lack
  // (an async miss, or a value created in this session) needs its own row.
  const unrenderedSelection = useMemo(() => {
    if (typeof children === 'function') {
      return [];
    }
    const renderedIds = new Set(
      Children.toArray(children)
        .filter(isValidElement)
        .map((child) => String((child.props as { id?: Key }).id))
    );

    return matchingOpenedSelection.filter(
      (item) => !renderedIds.has(String(item.id))
    );
  }, [children, matchingOpenedSelection]);

  const visibleChildren = useMemo(() => {
    if (typeof children === 'function') {
      return children;
    }

    const filtered = Children.toArray(children).filter((child) => {
      if (!isValidElement(child)) {
        return true;
      }
      const childId = (child.props as { id?: Key }).id;
      if (childId == null || !itemMap.has(childId as SelectItemType['id'])) {
        return true;
      }

      return visibleIds.has(String(childId));
    });
    const unloadedRows = unrenderedSelection.map((item) => (
      <AutocompleteItem
        avatarUrl={item.avatarUrl}
        icon={item.icon}
        id={String(item.id)}
        key={item.id}
        label={item.label}
        supportingText={item.supportingText}
      />
    ));

    return [...unloadedRows, ...filtered];
  }, [children, visibleIds, itemMap, unrenderedSelection]);

  const onRemove = useCallback(
    (keys: Set<Key>) => {
      const key = keys.values().next().value;
      if (!key) {
        return;
      }
      setInternalSelected((prev) => prev.filter((item) => item.id !== key));
      onItemCleared?.(key);
      setFilterText('');
    },
    [onItemCleared]
  );

  // react-aria commits the focused option on blur/Tab, and the listbox focuses
  // whatever the pointer last passed over — so leaving the field inserted an
  // option the user never picked. Only a press or Enter adds a value.
  const isLeavingRef = useRef(false);
  const suppressCommit = useCallback(() => {
    isLeavingRef.current = true;
    queueMicrotask(() => {
      isLeavingRef.current = false;
    });
  }, []);
  const onKeyDownCapture = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        suppressCommit();
      }
    },
    [suppressCommit]
  );

  const onSelectionChange = (id: Key | null) => {
    if (!id) {
      return;
    }
    if (multiple && isLeavingRef.current) {
      return;
    }
    if (listsSelection && selectedKeys.includes(id as string)) {
      onRemove(new Set([id]));

      return;
    }
    if (!multiple && internalSelected.length >= 1) {
      return;
    }
    const item =
      itemMap.get(id as string) ??
      unloadedSelection.find((selected) => selected.id === id);
    if (!item) {
      return;
    }
    if (!selectedKeys.includes(id as string)) {
      setInternalSelected((prev) => [...prev, item]);
      onItemInserted?.(id);
    }
    setFilterText('');
  };

  const onInputChange = useCallback(
    (value: string) => {
      setFilterText(value);
      onSearchChange?.(value);
    },
    [onSearchChange]
  );

  const onCreateItem = useCallback(
    (value: string) => {
      const newItem: SelectItemType = { id: value, label: value };
      setAllItems((prev) =>
        prev.some((item) => item.id === value) ? prev : [...prev, newItem]
      );
      const alreadySelected = internalSelected.some(
        (item) => item.id === value
      );
      if (!multiple) {
        setInternalSelected([newItem]);
        if (!alreadySelected) {
          onItemInserted?.(value);
        }
      } else if (!alreadySelected) {
        setInternalSelected((prev) => [...prev, newItem]);
        onItemInserted?.(value);
      }
      setFilterText('');
    },
    [onItemInserted, multiple, internalSelected]
  );

  const triggerRef = useRef<HTMLDivElement>(null);

  // Decided on the full list, not the filtered one, so typing never swaps
  // the listbox between plain and virtualized rendering.
  const isVirtualized = allItems.length > AUTOCOMPLETE_VIRTUALIZATION_THRESHOLD;

  // Crossing the threshold moves scrolling from the popover to the listbox.
  // React's onScroll does not bubble, so the handler follows the scroller, and
  // the offset is carried over so the newly loaded page stays in view instead
  // of the list jumping back to the top.
  const listBoxRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  const handleScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      scrollTopRef.current = event.currentTarget.scrollTop;
      onPopoverScroll?.(event);
    },
    [onPopoverScroll]
  );

  useLayoutEffect(() => {
    if (isVirtualized && listBoxRef.current) {
      listBoxRef.current.scrollTop = scrollTopRef.current;
    }
  }, [isVirtualized]);

  const listBox = (
    <AriaListBox
      className={cx(
        'tw:size-full tw:outline-hidden',
        isVirtualized && 'tw:max-h-80 tw:overflow-y-auto tw:py-1'
      )}
      ref={listBoxRef}
      renderEmptyState={() => emptyState ?? <SelectEmptyState />}
      selectionMode="multiple"
      onScroll={isVirtualized ? handleScroll : undefined}>
      {visibleChildren}
    </AriaListBox>
  );

  const dropdownList = isVirtualized ? (
    <Virtualizer layout={ListLayout} layoutOptions={VIRTUALIZED_LAYOUT_OPTIONS}>
      {listBox}
    </Virtualizer>
  ) : (
    listBox
  );
  const hasPopoverChrome = Boolean(popoverHeader || popoverFooter);

  // Match the popover width to the trigger. The base Popover relies on
  // `--trigger-width`, but react-aria only sets that on a trigger's own context
  // popover — a standalone `<Popover triggerRef>` (as used here) never receives
  // it, so the dropdown would otherwise collapse to its content width. Measure
  // the trigger and set the width explicitly (same approach as MultiSelect).
  const [popoverWidth, setPopoverWidth] = useState('');

  const onResize = useCallback(() => {
    if (triggerRef.current) {
      setPopoverWidth(triggerRef.current.getBoundingClientRect().width + 'px');
    }
  }, [triggerRef]);

  useResizeObserver({ ref: triggerRef, onResize, box: 'border-box' });

  const selectContextValue = useMemo(
    () => ({ size: 'sm' as const, fontSize: 'sm' as const }),
    []
  );

  const autocompleteContextValue = useMemo(
    () => ({
      size: 'sm' as const,
      selectedKeys,
      selectedItems: internalSelected,
      onInputChange,
      onRemove,
      onCreateItem,
      allowsCreation,
      hideDropdown,
      renderTag,
      maxVisibleItems,
      wrapsSelectedItems: wrapSelectedItems,
      isReadOnly: Boolean(props.isReadOnly),
      multiple,
      visibleItemCount: visibleItems.length,
      triggerRef,
      onShowSelection,
    }),
    [
      selectedKeys,
      internalSelected,
      onInputChange,
      onRemove,
      onCreateItem,
      allowsCreation,
      hideDropdown,
      renderTag,
      maxVisibleItems,
      wrapSelectedItems,
      props.isReadOnly,
      multiple,
      visibleItems.length,
      triggerRef,
      onShowSelection,
    ]
  );

  return (
    <SelectContext.Provider value={selectContextValue}>
      <AutocompleteCheckedKeysContext.Provider value={checkedKeys}>
        <AutocompleteContext.Provider value={autocompleteContextValue}>
          <AriaComboBox
            allowsEmptyCollection
            inputValue={filterText}
            items={visibleItems}
            menuTrigger="focus"
            selectedKey={null}
            onInputChange={onInputChange}
            onOpenChange={handleOpenChange}
            onSelectionChange={onSelectionChange}
            {...props}>
            {(state) => (
              <div
                className="tw:flex tw:flex-col tw:gap-1.5"
                onBlurCapture={suppressCommit}
                onKeyDownCapture={onKeyDownCapture}>
                {label && (
                  <Label isRequired={state.isRequired} tooltip={tooltip}>
                    {label}
                  </Label>
                )}

                <div className="tw:relative tw:w-full" ref={triggerRef}>
                  <AutocompleteTrigger
                    icon={props.icon}
                    isInvalid={isInvalid}
                    placeholder={placeholder}
                    size="sm"
                    onFocus={(event) => {
                      onResize();
                      onFocus?.(event);
                    }}
                    onPointerEnter={onResize}
                  />
                </div>

                {!hideDropdown && (
                  <Popover
                    className={cx(
                      // A virtualized listbox is its own bounded scroller.
                      isVirtualized && 'tw:overflow-hidden tw:py-0',
                      // Header/footer stay put; the list gets its own scroller.
                      hasPopoverChrome &&
                        'tw:flex tw:flex-col tw:overflow-hidden tw:py-0',
                      popoverClassName
                    )}
                    size="md"
                    style={{ width: popoverWidth }}
                    triggerRef={triggerRef}
                    onScroll={
                      isVirtualized || hasPopoverChrome
                        ? undefined
                        : handleScroll
                    }>
                    {hasPopoverChrome ? (
                      <>
                        {popoverHeader}
                        <div
                          className={cx(
                            'tw:min-h-0 tw:flex-1',
                            !isVirtualized && 'tw:overflow-y-auto tw:py-1'
                          )}
                          onScroll={isVirtualized ? undefined : handleScroll}>
                          {dropdownList}
                        </div>
                        {popoverFooter}
                      </>
                    ) : (
                      dropdownList
                    )}
                  </Popover>
                )}

                {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
              </div>
            )}
          </AriaComboBox>
        </AutocompleteContext.Provider>
      </AutocompleteCheckedKeysContext.Provider>
    </SelectContext.Provider>
  );
};

const Autocomplete = AutocompleteBase as typeof AutocompleteBase & {
  Item: typeof AutocompleteItem;
};

Autocomplete.Item = AutocompleteItem;

export { Autocomplete };
