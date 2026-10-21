import { Avatar } from '@/components/base/avatar/avatar';
import { CheckboxBase } from '@/components/base/checkbox/checkbox';
import { SelectContext } from '@/components/base/select/select';
import type { SelectItemType } from '@/components/base/select/select';
import { cx } from '@/utils/cx';
import { isReactComponent } from '@/utils/is-react-component';
import { fontSizeClass } from '@/utils/tailwindClasses';
import { Check } from '../../../icons';
import type { ReactNode } from 'react';
import { createContext, isValidElement, useContext } from 'react';
import type {
  Key,
  ListBoxItemProps as AriaListBoxItemProps,
  ListBoxItemRenderProps,
} from 'react-aria-components';
import {
  ListBoxItem as AriaListBoxItem,
  Text as AriaText,
} from 'react-aria-components';

/**
 * Keys of the selected values when the Autocomplete lists them as checked
 * rows (its capped mode); null when selected values leave the list instead.
 */
export const AutocompleteCheckedKeysContext =
  createContext<ReadonlySet<Key> | null>(null);

const sizes = {
  sm: 'tw:p-2 tw:pr-2.5',
  md: 'tw:p-2.5 tw:pl-2',
};

// `outline-hidden` removed: the outline now draws the focus indicator (it replaced a ring,
// which WebKit does not pixel-snap).
const itemWrapperBase =
  'tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:select-none';

const itemWrapperClass = (
  state: ListBoxItemRenderProps,
  size: 'sm' | 'md',
  extraClass?: string
) =>
  cx(
    itemWrapperBase,
    // Selected matches the sidebar's selected nav item and wins over focus.
    state.isSelected && 'tw:bg-brand-primary',
    state.isDisabled && 'tw:cursor-not-allowed',
    state.isFocused && !state.isSelected && 'tw:bg-primary_hover',
    state.isFocusVisible &&
      'tw:outline-2 tw:-outline-offset-2 tw:outline-focus-ring',
    sizes[size],
    extraClass
  );

const checkClass = (size: 'sm' | 'md', isDisabled: boolean) =>
  cx(
    'tw:ml-auto tw:shrink-0 tw:text-fg-brand-secondary_alt',
    size === 'sm' ? 'tw:size-4 tw:stroke-[2.5px]' : 'tw:size-5',
    isDisabled && 'tw:text-fg-disabled'
  );

interface AutocompleteItemProps
  extends Omit<AriaListBoxItemProps<SelectItemType>, 'id' | 'children'>,
    Omit<SelectItemType, 'id'> {
  id: string;
  'data-testid'?: string;
  children?: ReactNode | ((state: ListBoxItemRenderProps) => ReactNode);
}

const renderItemIcon = (
  avatarUrl: string | undefined,
  Icon: SelectItemType['icon'],
  label: string | undefined
) => {
  if (avatarUrl) {
    return <Avatar alt={label} aria-hidden="true" size="xs" src={avatarUrl} />;
  }
  if (isReactComponent(Icon)) {
    return <Icon data-icon aria-hidden="true" />;
  }
  if (isValidElement(Icon)) {
    return Icon;
  }

  return null;
};

interface DefaultItemContentProps {
  state: ListBoxItemRenderProps;
  size: 'sm' | 'md';
  fontSize: keyof typeof fontSizeClass;
  label: string | undefined;
  avatarUrl: string | undefined;
  supportingText: string | undefined;
  icon: SelectItemType['icon'];
  dataTestId: string | undefined;
  stringChild: string;
  leading: ReactNode;
}

const DefaultItemContent = ({
  state,
  size,
  fontSize,
  label,
  avatarUrl,
  supportingText,
  icon,
  dataTestId,
  stringChild,
  leading,
}: DefaultItemContentProps) => (
  <div
    className={itemWrapperClass(
      state,
      size,
      cx(
        'tw:*:data-icon:size-5 tw:*:data-icon:shrink-0 tw:*:data-icon:text-fg-quaternary',
        state.isDisabled && 'tw:*:data-icon:text-fg-disabled'
      )
    )}
    data-testid={dataTestId}>
    {leading}
    {renderItemIcon(avatarUrl, icon, label)}

    <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-1 tw:flex-wrap tw:gap-x-2">
      <AriaText
        className={cx(
          'tw:truncate tw:font-medium tw:whitespace-nowrap',
          state.isSelected ? 'tw:text-brand-secondary' : 'tw:text-primary',
          fontSizeClass[fontSize],
          state.isDisabled && 'tw:text-disabled'
        )}
        slot="label">
        {label || stringChild}
      </AriaText>

      {supportingText && (
        <AriaText
          className={cx(
            'tw:basis-full tw:whitespace-normal tw:text-tertiary',
            fontSizeClass[fontSize],
            state.isDisabled && 'tw:text-disabled'
          )}
          slot="description">
          {supportingText}
        </AriaText>
      )}
    </div>

    {state.isSelected && (
      <Check
        aria-hidden="true"
        className={checkClass(size, state.isDisabled)}
      />
    )}
  </div>
);

interface CustomItemContentProps {
  state: ListBoxItemRenderProps;
  size: 'sm' | 'md';
  dataTestId: string | undefined;
  children: ReactNode | ((state: ListBoxItemRenderProps) => ReactNode);
  leading: ReactNode;
}

const CustomItemContent = ({
  state,
  size,
  dataTestId,
  children,
  leading,
}: CustomItemContentProps) => (
  <div className={itemWrapperClass(state, size)} data-testid={dataTestId}>
    {leading}
    {typeof children === 'function' ? children(state) : children}
    {state.isSelected && (
      <Check
        aria-hidden="true"
        className={checkClass(size, state.isDisabled)}
      />
    )}
  </div>
);

export const AutocompleteItem = ({
  label,
  id,
  value,
  avatarUrl,
  supportingText,
  isDisabled,
  icon: Icon,
  className,
  children,
  'data-testid': dataTestId,
  ...props
}: AutocompleteItemProps) => {
  const { size, fontSize } = useContext(SelectContext);
  const checkedKeys = useContext(AutocompleteCheckedKeysContext);

  const stringChild = typeof children === 'string' ? children : '';
  const labelOrChildren = label || stringChild;
  const textValue = supportingText
    ? labelOrChildren + ' ' + supportingText
    : labelOrChildren;
  const hasCustomChildren = Boolean(children) && typeof children !== 'string';

  return (
    <AriaListBoxItem
      id={id}
      isDisabled={isDisabled}
      textValue={textValue}
      value={
        value ?? {
          id,
          label: labelOrChildren,
          avatarUrl,
          supportingText,
          isDisabled,
          icon: Icon,
        }
      }
      {...props}
      className={(state) =>
        cx(
          'tw:w-full tw:px-1.5 tw:py-px tw:outline-hidden',
          typeof className === 'function' ? className(state) : className
        )
      }>
      {(state) => {
        const leading = checkedKeys && (
          <CheckboxBase
            isDisabled={state.isDisabled}
            isSelected={checkedKeys.has(id)}
          />
        );

        return hasCustomChildren ? (
          <CustomItemContent
            dataTestId={dataTestId}
            leading={leading}
            size={size}
            state={state}>
            {
              children as
                | ReactNode
                | ((state: ListBoxItemRenderProps) => ReactNode)
            }
          </CustomItemContent>
        ) : (
          <DefaultItemContent
            avatarUrl={avatarUrl}
            dataTestId={dataTestId}
            fontSize={fontSize}
            icon={Icon}
            label={label}
            leading={leading}
            size={size}
            state={state}
            stringChild={stringChild}
            supportingText={supportingText}
          />
        );
      }}
    </AriaListBoxItem>
  );
};
