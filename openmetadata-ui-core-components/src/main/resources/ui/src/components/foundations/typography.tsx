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

import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { cx } from '@/utils/cx';
import type {
  ElementType,
  HTMLAttributeAnchorTarget,
  HTMLAttributes,
  ReactNode,
  Ref,
} from 'react';
import type { PressEvent } from 'react-aria-components';

// `TooltipTrigger` renders a react-aria `Button`, whose `usePress` hook stops
// a completed press from propagating to ancestor DOM listeners by default
// (react-aria's documented behavior: "the default for React Spectrum
// components is not to propagate. This can be overridden by calling
// continuePropagation() on the event" - see
// node_modules/@react-types/shared/src/events.d.ts). For most `TooltipTrigger`
// call sites that is desirable (e.g. a help-icon tooltip nested inside a
// sortable table header should not also trigger the header's sort-on-click).
// But Typography's ellipsis tooltip wraps *arbitrary, non-interactive* text
// content: the wrapper is only there to host the hover/focus tooltip, so a
// click on the truncated text should reach whatever ancestor `onClick` the
// consumer attached (e.g. a selectable card, a persona-switcher row). Calling
// `continuePropagation()` here restores that click, scoped to this call site
// only - it does not change `TooltipTrigger`'s default for its other
// consumers (form-item-label, input, table column header, avatar add button).
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
  // Anchor pass-through, for the `as="a"` shape used by antd `Typography.Link`
  // migrations (see docs/antd-migration/typography.md). `HTMLAttributes`
  // doesn't include these — they're spread onto `Component` at runtime
  // regardless of `as`, so this only widens the type to match existing
  // behavior.
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
// only the element-level `.prose` layer — `--tw-prose-*` vars plus `color`,
// `font-size` and `line-height`, all of which are inherited properties. Setting
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
    style,
    ...otherProps
  } = props;

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

  if (ellipsisTooltip) {
    return (
      <Tooltip title={ellipsisTooltip}>
        <TooltipTrigger
          className="tw:block tw:w-full tw:min-w-0"
          onPress={allowEllipsisTooltipPressToPropagate}>
          <div
            className={cx(
              'prose',
              quoteStyles[quoteVariant],
              ellipsisClassName
            )}>
            <Component {...otherProps} className={innerClassName} style={style}>
              {children}
            </Component>
          </div>
        </TooltipTrigger>
      </Tooltip>
    );
  }

  // Render the element directly when the wrapper would contribute nothing but
  // a block-level box (see UNWRAPPED_ELEMENTS). Ellipsis needs the wrapper to
  // carry its truncation classes, and a non-default quote variant styles its
  // content through `.prose.prose-*-quote :not(...)` — also a descendant
  // selector — so both keep the wrapper.
  const canUnwrap =
    !isEllipsis &&
    quoteVariant === 'default' &&
    UNWRAPPED_ELEMENTS.has(Component);

  if (canUnwrap) {
    return (
      <Component
        {...otherProps}
        className={cx('prose', innerClassName)}
        style={style}>
        {children}
      </Component>
    );
  }

  return (
    <div className={cx('prose', quoteStyles[quoteVariant], ellipsisClassName)}>
      <Component {...otherProps} className={innerClassName} style={style}>
        {children}
      </Component>
    </div>
  );
};

export type {
  TypographyColor,
  TypographyEllipsis,
  TypographyProps,
  TypographyQuoteVariant,
  TypographySize,
  TypographyWeight,
};
