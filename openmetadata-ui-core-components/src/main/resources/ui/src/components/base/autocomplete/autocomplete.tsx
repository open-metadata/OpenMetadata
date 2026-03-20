import type { IconComponentType } from '@/components/base/badges/badge-types';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { Popover } from '@/components/base/select/popover';
import { type SelectItemType, SelectContext, sizes } from '@/components/base/select/select';
import { useResizeObserver } from '@/hooks/use-resize-observer';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { SearchLg } from '@untitledui/icons';
import type { FocusEventHandler, KeyboardEvent, PointerEventHandler, ReactNode, RefAttributes } from 'react';
import { createContext, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { CloseButton } from '../buttons/close-button';
import { AutocompleteItem } from './autocomplete-item';

interface AutocompleteContextValue {
  size: 'sm' | 'md';
  selectedKeys: Key[];
  selectedItems: SelectItemType[];
  onRemove: (keys: Set<Key>) => void;
  onInputChange: (value: string) => void;
  renderTag?: (item: SelectItemType, onRemove: () => void) => ReactNode;
}

const AutocompleteContext = createContext<AutocompleteContextValue>({
  size: 'sm',
  selectedKeys: [],
  selectedItems: [],
  onRemove: () => {},
  onInputChange: () => {},
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
  extends Omit<AriaComboBoxProps<SelectItemType>, 'children' | 'items'>, RefAttributes<HTMLDivElement> {
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
}

const renderChipIcon = (item: SelectItemType) => {
  if (item.avatarUrl) {
    return <Avatar size="xs" src={item.avatarUrl} alt={item.label} />;
  }
  const Icon = item.icon;
  if (isReactComponent(Icon)) {
    return <Icon className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary" aria-hidden="true" />;
  }
  if (isValidElement(Icon)) {
    return Icon;
  }
  return null;
};

const InnerAutocomplete = ({ isDisabled, placeholder }: { isDisabled?: boolean; placeholder?: string }) => {
  const focusManager = useFocusManager();
  const context = useContext(AutocompleteContext);
  const comboBoxStateContext = useContext(ComboBoxStateContext);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const isCaretAtStart = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0;

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
    }
  };

  const handleInputMouseDown = (_event: React.MouseEvent<HTMLInputElement>) => {
    if (comboBoxStateContext && !comboBoxStateContext.isOpen) {
      comboBoxStateContext.open();
    }
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLButtonElement>, value: Key) => {
    if (event.key === 'Tab') return;

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

  return (
    <div className="tw:relative tw:flex tw:w-full tw:flex-1 tw:flex-row tw:flex-wrap tw:items-center tw:justify-start tw:gap-1.5">
      {!isSelectionEmpty &&
        context?.selectedItems?.map((item) =>
          context.renderTag ? (
            context.renderTag(item, () => context.onRemove(new Set([item.id])))
          ) : (
            <span
              key={item.id}
              className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-md tw:bg-primary tw:py-1.5 tw:px-2.5 tw:ring-1 tw:ring-primary tw:ring-inset"
            >
              {renderChipIcon(item)}
              <p className="tw:truncate tw:text-sm tw:font-medium tw:whitespace-nowrap tw:text-secondary tw:select-none">
                {item.label}
              </p>

              <CloseButton
                size="sm"
                isDisabled={isDisabled}
                className="tw:ml-0.75 tw:h-auto tw:w-auto tw:p-0"
                onKeyDown={(event) => handleTagKeyDown(event, item.id)}
                onPress={() => context.onRemove(new Set([item.id]))}
              />
            </span>
          ),
        )}

      <div
        className={cx(
          'tw:relative tw:flex tw:min-w-[20%] tw:flex-1 tw:flex-row tw:items-center',
          !isSelectionEmpty && 'tw:ml-0.5',
        )}
      >
        <AriaInput
          placeholder={placeholder}
          onKeyDown={handleInputKeyDown}
          onMouseDown={handleInputMouseDown}
          className="tw:w-full tw:flex-[1_0_0] tw:appearance-none tw:bg-transparent tw:text-md tw:text-ellipsis tw:text-primary tw:caret-alpha-black/90 tw:outline-none tw:placeholder:text-placeholder tw:focus:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-disabled tw:disabled:placeholder:text-disabled"
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
  ...otherProps
}: AutocompleteTriggerProps) => {
  return (
    <AriaGroup
      {...otherProps}
      className={({ isFocusWithin, isDisabled }) =>
        cx(
          'tw:relative tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:outline-hidden tw:transition tw:duration-100 tw:ease-linear tw:ring-inset',
          isDisabled && 'tw:cursor-not-allowed tw:bg-disabled_subtle',
          isFocusWithin && 'tw:ring-2 tw:ring-brand',
          sizes[size].root,
        )
      }
    >
      {({ isDisabled }) => (
        <>
          {Icon && <Icon className="tw:pointer-events-none tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />}
          <FocusScope contain={false} autoFocus={false} restoreFocus={false}>
            <InnerAutocomplete isDisabled={isDisabled} placeholder={placeholder} />
          </FocusScope>
        </>
      )}
    </AriaGroup>
  );
};

const resolveSelectedItems = (value: SelectItemType[] | ListData<SelectItemType>): SelectItemType[] =>
  Array.isArray(value) ? value : value.items;

export const AutocompleteBase = ({
  items,
  children,
  label,
  tooltip,
  hint,
  selectedItems,
  onItemCleared,
  onItemInserted,
  placeholder = 'Search',
  popoverClassName,
  renderTag,
  filterOption,
  onSearchChange,
  name: _name,
  className: _className,
  ...props
}: AutocompleteProps) => {
  const { contains } = useFilter({ sensitivity: 'base' });

  const [internalSelected, setInternalSelected] = useState<SelectItemType[]>(resolveSelectedItems(selectedItems));
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
      if (selectedKeys.includes(item.id)) return false;
      if (filterOption) return filterOption(item, filterText);
      return contains(item.label || item.supportingText || '', filterText);
    });
  }, [allItems, filterText, selectedKeys, filterOption, contains]);

  const itemMap = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);

  const onRemove = useCallback(
    (keys: Set<Key>) => {
      const key = keys.values().next().value;
      if (!key) return;
      setInternalSelected((prev) => prev.filter((item) => item.id !== key));
      onItemCleared?.(key);
      setFilterText('');
    },
    [onItemCleared],
  );

  const onSelectionChange = (id: Key | null) => {
    if (!id) return;
    const item = itemMap.get(id as string);
    if (!item) return;
    if (!selectedKeys.includes(id as string)) {
      setInternalSelected((prev) => [...prev, item]);
      onItemInserted?.(id);
    }
    setFilterText('');
  };

  const onInputChange = (value: string) => {
    setFilterText(value);
    onSearchChange?.(value);
  };

  const triggerRef = useRef<HTMLDivElement>(null);
  const [popoverWidth, setPopoverWidth] = useState('');

  const onResize = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverWidth(rect.width + 'px');
  }, [triggerRef]);

  useResizeObserver({ ref: triggerRef, onResize, box: 'border-box' });

  const selectContextValue = useMemo(() => ({ size: 'sm' as const }), []);

  const autocompleteContextValue = useMemo(
    () => ({ size: 'sm' as const, selectedKeys, selectedItems: internalSelected, onInputChange, onRemove, renderTag }),
    [selectedKeys, internalSelected, onInputChange, onRemove, renderTag],
  );

  return (
    <SelectContext.Provider value={selectContextValue}>
      <AutocompleteContext.Provider value={autocompleteContextValue}>
        <AriaComboBox
          allowsEmptyCollection
          menuTrigger="focus"
          items={visibleItems}
          onInputChange={onInputChange}
          inputValue={filterText}
          selectedKey={null}
          onSelectionChange={onSelectionChange}
          {...props}
        >
          {(state) => (
            <div className="tw:flex tw:flex-col tw:gap-1.5">
              {label && (
                <Label isRequired={state.isRequired} tooltip={tooltip}>
                  {label}
                </Label>
              )}

              <div ref={triggerRef} className="tw:relative tw:w-full">
                <AutocompleteTrigger
                  size="sm"
                  placeholder={placeholder}
                  placeholderIcon={props.placeholderIcon}
                  onFocus={onResize}
                  onPointerEnter={onResize}
                />
              </div>

              <Popover size="md" triggerRef={triggerRef} style={{ width: popoverWidth }} className={popoverClassName}>
                <AriaListBox selectionMode="multiple" className="tw:size-full tw:outline-hidden">
                  {children}
                </AriaListBox>
              </Popover>

              {hint && <HintText isInvalid={state.isInvalid}>{hint}</HintText>}
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
