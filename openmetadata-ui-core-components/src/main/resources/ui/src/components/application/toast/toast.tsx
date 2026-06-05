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

import type { FC, ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  InfoCircle,
} from '@untitledui/icons';
import { CloseButton } from '@/components/base/buttons/close-button';
import { FeaturedIcon } from '@/components/foundations/featured-icon/featured-icon';
import { cx } from '@/utils/cx';

export type ToastVariant = 'success' | 'error' | 'warning' | 'brand' | 'default';

type FeaturedIconColor = 'brand' | 'gray' | 'success' | 'warning' | 'error';

const variantConfig: Record<
  ToastVariant,
  {
    iconColor: FeaturedIconColor;
    icon: FC<{ className?: string }>;
    showIcon: boolean;
  }
> = {
  success: { iconColor: 'success', icon: CheckCircle, showIcon: true },
  error: { iconColor: 'error', icon: AlertCircle, showIcon: true },
  warning: { iconColor: 'warning', icon: AlertTriangle, showIcon: true },
  brand: { iconColor: 'brand', icon: InfoCircle, showIcon: true },
  default: { iconColor: 'gray', icon: InfoCircle, showIcon: false },
};

export interface ToastProps {
  /** The toast variant — drives the icon and icon color. */
  variant?: ToastVariant;
  /** Primary message text. */
  title: string;
  /** Optional supporting text shown below the title. */
  description?: ReactNode;
  /** Override the variant's default icon. Pass `null` to suppress the icon entirely. */
  icon?: FC<{ className?: string }> | null;
  /** Show the × dismiss button. */
  closable?: boolean;
  /** Called when × is clicked. */
  onClose?: () => void;
  className?: string;
}

export const Toast = ({
  variant = 'default',
  title,
  description,
  icon,
  closable = true,
  onClose,
  className,
}: ToastProps) => {
  const config = variantConfig[variant];
  const showIcon = icon !== null && (icon !== undefined || config.showIcon);
  const Icon = icon ?? config.icon;

  return (
    <div
      className={cx(
        'tw:flex tw:w-full tw:max-w-sm tw:items-start tw:gap-3',
        'tw:rounded-xl tw:border tw:border-primary tw:bg-primary',
        'tw:px-4 tw:py-3 tw:shadow-lg',
        className
      )}
      role="status">
      {showIcon && (
        <FeaturedIcon
          className="tw:mt-0.5 tw:shrink-0"
          color={config.iconColor}
          icon={Icon}
          size="sm"
          theme="light"
        />
      )}

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5">
        <p className="tw:text-sm tw:font-semibold tw:text-primary">{title}</p>

        {description && (
          <p className="tw:text-sm tw:text-tertiary">{description}</p>
        )}
      </div>

      {closable && (
        <CloseButton
          className="tw:-mr-1 tw:-mt-0.5 tw:shrink-0"
          label="Dismiss notification"
          size="xs"
          onPress={onClose}
        />
      )}
    </div>
  );
};
