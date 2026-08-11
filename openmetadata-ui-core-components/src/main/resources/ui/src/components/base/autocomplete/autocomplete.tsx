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
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { SearchLg } from '@untitledui/icons';
import type {
  FocusEventHandler,
  KeyboardEvent,
  PointerEventHandler,
  ReactNode,
  RefAttributes,
  RefObject,
} from 'react';
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
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
  ComboBox as AriaComboBox,
  Group as AriaGroup,
  Input as AriaInput,
  ListBox as AriaListBox,
  ComboBoxStateContext,
} from 'react-aria-components';
import type { ListData } from 'react-stately';
import { Avatar } from '../avatar/avatar';
import { Badge, BadgeWithButton } from '../badges/badges';
import { AutocompleteItem } from './autocomplete-item';

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
  multiple: boolean;
  visibleItemCount: number;
  triggerRef: RefObject<HTMLDivElement | null>;
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
  multiple: true,
  visibleItemCount: 0,
  triggerRef: { current: null },
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
  selectedItems: SelectItemType[] | ListData<SelectItemType>;
  icon?: IconComponentType | null;
  children: AriaListBoxProps<SelectItemType>['children'];
  onItemInserted?: (key: Key) => void;
  onItemCleared?: (key: Key) => void;
  onFocus?: FocusEventHandler;
  renderTag?: (item: SelectItemType, onRemove: () => void) => ReactNode;
  filterOption?: (item: SelectItemType, filterText: string) => boolean;
  onSearchChange?: (value: string) => void;
  maxVisibleItems?: number;
  multiple?: boolean;
  allowsCreation?: boolean;
  hideDropdown?: boolean;
}

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
  const focusManager = useFocusManager();
  const context = useContext(AutocompleteContext);
  const comboBoxStateContext = useContext(ComboBoxStateContext);

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

  const isSelectionEmpty = context?.selectedItems?.length === 0;
  const { maxVisibleItems, multiple } = context;
  const allSelected = context?.selectedItems ?? [];
  const visibleSelected =
    maxVisibleItems === undefined
      ? allSelected
      : allSelected.slice(0, maxVisibleItems);
  const overflowCount =
    maxVisibleItems === undefined
      ? 0
      : allSelected.length - visibleSelected.length;

  return (
    <div className="tw:relative tw:flex tw:w-full tw:flex-1 tw:flex-row tw:flex-wrap tw:items-center tw:justify-start tw:gap-1.5">
      {!isSelectionEmpty &&
        visibleSelected.map((item) =>
          context.renderTag ? (
            context.renderTag(item, () => context.onRemove(new Set([item.id])))
          ) : (
            <BadgeWithButton
              color="gray"
              isDisabled={isDisabled}
              key={item.id}
              size="lg"
              type="modern"
              onButtonClick={() => context.onRemove(new Set([item.id]))}
              onButtonKeyDown={(e) => handleTagKeyDown(e, item.id)}>
              {renderChipIcon(item)}
              <div className="tw:min-w-0 tw:max-w-40">
                <Typography ellipsis as="p" weight="medium">
                  {item.label}
                </Typography>
              </div>
            </BadgeWithButton>
          )
        )}

      {overflowCount > 0 && (
        <Badge color="gray" size="lg" type="modern">
          +{overflowCount}
        </Badge>
      )}

      <div
        className={cx(
          'tw:relative tw:flex tw:min-w-[20%] tw:flex-1 tw:flex-row tw:items-center',
          !isSelectionEmpty && 'tw:ml-0.5',
          !multiple && !isSelectionEmpty && 'tw:hidden'
        )}>
        <AriaInput
          className="tw:w-full tw:flex-[1_0_0] tw:appearance-none tw:bg-transparent tw:text-sm tw:text-ellipsis tw:text-primary tw:caret-alpha-black/90 tw:outline-hidden tw:placeholder:text-placeholder tw:focus:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-disabled tw:disabled:placeholder:text-disabled"
          placeholder={placeholder}
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
  icon: Icon = SearchLg,
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
  renderTag,
  filterOption,
  onFocus,
  multiple = true,
  onSearchChange,
  maxVisibleItems,
  allowsCreation = false,
  hideDropdown = false,
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

  const visibleItems = useMemo(() => {
    return allItems.filter((item) => {
      if (selectedKeys.includes(item.id)) {
        return false;
      }
      if (filterOption) {
        return filterOption(item, filterText);
      }

      return contains(item.label || item.supportingText || '', filterText);
    });
  }, [allItems, filterText, selectedKeys, filterOption, contains]);

  const itemMap = useMemo(
    () => new Map(allItems.map((item) => [item.id, item])),
    [allItems]
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
  const visibleChildren = useMemo(() => {
    if (typeof children === 'function') {
      return children;
    }

    return Children.toArray(children).filter((child) => {
      if (!isValidElement(child)) {
        return true;
      }
      const childId = (child.props as { id?: Key }).id;
      if (childId == null || !itemMap.has(childId as SelectItemType['id'])) {
        return true;
      }

      return visibleIds.has(String(childId));
    });
  }, [children, visibleIds, itemMap]);

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

  const onSelectionChange = (id: Key | null) => {
    if (!id) {
      return;
    }
    if (!multiple && internalSelected.length >= 1) {
      return;
    }
    const item = itemMap.get(id as string);
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
      multiple,
      visibleItemCount: visibleItems.length,
      triggerRef,
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
      multiple,
      visibleItems.length,
      triggerRef,
    ]
  );

  return (
    <SelectContext.Provider value={selectContextValue}>
      <AutocompleteContext.Provider value={autocompleteContextValue}>
        <AriaComboBox
          allowsEmptyCollection
          inputValue={filterText}
          items={visibleItems}
          menuTrigger="focus"
          selectedKey={null}
          onInputChange={onInputChange}
          onSelectionChange={onSelectionChange}
          {...props}>
          {(state) => (
            <div className="tw:flex tw:flex-col tw:gap-1.5">
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
                  className={popoverClassName}
                  size="md"
                  style={{ width: popoverWidth }}
                  triggerRef={triggerRef}>
                  <AriaListBox
                    className="tw:size-full tw:outline-hidden"
                    renderEmptyState={() => <SelectEmptyState />}
                    selectionMode="multiple">
                    {visibleChildren}
                  </AriaListBox>
                </Popover>
              )}

              {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
            </div>
          )}
        </AriaComboBox>
      </AutocompleteContext.Provider>
    </SelectContext.Provider>
  );
};

const Autocomplete = AutocompleteBase as typeof AutocompleteBase & {
  Item: typeof AutocompleteItem;
};

Autocomplete.Item = AutocompleteItem;

export { Autocomplete };
