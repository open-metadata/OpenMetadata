import {
  createContext,
  forwardRef,
  type ReactNode,
  type Ref,
  useContext,
} from 'react';
import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
} from 'react-aria-components';
import { Label } from '@/components/base/input/label';
import { cx } from '@/utils/cx';
import { borderAfter } from '@/utils/tailwindClasses';

export interface RadioGroupContextType {
  size?: 'sm' | 'md';
}

const RadioGroupContext = createContext<RadioGroupContextType | null>(null);

export interface RadioButtonBaseProps {
  size?: 'sm' | 'md';
  className?: string;
  isFocusVisible?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
}

export const RadioButtonBase = ({
  className,
  isFocusVisible,
  isSelected,
  isDisabled,
  size = 'sm',
}: RadioButtonBaseProps) => {
  return (
    <div
      className={cx(
        // Border on ::after — the element's own outline is reserved for the focus ring below.
        'tw:relative tw:flex tw:size-4 tw:min-h-4 tw:min-w-4 tw:cursor-pointer tw:appearance-none tw:items-center tw:justify-center tw:rounded-full tw:bg-primary',
        `${borderAfter} tw:after:outline-primary`,
        size === 'md' && 'tw:size-5 tw:min-h-5 tw:min-w-5',
        isSelected &&
          !isDisabled &&
          'tw:bg-brand-solid tw:after:outline-brand-solid',
        isDisabled &&
          'tw:cursor-not-allowed tw:border-disabled tw:bg-disabled_subtle',
        isFocusVisible &&
          'tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring',
        className
      )}>
      <div
        className={cx(
          'tw:size-1.5 tw:rounded-full tw:bg-fg-white tw:opacity-0 tw:transition-inherit-all',
          size === 'md' && 'tw:size-2',
          isDisabled && 'tw:bg-fg-disabled_subtle',
          isSelected && 'tw:opacity-100'
        )}
      />
    </div>
  );
};
RadioButtonBase.displayName = 'RadioButtonBase';

interface RadioButtonProps extends AriaRadioProps {
  size?: 'sm' | 'md';
  label?: ReactNode;
  hint?: ReactNode;
  variant?: 'default' | 'card';
  /** Noninteractive content shown after the label and hint. */
  trailing?: ReactNode;
  ref?: Ref<HTMLLabelElement>;
  /** Extra classes for the circular indicator (e.g. a brand-coloured ring). */
  indicatorClassName?: string;
}

export const RadioButton = forwardRef<
  HTMLLabelElement,
  Omit<RadioButtonProps, 'ref'>
>(function RadioButton(
  {
    label,
    hint,
    className,
    indicatorClassName,
    size = 'sm',
    variant = 'default',
    trailing,
    ...ariaRadioProps
  },
  ref
) {
  const context = useContext(RadioGroupContext);

  size = context?.size ?? size;

  const sizes = {
    sm: {
      root: 'tw:gap-2',
      textWrapper: '',
      label: 'tw:text-sm tw:font-medium',
      hint: 'tw:text-sm',
    },
    md: {
      root: 'tw:gap-3',
      textWrapper: 'tw:gap-0.5',
      label: 'tw:text-md tw:font-medium',
      hint: 'tw:text-md',
    },
  };

  return (
    <AriaRadio
      {...ariaRadioProps}
      className={(renderProps) =>
        cx(
          'tw:flex tw:items-start',
          sizes[size].root,
          variant === 'card' && [
            `tw:relative tw:w-full tw:cursor-pointer tw:rounded-lg tw:bg-surface tw:p-3 tw:transition ${borderAfter} tw:after:outline-primary`,
            renderProps.isHovered &&
              !renderProps.isDisabled &&
              'tw:bg-primary_hover tw:after:outline-hover',
            renderProps.isSelected &&
              !renderProps.isDisabled &&
              'tw:bg-brand-primary tw:after:outline-brand',
            renderProps.isDisabled &&
              'tw:bg-disabled_subtle tw:after:outline-disabled',
            renderProps.isFocusVisible &&
              'tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring',
          ],
          renderProps.isDisabled && 'tw:cursor-not-allowed',
          typeof className === 'function' ? className(renderProps) : className
        )
      }
      ref={ref}>
      {({ isSelected, isDisabled, isFocusVisible }) => (
        <>
          <RadioButtonBase
            className={cx((label || hint) && 'tw:mt-0.5', indicatorClassName)}
            isDisabled={isDisabled}
            isFocusVisible={variant === 'default' && isFocusVisible}
            isSelected={isSelected}
            size={size}
          />
          {(label || hint) && (
            <div
              className={cx(
                'tw:inline-flex tw:flex-col',
                sizes[size].textWrapper,
                variant === 'card' && 'tw:min-w-0 tw:flex-1 tw:break-words'
              )}>
              {label && (
                <p
                  className={cx(
                    'tw:text-secondary tw:select-none',
                    sizes[size].label,
                    variant === 'card' && isDisabled && 'tw:text-disabled'
                  )}>
                  {label}
                </p>
              )}
              {hint && (
                <span
                  className={cx(
                    'tw:text-tertiary',
                    sizes[size].hint,
                    variant === 'card' && isDisabled && 'tw:text-disabled'
                  )}
                  onClick={
                    variant === 'default'
                      ? (event) => event.stopPropagation()
                      : undefined
                  }>
                  {hint}
                </span>
              )}
            </div>
          )}
          {trailing && (
            <span
              className={cx(
                'tw:shrink-0 tw:text-xs tw:text-tertiary',
                isDisabled && 'tw:text-disabled'
              )}>
              {trailing}
            </span>
          )}
        </>
      )}
    </AriaRadio>
  );
});
RadioButton.displayName = 'RadioButton';

interface RadioGroupProps extends RadioGroupContextType, AriaRadioGroupProps {
  children: ReactNode;
  className?: string;
  label?: ReactNode;
}

export const RadioGroup = ({
  children,
  className,
  label,
  size = 'sm',
  ...props
}: RadioGroupProps) => {
  return (
    <RadioGroupContext.Provider value={{ size }}>
      <AriaRadioGroup
        {...props}
        className={cx('tw:flex tw:flex-col tw:gap-4', className)}>
        {label && <Label>{label}</Label>}
        {children}
      </AriaRadioGroup>
    </RadioGroupContext.Provider>
  );
};
