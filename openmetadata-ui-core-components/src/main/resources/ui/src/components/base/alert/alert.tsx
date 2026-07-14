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

import { CloseButton } from '@/components/base/buttons/close-button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { cx } from '@/utils/cx';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  InfoCircle,
} from '@untitledui/icons';
import type { FC, HTMLAttributes, ReactNode } from 'react';

export type AlertVariant = 'success' | 'warning' | 'error' | 'brand' | 'gray';

type FeaturedIconColor = 'brand' | 'gray' | 'success' | 'warning' | 'error';

const variantStyles: Record<
  AlertVariant,
  {
    root: string;
    iconColor: FeaturedIconColor;
    defaultIcon: FC<{ className?: string }>;
  }
> = {
  success: {
    root: 'tw:border-utility-success-300 tw:bg-success-primary',
    iconColor: 'success',
    defaultIcon: CheckCircle,
  },
  warning: {
    root: 'tw:border-utility-warning-300 tw:bg-warning-primary',
    iconColor: 'warning',
    defaultIcon: AlertTriangle,
  },
  error: {
    root: 'tw:border-utility-error-300 tw:bg-error-primary',
    iconColor: 'error',
    defaultIcon: AlertCircle,
  },
  brand: {
    root: 'tw:border-utility-blue-300 tw:bg-utility-blue-50',
    iconColor: 'brand',
    defaultIcon: InfoCircle,
  },
  gray: {
    root: 'tw:border-utility-gray-300 tw:bg-primary',
    iconColor: 'gray',
    defaultIcon: InfoCircle,
  },
};

export interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** success, warning, error, brand or gray */
  variant: AlertVariant;
  /** Bold heading text */
  title: string;
  /** Body content and optional action buttons */
  children?: ReactNode;
  /** Override the default variant icon */
  icon?: FC<{ className?: string }>;
  /** Size forwarded to FeaturedIcon — defaults to 'md' */
  iconSize?: 'sm' | 'md' | 'lg' | 'xl';
  /** 'square' renders the icon in a rounded-rect container instead of a circle */
  iconShape?: 'circle' | 'square';
  /** Corner radius for a square icon container */
  iconRadius?: 'sm' | 'md' | 'lg' | 'xl';
  /** Adds a variant-coloured border around the icon container */
  iconOutlined?: boolean;
  /** 'white' overrides the coloured icon background with a plain white fill */
  iconBgColor?: 'colored' | 'white';
  /** Node rendered on the far right, always vertically centred */
  rightContent?: ReactNode;
  /** Shows the × close button when true. */
  closable?: boolean;
  /** Called when the × close button is clicked. */
  onClose?: () => void;
}

export const Alert = ({
  variant,
  title,
  children,
  icon,
  iconSize = 'md',
  iconShape,
  iconRadius,
  iconOutlined,
  iconBgColor,
  rightContent,
  closable = false,
  onClose,
  className,
  ...props
}: AlertProps) => {
  const styles = variantStyles[variant];
  const Icon = icon ?? styles.defaultIcon;

  return (
    <div
      {...props}
      className={cx(
        'tw:flex tw:w-full tw:gap-3 tw:rounded-xl tw:border tw:px-4',
        children ? 'tw:items-start tw:py-4' : 'tw:items-center tw:py-2',
        styles.root,
        className
      )}
      role="alert">
      <FeaturedIcon
        bgColor={iconBgColor}
        className={cx('tw:shrink-0', children && 'tw:self-start')}
        color={styles.iconColor}
        data-testid="alert-icon"
        icon={Icon}
        outlined={iconOutlined}
        radius={iconRadius}
        shape={iconShape}
        size={iconSize}
      />

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:text-sm">
        <p
          className="tw:font-semibold tw:text-secondary"
          data-testid="alert-title">
          {title}
        </p>

        {children && (
          <div className="tw:text-tertiary" data-testid="alert-children">
            {children}
          </div>
        )}
      </div>

      {rightContent && (
        <div
          className="tw:shrink-0 tw:self-center"
          data-testid="alert-right-content">
          {rightContent}
        </div>
      )}

      {closable && (
        <CloseButton
          className="tw:shrink-0"
          data-testid="alert-close-button"
          label="Close alert"
          size="sm"
          onPress={onClose}
        />
      )}
    </div>
  );
};
