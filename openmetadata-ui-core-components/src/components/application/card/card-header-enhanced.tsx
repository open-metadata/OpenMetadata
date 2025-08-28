import type { FC, ReactNode } from 'react';
import { isValidElement } from 'react';
import { DotsVertical } from '@untitledui/icons';
import { Avatar } from '@/components/base/avatar/avatar';
import { Badge } from '@/components/base/badges/badges';
import { cx } from '@/utils/cx';

export interface EnhancedCardHeaderProps {
  /**
   * The main title of the card header
   */
  title: string;

  /**
   * Title variant
   * - 'display-2xl': 72px
   * - 'display-xl': 60px
   * - 'display-lg': 48px
   * - 'display-md': 36px
   * - 'display-sm': 30px
   * - 'xl': 20px
   * - 'lg': 18px
   * - 'md': 16px
   * - 'sm': 14px
   * - 'xs': 12px
   * @default 'lg'
   */
  titleVariant?: 'display-2xl' | 'display-xl' | 'display-lg' | 'display-md' | 'display-sm' | 'xl' | 'lg' | 'md' | 'sm' | 'xs';

  /**
   * Title color
   * @default 'primary'
   */
  titleColor?: 'primary' | 'secondary' | 'tertiary' | 'white' | 'brand';

  /**
   * Badge content to display next to the title
   */
  badge?: ReactNode | string;

  /**
   * Badge color variant
   * @default 'brand'
   */
  badgeColor?: 'gray' | 'brand' | 'error' | 'warning' | 'success';

  /**
   * Description text below the title
   */
  description?: string;

  /**
   * Description color
   * @default 'secondary'
   */
  descriptionColor?: 'primary' | 'secondary' | 'tertiary';

  /**
   * Avatar configuration
   */
  avatar?: {
    src?: string;
    alt?: string;
    name?: string;
    initials?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  };

  /**
   * Email or subtitle to display below the title (when avatar is present)
   */
  subtitle?: string;

  /**
   * Action buttons or content to display on the right
   */
  actions?: ReactNode;

  /**
   * Actions alignment
   * @default 'center'
   */
  actionsAlign?: 'start' | 'center' | 'end';

  /**
   * Show menu button (dots menu)
   */
  menuButton?: boolean | ReactNode;

  /**
   * Callback for menu button click
   */
  onMenuClick?: () => void;

  /**
   * Padding size
   * @default 'md'
   */
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Background color
   * @default 'transparent'
   */
  background?: 'white' | 'gray' | 'primary' | 'transparent';

  /**
   * Border configuration
   */
  border?: {
    show?: boolean;
    side?: 'all' | 'top' | 'bottom' | 'left' | 'right';
    color?: 'lighter' | 'light' | 'default' | 'dark' | 'darker';
    width?: 'xs' | 'sm' | 'md' | 'lg';
  };

  /**
   * Shadow variant
   * @default 'none'
   */
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Make header sticky
   * @default false
   */
  sticky?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Content alignment
   */
  contentClassName?: string;
}

// Title size mappings
const titleSizes = {
  'display-2xl': 'text-7xl leading-[90px]', // 72px
  'display-xl': 'text-6xl leading-[72px]',  // 60px
  'display-lg': 'text-5xl leading-[60px]',  // 48px
  'display-md': 'text-4xl leading-[44px]',  // 36px
  'display-sm': 'text-3xl leading-[38px]',  // 30px
  'xl': 'text-xl leading-7',                 // 20px
  'lg': 'text-lg leading-7',                 // 18px
  'md': 'text-base leading-6',              // 16px
  'sm': 'text-sm leading-5',                // 14px
  'xs': 'text-xs leading-4',                // 12px
};

// Title color mappings
const titleColors = {
  primary: 'text-gray-900',
  secondary: 'text-gray-700',
  tertiary: 'text-gray-600',
  white: 'text-white',
  brand: 'text-brand-600',
};

// Description color mappings
const descriptionColors = {
  primary: 'text-gray-700',
  secondary: 'text-gray-600',
  tertiary: 'text-gray-500',
};

// Padding mappings
const paddingClasses = {
  none: '',
  xs: 'px-3 py-2',
  sm: 'px-4 py-3',
  md: 'px-5 py-4',
  lg: 'px-6 py-5',
  xl: 'px-8 py-6',
};

// Background mappings
const backgroundClasses = {
  white: 'bg-white',
  gray: 'bg-gray-50',
  primary: 'bg-gray-100',
  transparent: 'bg-transparent',
};

// Border color mappings
const borderColorClasses = {
  lighter: 'border-gray-100',
  light: 'border-gray-200',
  default: 'border-gray-300',
  dark: 'border-gray-400',
  darker: 'border-gray-500',
};

// Border width mappings
const borderWidthClasses = {
  xs: 'border-[0.5px]',
  sm: 'border',
  md: 'border-2',
  lg: 'border-4',
};

// Shadow mappings
const shadowClasses = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
};

// Avatar size mappings
const avatarSizes = {
  xs: 'size-8',
  sm: 'size-10',
  md: 'size-12',
  lg: 'size-14',
  xl: 'size-16',
};

// Badge color mappings
const badgeColorMap = {
  gray: 'gray',
  brand: 'brand',
  error: 'error',
  warning: 'warning',
  success: 'success',
};

export const EnhancedCardHeader: FC<EnhancedCardHeaderProps> = ({
  title,
  titleVariant = 'lg',
  titleColor = 'primary',
  badge,
  badgeColor = 'brand',
  description,
  descriptionColor = 'secondary',
  avatar,
  subtitle,
  actions,
  actionsAlign = 'center',
  menuButton,
  onMenuClick,
  padding = 'md',
  background = 'transparent',
  border,
  shadow = 'none',
  sticky = false,
  className,
  contentClassName,
}) => {
  const renderBadge = () => {
    if (!badge) return null;
    
    if (isValidElement(badge)) {
      return badge;
    }
    
    return (
      <Badge color={badgeColorMap[badgeColor] as any} size="sm">
        {badge}
      </Badge>
    );
  };

  const renderMenuButton = () => {
    if (!menuButton) return null;

    if (isValidElement(menuButton)) {
      return menuButton;
    }

    return (
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="p-2 rounded-md hover:bg-gray-100 transition-colors"
      >
        <DotsVertical className="size-5 text-gray-600" />
      </button>
    );
  };

  // Build border classes
  const getBorderClasses = () => {
    if (!border?.show) return '';
    
    const side = border.side || 'all';
    const color = borderColorClasses[border.color || 'light'];
    const width = borderWidthClasses[border.width || 'sm'];
    
    const sideMap = {
      all: width,
      top: `border-t-[${width.replace('border-', '')}]`,
      bottom: `border-b-[${width.replace('border-', '')}]`,
      left: `border-l-[${width.replace('border-', '')}]`,
      right: `border-r-[${width.replace('border-', '')}]`,
    };
    
    return `${sideMap[side]} ${color}`;
  };

  // Actions alignment classes
  const actionsAlignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
  };

  return (
    <div
      className={cx(
        'relative flex flex-row justify-between gap-4',
        paddingClasses[padding],
        backgroundClasses[background],
        getBorderClasses(),
        shadowClasses[shadow],
        actionsAlignClasses[actionsAlign],
        sticky && 'sticky top-0 z-10',
        className
      )}
    >
      {/* Main content section */}
      <div className={cx('flex', avatar ? 'items-start gap-3' : 'flex-col gap-1', contentClassName)}>
        {/* Avatar (if provided) */}
        {avatar && (
          <Avatar
            src={avatar.src}
            alt={avatar.alt}
            initials={avatar.initials || avatar.name?.[0]}
            size={avatar.size || 'md'}
            className={avatarSizes[avatar.size || 'md']}
          />
        )}

        {/* Title and description */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className={cx(
              'font-semibold m-0',
              titleSizes[titleVariant],
              titleColors[titleColor]
            )}>
              {title}
            </h2>
            {renderBadge()}
          </div>
          {(description || subtitle) && (
            <p className={cx(
              'text-base font-medium leading-6 mt-1',
              descriptionColors[descriptionColor]
            )}>
              {subtitle || description}
            </p>
          )}
        </div>
      </div>

      {/* Actions section */}
      <div className="flex items-center gap-3">
        {actions}
        {menuButton && (
          <div className="ml-2">
            {renderMenuButton()}
          </div>
        )}
      </div>
    </div>
  );
};

// Display name for debugging
EnhancedCardHeader.displayName = 'EnhancedCardHeader';