import type { FormEvent, ReactNode, Ref } from 'react';
import React, { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';
import type {
  TextAreaProps as AriaTextAreaProps,
  TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import {
  TextArea as AriaTextArea,
  TextField as AriaTextField,
} from 'react-aria-components';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { cx } from '@/utils/cx';
import { fontSizeClass } from '@/utils';

// The resize grip: two short diagonal strokes in the corner. Chromium and
// WebKit paint only background properties on ::-webkit-resizer — a mask is
// ignored, which left a solid square — so the strokes are gradient bands in
// currentColor, and the pseudo's `color` carries the semantic token (dark mode
// included) without a hardcoded hex.
const RESIZE_GRIP_CLASSES =
  'tw:[&::-webkit-resizer]:text-border-primary tw:[&::-webkit-resizer]:bg-transparent tw:[&::-webkit-resizer]:bg-[linear-gradient(135deg,transparent_31%,currentColor_31%_37%,transparent_37%_47%,currentColor_47%_53%,transparent_53%)]';

export interface TextAreaAutoSize {
  /** Rows the textarea never shrinks below. */
  minRows?: number;
  /** Rows after which the textarea stops growing and scrolls. */
  maxRows?: number;
}

interface TextAreaBaseProps extends AriaTextAreaProps {
  ref?: Ref<HTMLTextAreaElement>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Grow with the content instead of scrolling. `true` grows without limit;
   * `{ minRows, maxRows }` clamps the height to that many lines.
   */
  autoSize?: boolean | TextAreaAutoSize;
}

const toPx = (value: string) => Number.parseFloat(value) || 0;

/** Fits the textarea's height to its content, clamped to the row limits. */
const fitToContent = (
  element: HTMLTextAreaElement,
  { minRows, maxRows }: TextAreaAutoSize
) => {
  const style = getComputedStyle(element);
  const lineHeight = toPx(style.lineHeight) || toPx(style.fontSize) * 1.5;
  const borders = toPx(style.borderTopWidth) + toPx(style.borderBottomWidth);
  const chrome = toPx(style.paddingTop) + toPx(style.paddingBottom) + borders;

  // Collapse first so scrollHeight measures the content, not the old height.
  element.style.height = 'auto';
  const contentHeight = element.scrollHeight + borders;
  const minHeight = minRows ? minRows * lineHeight + chrome : 0;
  const maxHeight = maxRows ? maxRows * lineHeight + chrome : Infinity;

  element.style.height = `${Math.min(
    Math.max(contentHeight, minHeight),
    maxHeight
  )}px`;
  element.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
};

export const TextAreaBase = forwardRef<
  HTMLTextAreaElement,
  Omit<TextAreaBaseProps, 'ref'>
>(function TextAreaBase({ className, size, autoSize, onInput, ...props }, ref) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    },
    [ref]
  );

  const resize = useCallback(() => {
    if (autoSize && innerRef.current) {
      fitToContent(innerRef.current, autoSize === true ? {} : autoSize);
    }
  }, [autoSize]);

  // Every render, so a controlled value set from outside is measured too.
  useLayoutEffect(resize);

  const handleInput = (event: FormEvent<HTMLTextAreaElement>) => {
    resize();
    onInput?.(event);
  };

  return (
    <AriaTextArea
      {...props}
      className={(state) =>
        cx(
          // Border drawn with outline, not a ring: WebKit does not pixel-snap box-shadow,
          // so a ring thins/vanishes in Safari when zoomed out. `focus:outline-hidden` is
          // gone — the outline IS the focus indicator here, as in input.tsx.
          'tw:w-full tw:scroll-py-3 tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-3 tw:text-primary tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:transition tw:duration-100 tw:ease-linear tw:placeholder:text-placeholder tw:autofill:rounded-lg tw:autofill:text-primary',

          RESIZE_GRIP_CLASSES,

          state.isFocused &&
            !state.isDisabled &&
            'tw:outline-2 tw:-outline-offset-2 tw:outline-brand',
          state.isDisabled &&
            'tw:cursor-not-allowed tw:bg-disabled_subtle tw:text-disabled tw:outline-disabled',
          state.isInvalid && 'tw:outline-error_subtle',
          state.isInvalid &&
            state.isFocused &&
            'tw:outline-2 tw:-outline-offset-2 tw:outline-error',

          fontSizeClass[size || 'md'],

          // A user-dragged height would fight the content-driven one.
          autoSize && 'tw:resize-none',

          typeof className === 'function' ? className(state) : className
        )
      }
      ref={setRefs}
      onInput={handleInput}
    />
  );
});

TextAreaBase.displayName = 'TextAreaBase';

interface TextFieldProps extends AriaTextFieldProps {
  /** Label text for the textarea */
  label?: string;
  /** Helper text displayed below the textarea */
  hint?: ReactNode;
  /** Tooltip message displayed after the label. */
  tooltip?: string;
  /** Class name for the textarea wrapper */
  textAreaClassName?: TextAreaBaseProps['className'];
  /** Ref for the textarea wrapper */
  ref?: Ref<HTMLDivElement>;
  /** Ref for the textarea */
  textAreaRef?: TextAreaBaseProps['ref'];
  /** Whether to hide required indicator from label. */
  hideRequiredIndicator?: boolean;
  /** Placeholder text. */
  placeholder?: string;
  /** Visible height of textarea in rows . */
  rows?: number;
  /** Visible width of textarea in columns. */
  cols?: number;
  /** Size of the textarea. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Grow with the content; see `TextAreaBase`. */
  autoSize?: TextAreaBaseProps['autoSize'];
}

export const TextArea = forwardRef<HTMLDivElement, Omit<TextFieldProps, 'ref'>>(
  function TextArea(
    {
      label,
      hint,
      tooltip,
      textAreaRef,
      hideRequiredIndicator,
      textAreaClassName,
      placeholder,
      className,
      rows,
      cols,
      size,
      autoSize,
      ...props
    },
    ref
  ) {
    return (
      <AriaTextField
        {...props}
        className={(state) =>
          cx(
            'tw:group tw:flex tw:h-max tw:w-full tw:flex-col tw:items-start tw:justify-start tw:gap-1.5',
            typeof className === 'function' ? className(state) : className
          )
        }
        ref={ref}>
        {({ isInvalid, isRequired }) => (
          <>
            {label && (
              <Label
                isRequired={
                  hideRequiredIndicator ? !hideRequiredIndicator : isRequired
                }
                tooltip={tooltip}>
                {label}
              </Label>
            )}

            <TextAreaBase
              autoSize={autoSize}
              className={textAreaClassName}
              cols={cols}
              placeholder={placeholder}
              ref={textAreaRef}
              rows={rows}
              size={size}
            />

            {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
          </>
        )}
      </AriaTextField>
    );
  }
);

TextArea.displayName = 'TextArea';
