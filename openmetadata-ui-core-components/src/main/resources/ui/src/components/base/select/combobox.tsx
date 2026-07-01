import type { ReactNode, RefObject, RefAttributes } from 'react';
import { isValidElement, useContext, useMemo, useRef } from 'react';
import { ChevronDown, SearchLg as SearchIcon } from '@untitledui/icons';
import type {
  ComboBoxProps as AriaComboBoxProps,
  GroupProps as AriaGroupProps,
  ListBoxProps as AriaListBoxProps,
} from 'react-aria-components';
import {
  Button as AriaButton,
  ComboBox as AriaComboBox,
  Group as AriaGroup,
  Input as AriaInput,
  ListBox as AriaListBox,
  ComboBoxStateContext,
} from 'react-aria-components';
import { Avatar } from '@/components/base/avatar/avatar';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { Popover } from '@/components/base/select/popover';
import {
  type SelectCommonProps,
  SelectContext,
  type SelectItemType,
  sizes,
} from '@/components/base/select/select';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { fontSizeClass } from '@/utils/tailwindClasses';

interface ComboBoxProps
  extends Omit<AriaComboBoxProps<SelectItemType>, 'children' | 'items'>,
    RefAttributes<HTMLDivElement>,
    SelectCommonProps {
  shortcut?: boolean;
  items?: SelectItemType[];
  popoverClassName?: string;
  shortcutClassName?: string;
  showSearchIcon?: boolean;
  children: AriaListBoxProps<SelectItemType>['children'];
}

interface ComboBoxValueProps extends AriaGroupProps {
  size: 'sm' | 'md';
  fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  inputRef: RefObject<HTMLInputElement>;
  triggerRef: RefObject<HTMLDivElement>;
  showSearchIcon: boolean;
  shortcut: boolean;
  placeholder?: string;
  shortcutClassName?: string;
}

const ComboBoxValue = ({
  size,
  fontSize,
  inputRef,
  triggerRef,
  showSearchIcon,
  shortcut,
  placeholder,
  shortcutClassName,
  onPointerDown,
  ...otherProps
}: ComboBoxValueProps) => {
  const state = useContext(ComboBoxStateContext);

  const value = state?.selectedItem?.value || null;
  const inputValue = state?.inputValue || null;

  const first = inputValue?.split(value?.supportingText)?.[0] || '';
  const last = inputValue?.split(first)[1];
  const Icon = value?.icon;
  const inputPadding = cx(
    showSearchIcon ? 'tw:pl-10' : size === 'sm' ? 'tw:pl-3' : 'tw:pl-3.5',
    shortcut ? 'tw:pr-16' : size === 'sm' ? 'tw:pr-9' : 'tw:pr-10'
  );

  const handlePointerDown: AriaGroupProps['onPointerDown'] = (event) => {
    onPointerDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (event.target instanceof HTMLElement && event.target.closest('button')) {
      return;
    }

    inputRef.current?.focus();
    state?.open(null, 'input');
  };

  return (
    <AriaGroup
      {...otherProps}
      className={({ isFocusWithin, isDisabled }) =>
        cx(
          'tw:relative tw:flex tw:w-full tw:cursor-text tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:outline-hidden tw:transition-shadow tw:duration-100 tw:ease-linear tw:ring-inset',
          isDisabled && 'tw:cursor-not-allowed tw:bg-disabled_subtle',
          isFocusWithin && 'tw:ring-2 tw:ring-brand',
          sizes[size].root
        )
      }
      ref={triggerRef}
      onPointerDown={handlePointerDown}>
      {({ isDisabled }) => (
        <>
          <div
            aria-hidden="true"
            className={cx(
              'tw:pointer-events-none tw:z-0 tw:flex tw:w-full tw:items-center tw:gap-2 tw:truncate',
              shortcut ? 'tw:pr-12' : 'tw:pr-5'
            )}>
            {showSearchIcon && (
              <SearchIcon className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
            )}
            {inputValue && (
              <span className="tw:flex tw:w-full tw:items-center tw:gap-2 tw:truncate">
                {/* Match Select value rendering: avatar wins, then component icons, then rendered React nodes. */}
                {value?.avatarUrl ? (
                  <Avatar alt={value.label} size="xs" src={value.avatarUrl} />
                ) : isReactComponent(Icon) ? (
                  <Icon data-icon aria-hidden="true" />
                ) : isValidElement(Icon) ? (
                  (Icon as ReactNode)
                ) : null}

                <section className="tw:flex tw:w-full tw:gap-2 tw:truncate">
                  <p
                    className={cx(
                      'tw:truncate tw:text-primary',
                      fontSizeClass[fontSize],
                      isDisabled && 'tw:text-disabled'
                    )}>
                    {first}
                  </p>
                  {last && (
                    <p
                      className={cx(
                        'tw:text-tertiary',
                        fontSizeClass[fontSize],
                        isDisabled && 'tw:text-disabled'
                      )}>
                      {last}
                    </p>
                  )}
                </section>
              </span>
            )}
          </div>

          <AriaInput
            className={cx(
              'tw:absolute tw:inset-0 tw:z-10 tw:size-full tw:appearance-none tw:rounded-[inherit] tw:bg-transparent tw:text-transparent tw:caret-alpha-black/90 tw:placeholder:text-placeholder tw:focus:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-disabled tw:disabled:placeholder:text-disabled',
              inputPadding,
              fontSizeClass[fontSize]
            )}
            placeholder={placeholder}
            ref={inputRef}
          />

          {shortcut ? (
            <div
              className={cx(
                'tw:pointer-events-none tw:absolute tw:inset-y-0.5 tw:right-0.5 tw:z-20 tw:flex tw:items-center tw:rounded-r-[inherit] tw:bg-linear-to-r tw:from-transparent tw:to-bg-primary tw:to-40% tw:pl-8',
                isDisabled && 'tw:to-bg-disabled_subtle',
                sizes[size].shortcut,
                shortcutClassName
              )}>
              <span
                aria-hidden="true"
                className={cx(
                  'tw:pointer-events-none tw:rounded tw:px-1 tw:py-px tw:text-xs tw:font-medium tw:text-quaternary tw:ring-1 tw:ring-secondary tw:select-none tw:ring-inset',
                  isDisabled && 'tw:bg-transparent tw:text-disabled'
                )}>
                ⌘K
              </span>
            </div>
          ) : (
            <AriaButton
              className={cx(
                'tw:absolute tw:inset-y-0 tw:right-0 tw:z-20 tw:flex tw:items-center tw:justify-center tw:rounded-r-[inherit] tw:text-fg-quaternary tw:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:text-fg-disabled',
                size === 'sm' ? 'tw:w-9' : 'tw:w-10'
              )}>
              <ChevronDown
                aria-hidden="true"
                className={cx(
                  'tw:shrink-0',
                  size === 'sm' ? 'tw:size-4 tw:stroke-[2.5px]' : 'tw:size-5'
                )}
              />
            </AriaButton>
          )}
        </>
      )}
    </AriaGroup>
  );
};

export const ComboBox = ({
  placeholder = 'Search',
  shortcut = true,
  size = 'sm',
  fontSize = 'md',
  showSearchIcon = true,
  children,
  items,
  shortcutClassName,
  ...otherProps
}: ComboBoxProps) => {
  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectContextValue = useMemo(
    () => ({ fontSize, size }),
    [fontSize, size]
  );

  return (
    <SelectContext.Provider value={selectContextValue}>
      <AriaComboBox menuTrigger="focus" {...otherProps}>
        {(state) => (
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            {otherProps.label && (
              <Label isRequired={state.isRequired} tooltip={otherProps.tooltip}>
                {otherProps.label}
              </Label>
            )}

            <ComboBoxValue
              fontSize={fontSize}
              inputRef={inputRef}
              placeholder={placeholder}
              shortcut={shortcut}
              shortcutClassName={shortcutClassName}
              showSearchIcon={showSearchIcon}
              size={size}
              triggerRef={triggerRef}
            />

            <Popover
              className={otherProps.popoverClassName}
              size={size}
              triggerRef={triggerRef}>
              <AriaListBox
                className="tw:size-full tw:outline-hidden"
                items={items}>
                {children}
              </AriaListBox>
            </Popover>

            {otherProps.hint && (
              <HintText isInvalid={state.isInvalid}>{otherProps.hint}</HintText>
            )}
          </div>
        )}
      </AriaComboBox>
    </SelectContext.Provider>
  );
};
