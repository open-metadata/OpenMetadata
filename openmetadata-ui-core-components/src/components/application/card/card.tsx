import type { FC, ReactNode } from 'react';
import { cx } from '@/utils/cx';

export interface CardProps {
  /**
   * Border width variant
   * - 'none': no border
   * - 'xs': 0.5px (extra small)
   * - 'sm': 1px (small) - default
   * - 'md': 2px (medium)
   * - 'lg': 4px (large)
   * @default 'sm'
   */
  border?: 'none' | 'xs' | 'sm' | 'md' | 'lg';

  /**
   * Border color variant using Tailwind classes
   * - 'lighter': border-gray-100 (very light gray)
   * - 'light': border-gray-200 (light gray)
   * - 'default': border-gray-300 (default gray)
   * - 'dark': border-gray-400 (dark gray)
   * - 'darker': border-gray-500 (darker gray)
   * @default 'light'
   */
  borderColor?: 'lighter' | 'light' | 'default' | 'dark' | 'darker';

  /**
   * Shadow variant using Tailwind classes
   * @default 'none'
   */
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Border radius using Tailwind classes
   * - 'none': rounded-none (0px)
   * - 'sm': rounded (0.125rem / 2px)
   * - 'md': rounded-md (0.375rem / 6px)
   * - 'lg': rounded-lg (0.5rem / 8px)
   * - 'xl': rounded-xl (0.75rem / 12px) - default
   * - '2xl': rounded-2xl (1rem / 16px)
   * - '3xl': rounded-3xl (1.5rem / 24px)
   * @default 'xl'
   */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

  /**
   * Padding variant
   * @default 'md'
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Background color using Tailwind classes
   * @default 'transparent'
   */
  background?: 'white' | 'gray' | 'transparent';

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Card content
   */
  children: ReactNode;

  /**
   * Click handler
   */
  onClick?: () => void;
}

// Map border width variants to Tailwind classes
const borderClasses = {
  'none': 'border-0',
  'xs': 'border-[0.5px]',
  'sm': 'border',
  'md': 'border-2',
  'lg': 'border-4',
};

// Map border colors to Tailwind classes
const borderColorClasses = {
  'lighter': 'border-gray-100',
  'light': 'border-gray-200',
  'default': 'border-gray-300',
  'dark': 'border-gray-400',
  'darker': 'border-gray-500',
};

// Map shadow variants to Tailwind classes
const shadowClasses = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

// Map radius variants to Tailwind classes
const radiusClasses = {
  none: 'rounded-none',  // 0px
  sm: 'rounded',         // 2px
  md: 'rounded-md',      // 6px
  lg: 'rounded-lg',      // 8px
  xl: 'rounded-xl',      // 12px - default
  '2xl': 'rounded-2xl',  // 16px
  '3xl': 'rounded-3xl',  // 24px
};

// Map padding variants to Tailwind classes
const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10',
};

// Map background variants to Tailwind classes
const backgroundClasses = {
  white: 'bg-white',
  gray: 'bg-gray-50',
  transparent: 'bg-transparent',
};

export const CardRoot: FC<CardProps> = ({
  border = 'sm',
  borderColor = 'light',
  shadow = 'none',
  radius = 'xl',
  padding = 'md',
  background = 'transparent',
  className,
  children,
  onClick,
}) => {
  return (
    <div
      className={cx(
        'relative',
        // Border
        borderClasses[border],
        border !== 'none' && borderColorClasses[borderColor],
        // Shadow
        shadowClasses[shadow],
        // Radius
        radiusClasses[radius],
        // Padding
        paddingClasses[padding],
        // Background
        backgroundClasses[background],
        // Interactive states
        onClick && 'cursor-pointer transition-shadow hover:shadow-lg',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

// Sub-components for composition
export const CardBody: FC<{ children: ReactNode; className?: string; noPadding?: boolean }> = ({
  children,
  className,
  noPadding = false,
}) => {
  return <div className={cx(!noPadding && 'p-6', className)}>{children}</div>;
};

export const CardFooter: FC<{ children: ReactNode; className?: string; divider?: boolean }> = ({
  children,
  className,
  divider = true,
}) => {
  return (
    <div className={cx(
      divider && 'border-t border-gray-200',
      'px-6 py-4',
      className
    )}>
      {children}
    </div>
  );
};

// Display names for debugging
CardRoot.displayName = 'Card';
CardBody.displayName = 'Card.Body';
CardFooter.displayName = 'Card.Footer';