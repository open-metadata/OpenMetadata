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
import { cx, sortCx } from '@/utils/cx';
import type { HTMLAttributes, ReactNode } from 'react';
import { createContext, forwardRef, useContext, useMemo } from 'react';

// ─── Size context ──────────────────────────────────────────────────────────────

export type CardSize = 'sm' | 'md' | 'lg';

const CardContext = createContext<{ size: CardSize }>({ size: 'md' });

// ─── Shared size styles ────────────────────────────────────────────────────────

const sizes = sortCx({
  sm: { padding: 'tw:px-4 tw:py-2' },
  md: { padding: 'tw:px-6 tw:py-3' },
  lg: { padding: 'tw:px-8 tw:py-4' },
});

// ─── Root card styles ──────────────────────────────────────────────────────────

export const cardStyles = sortCx({
  common: {
    root: 'tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:relative tw:overflow-hidden tw:rounded-xl tw:transition tw:duration-100',
  },
  variants: {
    default: {
      root: 'tw:ring-1 tw:ring-inset tw:ring-secondary tw:bg-primary',
    },
    elevated: {
      root: 'tw:ring-1 tw:ring-inset tw:ring-secondary tw:bg-primary tw:shadow-md',
    },
    outlined: { root: 'tw:ring-2 tw:ring-inset tw:ring-primary tw:bg-primary' },
    ghost: { root: 'tw:bg-transparent' },
  },
  colors: {
    default: { root: '' },
    brand: {
      root: 'tw:bg-utility-brand-50 tw:ring-1 tw:ring-inset tw:ring-utility-brand-200',
    },
    error: {
      root: 'tw:bg-utility-error-50 tw:ring-1 tw:ring-inset tw:ring-utility-error-200',
    },
    warning: {
      root: 'tw:bg-utility-warning-50 tw:ring-1 tw:ring-inset tw:ring-utility-warning-200',
    },
    success: {
      root: 'tw:bg-utility-success-50 tw:ring-1 tw:ring-inset tw:ring-utility-success-200',
    },
  },
  interactive: { root: 'tw:cursor-pointer' },
  interactiveVariants: {
    default: { root: 'tw:hover:bg-primary_hover tw:hover:ring-primary' },
    elevated: { root: 'tw:hover:bg-primary_hover tw:hover:shadow-lg' },
    outlined: { root: 'tw:hover:bg-secondary tw:hover:ring-primary' },
    ghost: {
      root: 'tw:hover:bg-secondary tw:hover:ring-1 tw:hover:ring-inset tw:hover:ring-secondary',
    },
  },
  selected: { root: 'tw:ring-2 tw:ring-inset tw:ring-brand' },
});

// ─── Sub-component interfaces ──────────────────────────────────────────────────

export interface CardHeaderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const CardHeader = ({
  title,
  subtitle,
  extra,
  className,
  ...props
}: CardHeaderProps) => {
  const { size } = useContext(CardContext);

  return (
    <div
      {...props}
      className={cx(
        'tw:flex tw:items-start tw:justify-between tw:gap-4 tw:border-b tw:border-secondary',
        sizes[size].padding,
        className
      )}>
      {(title || subtitle) && (
        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-0.5">
          {title && (
            <div className="tw:text-sm tw:font-semibold tw:text-primary">
              {title}
            </div>
          )}
          {subtitle && (
            <div className="tw:text-sm tw:text-tertiary">{subtitle}</div>
          )}
        </div>
      )}
      {extra && <div className="tw:shrink-0">{extra}</div>}
    </div>
  );
};
CardHeader.displayName = 'Card.Header';

const CardContent = ({ children, className, ...props }: CardContentProps) => {
  const { size } = useContext(CardContext);

  return (
    <div {...props} className={cx(sizes[size].padding, className)}>
      {children}
    </div>
  );
};
CardContent.displayName = 'Card.Content';

const CardFooter = ({ children, className, ...props }: CardFooterProps) => {
  const { size } = useContext(CardContext);

  return (
    <div
      {...props}
      className={cx(
        'tw:border-t tw:border-secondary',
        sizes[size].padding,
        className
      )}>
      {children}
    </div>
  );
};
CardFooter.displayName = 'Card.Footer';

// ─── Root card ─────────────────────────────────────────────────────────────────

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  variant?: keyof typeof cardStyles.variants;
  color?: keyof typeof cardStyles.colors;
  size?: CardSize;
  isClickable?: boolean;
  isSelected?: boolean;
}

const CardBase = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      children,
      variant = 'default',
      color = 'default',
      size = 'md',
      isClickable = false,
      isSelected = false,
      ...props
    },
    ref
  ) => {
    const contextValue = useMemo(() => ({ size }), [size]);

    return (
      <CardContext.Provider value={contextValue}>
        <div
          ref={ref}
          {...props}
          className={cx(
            cardStyles.common.root,
            cardStyles.variants[variant].root,
            cardStyles.colors[color].root,
            isClickable && cardStyles.interactive.root,
            isClickable && cardStyles.interactiveVariants[variant].root,
            isSelected && cardStyles.selected.root,
            className
          )}>
          {children}
        </div>
      </CardContext.Provider>
    );
  }
);

CardBase.displayName = 'Card';

type CardComponent = typeof CardBase & {
  Header: typeof CardHeader;
  Content: typeof CardContent;
  Footer: typeof CardFooter;
};

export const Card = CardBase as CardComponent;
Card.Header = CardHeader;
Card.Content = CardContent;
Card.Footer = CardFooter;
