import { Avatar } from '@/components/base/avatar/avatar';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { fontSizeClass } from '@/utils/tailwindClasses';
import { ChevronDown } from '../../../icons';
import type { FC, ReactNode, RefAttributes } from 'react';
import { createContext, forwardRef, isValidElement } from 'react';
import type { SelectProps as AriaSelectProps } from 'react-aria-components';
import {
  Button as AriaButton,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
} from 'react-aria-components';
import { ComboBox } from './combobox';
import {
  SELECT_VIRTUALIZATION_THRESHOLD,
  SelectListBox,
} from './select-list-box';
import { Popover } from './popover';
import { SelectItem } from './select-item';

export type SelectItemType = {
  id: string;
  label?: string;
  avatarUrl?: string;
  isDisabled?: boolean;
  supportingText?: string;
  icon?: FC | ReactNode;
};

export interface SelectCommonProps {
  hint?: string;
  label?: string;
  tooltip?: string;
  size?: 'sm' | 'md';
  fontSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  placeholder?: string;
  emptyState?: ReactNode;
}

/**
 * `xs` compacts the trigger only — 28px tall, matching Button `xs` — for a
 * filter that sits in a dense header. Its menu keeps `sm` sizing.
 */
export type SelectSize = 'xs' | 'sm' | 'md';

export const SelectEmptyState = ({
  emptyState,
}: {
  emptyState?: ReactNode;
}) => {
  const { t } = useCoreTranslation();

  return (
    <div className="tw:px-3 tw:py-4 tw:text-center tw:text-sm tw:text-tertiary">
      {emptyState ?? t('label.no-data-found')}
    </div>
  );
};

interface SelectProps
  extends Omit<AriaSelectProps<SelectItemType>, 'children' | 'items'>,
    RefAttributes<HTMLDivElement>,
    Omit<SelectCommonProps, 'size'> {
  size?: SelectSize;
  items?: SelectItemType[];
  popoverClassName?: string;
  icon?: FC | ReactNode;
  /**
   * Drop the trigger's own surface and border (keyboard focus still shows),
   * for a select inside a container that already draws them (e.g. a search bar).
   */
  borderless?: boolean;
  children: ReactNode | ((item: SelectItemType) => ReactNode);
}

interface SelectValueProps {
  isOpen: boolean;
  size: SelectSize;
  fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isFocused: boolean;
  isDisabled: boolean;
  placeholder?: string;
  icon?: FC | ReactNode;
  borderless?: boolean;
}

export const sizes = {
  xs: { root: 'tw:py-1.25 tw:px-2', shortcut: 'tw:pr-2' },
  sm: { root: 'tw:py-2 tw:px-3', shortcut: 'tw:pr-2.5' },
  md: { root: 'tw:py-2.5 tw:px-3.5', shortcut: 'tw:pr-3' },
};

const SelectValue = ({
  isOpen,
  isFocused,
  isDisabled,
  size,
  fontSize,
  placeholder,
  icon,
  borderless,
}: SelectValueProps) => {
  return (
    <AriaButton
      className={({ isFocusVisible }) =>
        cx(
          // Border drawn with outline, not a ring: WebKit does not pixel-snap box-shadow, so
          // a ring thins/vanishes in Safari when zoomed out. `outline-hidden` is gone — the
          // outline IS the border and focus indicator here, as in input.tsx.
          'tw:relative tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:bg-primary tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:transition tw:duration-100 tw:ease-linear',
          size === 'xs' ? 'tw:rounded-md' : 'tw:rounded-lg',
          (isFocused || isOpen) &&
            'tw:outline-2 tw:-outline-offset-2 tw:outline-brand',
          isDisabled &&
            'tw:cursor-not-allowed tw:bg-disabled_subtle tw:text-disabled',
          borderless &&
            !isFocusVisible &&
            'tw:bg-transparent tw:shadow-none tw:outline-0'
        )
      }>
      <AriaSelectValue<SelectItemType>
        className={cx(
          'tw:flex tw:h-max tw:w-full tw:items-center tw:justify-start tw:truncate tw:text-left tw:align-middle',
          size === 'xs' ? 'tw:gap-1.5' : 'tw:gap-2',

          // Icon styles
          'tw:*:data-icon:shrink-0 tw:*:data-icon:text-fg-quaternary tw:in-disabled:*:data-icon:text-fg-disabled',
          size === 'xs' ? 'tw:*:data-icon:size-4' : 'tw:*:data-icon:size-5',

          sizes[size].root
        )}>
        {(state) => {
          const Icon = state.selectedItem?.icon || icon;

          return (
            <>
              {state.selectedItem?.avatarUrl ? (
                <Avatar
                  alt={state.selectedItem.label}
                  size="xs"
                  src={state.selectedItem.avatarUrl}
                />
              ) : isReactComponent(Icon) ? (
                <Icon data-icon aria-hidden="true" />
              ) : isValidElement(Icon) ? (
                Icon
              ) : null}

              {state.selectedItem ? (
                <section className="tw:flex tw:w-full tw:gap-2 tw:truncate">
                  <p
                    className={cx(
                      'tw:truncate tw:text-primary',
                      fontSizeClass[fontSize]
                    )}>
                    {state.selectedItem?.label}
                  </p>
                  {state.selectedItem?.supportingText && (
                    <p
                      className={cx(
                        'tw:text-tertiary',
                        fontSizeClass[fontSize]
                      )}>
                      {state.selectedItem?.supportingText}
                    </p>
                  )}
                </section>
              ) : (
                <p
                  className={cx(
                    'tw:text-placeholder',
                    fontSizeClass[fontSize],
                    isDisabled && 'tw:text-disabled'
                  )}>
                  {placeholder}
                </p>
              )}

              <ChevronDown
                aria-hidden="true"
                className={cx(
                  'tw:ml-auto tw:shrink-0 tw:text-fg-quaternary',
                  size === 'md' ? 'tw:size-5' : 'tw:size-4 tw:stroke-[2.5px]'
                )}
              />
            </>
          );
        }}
      </AriaSelectValue>
    </AriaButton>
  );
};

export const SelectContext = createContext<{
  size: 'sm' | 'md';
  fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}>({
  fontSize: 'sm',
  size: 'sm',
});

const Select = forwardRef<HTMLDivElement, Omit<SelectProps, 'ref'>>(
  function Select(
    {
      placeholder = 'Select',
      icon,
      size = 'sm',
      fontSize = 'sm',
      children,
      items,
      label,
      hint,
      tooltip,
      emptyState,
      className,
      borderless,
      // Without this react-aria keeps an empty list closed, so `emptyState`
      // would never render.
      allowsEmptyCollection = true,
      ...rest
    },
    ref
  ) {
    const isVirtualized =
      (items?.length ?? 0) > SELECT_VIRTUALIZATION_THRESHOLD;
    const menuSize = size === 'xs' ? 'sm' : size;

    return (
      <SelectContext.Provider value={{ fontSize, size: menuSize }}>
        <AriaSelect
          {...rest}
          allowsEmptyCollection={allowsEmptyCollection}
          className={(state) =>
            cx(
              'tw:flex tw:flex-col tw:gap-1.5',
              typeof className === 'function' ? className(state) : className
            )
          }
          ref={ref}>
          {(state) => (
            <>
              {label && (
                <Label isRequired={state.isRequired} tooltip={tooltip}>
                  {label}
                </Label>
              )}

              <SelectValue
                {...state}
                {...{ size, fontSize, placeholder }}
                borderless={borderless}
                icon={icon}
              />

              <Popover
                className={cx(
                  isVirtualized && 'tw:overflow-hidden tw:py-0',
                  rest.popoverClassName
                )}
                size={menuSize}>
                <SelectListBox
                  items={items}
                  renderEmptyState={() => (
                    <SelectEmptyState emptyState={emptyState} />
                  )}
                  size={menuSize}
                  virtualize={isVirtualized}>
                  {children}
                </SelectListBox>
              </Popover>

              {hint && <HintText isInvalid={state.isInvalid}>{hint}</HintText>}
            </>
          )}
        </AriaSelect>
      </SelectContext.Provider>
    );
  }
);

Select.displayName = 'Select';

const _Select = Select as typeof Select & {
  ComboBox: typeof ComboBox;
  Item: typeof SelectItem;
};
_Select.ComboBox = ComboBox;
_Select.Item = SelectItem;

export { _Select as Select };
