import type { IconComponentType } from '@/components/base/badges/badge-types';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { Popover } from '@/components/base/select/popover';
import {
  type SelectItemType,
  SelectContext,
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
} from 'react';
import {
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
  renderTag?: (item: SelectItemType, onRemove: () => void) => ReactNode;
  maxVisibleItems?: number;
  multiple: boolean;
}

const AutocompleteContext = createContext<AutocompleteContextValue>({
  size: 'sm',
  selectedKeys: [],
  selectedItems: [],
  onRemove: () => {},
  onInputChange: () => {},
  maxVisibleItems: undefined,
  multiple: true,
});

interface AutocompleteTriggerProps extends AriaGroupProps {
  size: 'sm' | 'md';
  isDisabled?: boolean;
  placeholder?: string;
  placeholderIcon?: IconComponentType | null;
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
  placeholderIcon?: IconComponentType | null;
  children: AriaListBoxProps<SelectItemType>['children'];
  onItemInserted?: (key: Key) => void;
  onItemCleared?: (key: Key) => void;
  renderTag?: (item: SelectItemType, onRemove: () => void) => ReactNode;
  filterOption?: (item: SelectItemType, filterText: string) => boolean;
  onSearchChange?: (value: string) => void;
  maxVisibleItems?: number;
  multiple?: boolean;
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

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const isCaretAtStart =
      event.currentTarget.selectionStart === 0 &&
      event.currentTarget.selectionEnd === 0;

    if (!isCaretAtStart && event.currentTarget.value !== '') {
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
          className="tw:w-full tw:flex-[1_0_0] tw:appearance-none tw:bg-transparent tw:text-sm tw:text-ellipsis tw:text-primary tw:caret-alpha-black/90 tw:outline-none tw:placeholder:text-placeholder tw:focus:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-disabled tw:disabled:placeholder:text-disabled"
          placeholder={placeholder}
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
  placeholderIcon: Icon = SearchLg,
  isDisabled: _isDisabled,
  isInvalid,
  ...otherProps
}: AutocompleteTriggerProps) => {
  return (
    <AriaGroup
      {...otherProps}
      className={({ isFocusWithin, isDisabled }) =>
        cx(
          'tw:relative tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:outline-hidden tw:transition tw:duration-100 tw:ease-linear tw:ring-inset',
          isDisabled && 'tw:cursor-not-allowed tw:bg-disabled_subtle',
          isInvalid && 'tw:ring-error_subtle',
          isFocusWithin && 'tw:ring-2 tw:ring-brand',
          isFocusWithin && isInvalid && 'tw:ring-2 tw:ring-error',
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
  multiple = true,
  onSearchChange,
  maxVisibleItems,
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

  const triggerRef = useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = useState('');

  const onResize = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverWidth(rect.width + 'px');
  }, [triggerRef]);

  useResizeObserver({ ref: triggerRef, onResize, box: 'border-box' });

  const selectContextValue = useMemo(() => ({ size: 'sm' as const }), []);

  const autocompleteContextValue = useMemo(
    () => ({
      size: 'sm' as const,
      selectedKeys,
      selectedItems: internalSelected,
      onInputChange,
      onRemove,
      renderTag,
      maxVisibleItems,
      multiple,
    }),
    [
      selectedKeys,
      internalSelected,
      onInputChange,
      onRemove,
      renderTag,
      maxVisibleItems,
      multiple,
    ]
  );

  return (
    <SelectContext.Provider value={selectContextValue}>
      <AutocompleteContext.Provider value={autocompleteContextValue}>
        <AriaComboBox
          allowsEmptyCollection
          inputValue={filterText}
          items={visibleItems}
          menuTrigger="input"
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
                  isInvalid={isInvalid}
                  placeholder={placeholder}
                  placeholderIcon={props.placeholderIcon}
                  size="sm"
                  onFocus={onResize}
                  onPointerEnter={onResize}
                />
              </div>

              <Popover
                className={popoverClassName}
                size="md"
                style={{ width: popoverWidth }}
                triggerRef={triggerRef}>
                <AriaListBox
                  className="tw:size-full tw:outline-hidden"
                  selectionMode="multiple">
                  {children}
                </AriaListBox>
              </Popover>

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
