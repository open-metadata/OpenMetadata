/*
 *  Copyright 2025 Collate.
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

import { Tooltip } from '@/components/base/tooltip/tooltip';
import { cx } from '@/utils/cx';
import {
  type ElementType,
  type HTMLAttributeAnchorTarget,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  useRef,
  useState,
} from 'react';
import type { PressEvent } from 'react-aria-components';

// Tooltip's auto-generated focusable wrapper uses react-aria's AriaButton,
// whose usePress hook stops press events from propagating to ancestor DOM
// listeners by default. For the ellipsis tooltip we wrap non-interactive text,
// so a click should still reach any ancestor onClick (e.g. a selectable card).
// Calling continuePropagation() restores that, scoped to this call site only.
const allowEllipsisTooltipPressToPropagate = (e: PressEvent) => {
  e.continuePropagation();
};

const lineClampClasses: Record<number, string> = {
  1: 'tw:line-clamp-1',
  2: 'tw:line-clamp-2',
  3: 'tw:line-clamp-3',
  4: 'tw:line-clamp-4',
  5: 'tw:line-clamp-5',
  6: 'tw:line-clamp-6',
  7: 'tw:line-clamp-7',
  8: 'tw:line-clamp-8',
  9: 'tw:line-clamp-9',
  10: 'tw:line-clamp-10',
};

type TypographyQuoteVariant = 'default' | 'centered-quote' | 'minimal-quote';

type TypographySize =
  | 'text-xs'
  | 'text-sm'
  | 'text-md'
  | 'text-lg'
  | 'text-xl'
  | 'display-xs'
  | 'display-sm'
  | 'display-md'
  | 'display-lg'
  | 'display-xl'
  | 'display-2xl';

type TypographyWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * Semantic text color, mirroring antd Typography's `type` prop
 * ("secondary" | "success" | "warning" | "danger") so migrated call sites
 * have a first-class equivalent instead of a per-site `className` override.
 */
type TypographyColor = 'secondary' | 'success' | 'warning' | 'danger';

type EllipsisRows = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

type TypographyEllipsis =
  | boolean
  | {
      rows?: EllipsisRows;
      tooltip?: ReactNode;
      /**
       * Render the tooltip trigger as a plain span instead of a `<button>`.
       * Set it when the text sits inside a link, button or other interactive
       * element: a nested button is invalid HTML and adds a second tab stop.
       * Hover still opens the tooltip; keyboard focus belongs to the ancestor.
       */
      excludeTriggerFromTabOrder?: boolean;
    };

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
  as?: ElementType;
  quoteVariant?: TypographyQuoteVariant;
  className?: string;
  size?: TypographySize;
  weight?: TypographyWeight;
  color?: TypographyColor;
  ellipsis?: TypographyEllipsis;
  tooltip?: ReactNode;
  // Anchor pass-through, for the `as="a"` shape used by antd `Typography.Link`
  // migrations. `HTMLAttributes` doesn't include these — they're spread onto
  // `Component` at runtime regardless of `as`, so this only widens the type to
  // match existing behaviour.
  href?: string;
  target?: HTMLAttributeAnchorTarget;
  rel?: string;
}

// `styles/typography.css` applies its real typographic rules through a
// *descendant* selector (`.prose :not(...)`), and every rule inside it is
// gated on an element type — `p`, `h1`-`h6`, `ol`, `ul`, `li`, `blockquote`,
// `a`, `code`, `pre`, `img`, `figure`, table elements. For those, the wrapper
// is load-bearing: moving `prose` onto the element itself would stop the rule
// matching (e.g. a `p` would silently lose its margins).
//
// `span` and `div` are targeted by no such rule, so the wrapper contributes
// only the element-level `.prose` layer — `--tw-prose-*` vars, plus `color`
// inside a link — all of which are inherited properties. Setting
// `prose` directly on the element therefore yields an identical computed style
// on the text, while dropping a block-level `<div>` that otherwise breaks
// inline flow and produces invalid `<div>`-inside-`<span>` nesting when
// Typography is nested. Kept as a deliberately small allowlist: anything not
// listed here keeps the wrapper.
//
// Typed as `unknown` so membership can be tested without a `typeof Component
// === 'string'` guard: that guard narrows `Component` to `string` in the JSX
// below, which TypeScript then resolves to an arbitrary intrinsic element.
const UNWRAPPED_ELEMENTS = new Set<unknown>(['span', 'div']);

// Ellipsis on these keeps them in the text flow (inline-block, capped at the
// container width) instead of breaking the line with a block wrapper.
const INLINE_ELEMENTS = new Set<unknown>(['span', 'a']);

const overflows = (el: Element | null, rows: number) =>
  !!el &&
  (rows > 1
    ? el.scrollHeight > el.clientHeight
    : el.scrollWidth > el.clientWidth);

// The clamp classes sit on both the wrapper and the inner element. A block
// inner element clips its own overflow, so the wrapper never sees it — check
// the inner element too.
const isTruncated = (wrapper: HTMLElement | null, rows: number) =>
  overflows(wrapper, rows) ||
  overflows(wrapper?.firstElementChild ?? null, rows);

// Marks a Typography root so `styles/typography.css` can keep article-prose
// link styling (always underlined, weight 400) off links nested in UI text.
const TYPOGRAPHY_ROOT = 'prose-typography';

// The tooltip trigger is a <button>, whose UA `text-align: center` would
// otherwise centre short text; cursor-[inherit] likewise overrides the UA
// `cursor: default`, which would beat a clickable ancestor's pointer.
const TOOLTIP_TRIGGER =
  'tw:min-w-0 tw:cursor-[inherit] tw:[text-align:inherit]';

const quoteStyles: Record<TypographyQuoteVariant, string> = {
  default: '',
  'centered-quote': 'prose-centered-quote',
  'minimal-quote': 'prose-minimal-quote',
};

const sizeClasses: Record<TypographySize, string> = {
  'text-xs': 'tw:text-xs',
  'text-sm': 'tw:text-sm',
  'text-md': 'tw:text-md',
  'text-lg': 'tw:text-lg',
  'text-xl': 'tw:text-xl',
  'display-xs': 'tw:text-display-xs',
  'display-sm': 'tw:text-display-sm',
  'display-md': 'tw:text-display-md',
  'display-lg': 'tw:text-display-lg',
  'display-xl': 'tw:text-display-xl',
  'display-2xl': 'tw:text-display-2xl',
};

const weightClasses: Record<TypographyWeight, string> = {
  regular: 'tw:font-normal',
  medium: 'tw:font-medium',
  semibold: 'tw:font-semibold',
  bold: 'tw:font-bold',
};

// Established idiom already in use across core components (see tree.tsx,
// pagination.tsx, empty-placeholder, form-field) and the existing per-site
// `className="tw:text-tertiary"` workaround this prop replaces.
const colorClasses: Record<TypographyColor, string> = {
  secondary: 'tw:text-tertiary',
  success: 'tw:text-success-primary',
  warning: 'tw:text-warning-primary',
  danger: 'tw:text-error-primary',
};

export const Typography = (props: TypographyProps) => {
  const {
    as: Component = 'span',
    quoteVariant = 'default',
    className,
    children,
    size,
    weight,
    color,
    ellipsis,
    tooltip,
    style,
    ...otherProps
  } = props;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isEllipsisTooltipOpen, setIsEllipsisTooltipOpen] = useState(false);

  const sizeClass = size ? sizeClasses[size] : undefined;
  const weightClass = weight ? weightClasses[weight] : undefined;
  const colorClass = color ? colorClasses[color] : undefined;

  const ellipsisConfig = typeof ellipsis === 'object' ? ellipsis : undefined;
  const isEllipsis = !!ellipsis;
  const ellipsisRows = ellipsisConfig?.rows ?? 1;
  const ellipsisTooltip =
    ellipsisConfig?.tooltip === true ? children : ellipsisConfig?.tooltip;

  const getEllipsisClassName = () => {
    if (ellipsisRows <= 1) {
      return 'tw:truncate';
    }

    return lineClampClasses[ellipsisRows];
  };

  const ellipsisClassName = isEllipsis ? getEllipsisClassName() : undefined;

  // `cx` (twMerge) resolves conflicting classes in favor of whichever is
  // passed last, so `colorClass` is placed before `className` here: an
  // explicit consumer `className` text-color utility still wins over the
  // `color` prop, matching how `className` already overrides `sizeClass`/
  // `weightClass` above.
  const innerClassName = cx(
    sizeClass,
    weightClass,
    colorClass,
    className,
    ellipsisClassName
  );

  // Drop the wrapper when it would contribute nothing but a block-level box
  // (see UNWRAPPED_ELEMENTS). Ellipsis needs the wrapper to carry its
  // truncation classes, and a non-default quote variant styles its content
  // through `.prose.prose-*-quote :not(...)` — also a descendant selector — so
  // both keep it. Deciding this from the element type means call sites do not
  // have to know the rule, and cannot get it wrong by passing a flag next to
  // an `ellipsis` or quote variant that silently needs the wrapper.
  const canUnwrap =
    !isEllipsis &&
    quoteVariant === 'default' &&
    UNWRAPPED_ELEMENTS.has(Component);

  const element = (
    <Component
      {...otherProps}
      className={
        canUnwrap
          ? cx('prose', TYPOGRAPHY_ROOT, innerClassName)
          : innerClassName
      }
      style={style}>
      {children}
    </Component>
  );

  const isInlineEllipsis = isEllipsis && INLINE_ELEMENTS.has(Component);
  const Wrapper = isInlineEllipsis ? 'span' : 'div';

  const content = canUnwrap ? (
    element
  ) : (
    <Wrapper
      className={cx(
        'prose',
        TYPOGRAPHY_ROOT,
        quoteStyles[quoteVariant],
        ellipsisClassName,
        isInlineEllipsis &&
          'tw:inline-block tw:min-w-0 tw:max-w-full tw:align-bottom'
      )}
      ref={wrapperRef}>
      {element}
    </Wrapper>
  );

  if (ellipsisTooltip) {
    return (
      <Tooltip
        excludeTriggerFromTabOrder={ellipsisConfig?.excludeTriggerFromTabOrder}
        isOpen={isEllipsisTooltipOpen}
        title={ellipsisTooltip}
        triggerClassName={cx(
          TOOLTIP_TRIGGER,
          isInlineEllipsis
            ? // inline-flex, not inline-block: an inline-block child would sit
              // in the button's own line box, whose inherited line-height adds
              // ~2px under the text and shifts everything below it.
              'tw:inline-flex tw:max-w-full tw:align-bottom'
            : 'tw:block tw:w-full'
        )}
        onOpenChange={(isOpen) =>
          // The full text is only worth a tooltip when it is actually cut off.
          setIsEllipsisTooltipOpen(
            isOpen && isTruncated(wrapperRef.current, ellipsisRows)
          )
        }
        onTriggerPress={allowEllipsisTooltipPressToPropagate}>
        {content}
      </Tooltip>
    );
  }

  if (tooltip) {
    return (
      <Tooltip
        title={tooltip}
        triggerClassName={TOOLTIP_TRIGGER}
        onTriggerPress={allowEllipsisTooltipPressToPropagate}>
        {content}
      </Tooltip>
    );
  }

  return content;
};

export type {
  TypographyColor,
  TypographyEllipsis,
  TypographyProps,
  TypographyQuoteVariant,
  TypographySize,
  TypographyWeight,
};
