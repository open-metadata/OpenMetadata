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

import type { FC, HTMLAttributes, ReactNode } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  InfoCircle,
} from "@untitledui/icons";
import { CloseButton } from "@/components/base/buttons/close-button";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { cx } from "@/utils/cx";

export type AlertVariant = "success" | "warning" | "error" | "brand" | "gray";

type FeaturedIconColor = "brand" | "gray" | "success" | "warning" | "error";

const variantStyles: Record<
  AlertVariant,
  {
    root: string;
    iconColor: FeaturedIconColor;
    defaultIcon: FC<{ className?: string }>;
  }
> = {
  success: {
    root: "tw:border-utility-success-300 tw:bg-success-25",
    iconColor: "success",
    defaultIcon: CheckCircle,
  },
  warning: {
    root: "tw:border-utility-warning-300 tw:bg-warning-25",
    iconColor: "warning",
    defaultIcon: AlertTriangle,
  },
  error: {
    root: "tw:border-utility-error-300 tw:bg-error-25",
    iconColor: "error",
    defaultIcon: AlertCircle,
  },
  brand: {
    root: "tw:border-utility-blue-300 tw:bg-blue-25",
    iconColor: "brand",
    defaultIcon: InfoCircle,
  },
  gray: {
    root: "tw:border-utility-gray-300 tw:bg-white",
    iconColor: "gray",
    defaultIcon: InfoCircle,
  },
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** success, warning, error, brand or gray */
  variant: AlertVariant;
  /** Bold heading text */
  title: string;
  /** Body content and optional action buttons */
  children?: ReactNode;
  /** Override the default variant icon */
  icon?: FC<{ className?: string }>;
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
      role="alert"
      className={cx(
        "tw:flex tw:w-full tw:gap-3 tw:rounded-xl tw:border tw:px-4",
        children ? "tw:items-start tw:py-4" : "tw:items-center tw:py-2",
        styles.root,
        className,
      )}
    >
      <FeaturedIcon
        icon={Icon}
        color={styles.iconColor}
        theme="light"
        size="md"
        className={cx("tw:shrink-0", children && "tw:self-start")}
      />

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:text-sm">
        <p className="tw:font-semibold tw:text-secondary">{title}</p>

        {children && <div className="tw:text-tertiary">{children}</div>}
      </div>

      {closable && (
        <CloseButton
          size="sm"
          label="Close alert"
          className="tw:shrink-0"
          onPress={onClose}
        />
      )}
    </div>
  );
};
