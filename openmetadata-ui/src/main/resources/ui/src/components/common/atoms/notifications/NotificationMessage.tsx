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

import { iconRingVariants } from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  InfoCircle,
} from '@untitledui/icons';
import { VariantType } from 'notistack';
import React from 'react';

const VARIANT_COLOR_CLASS: Record<VariantType, string> = {
  success: 'tw:text-success-primary',
  error: 'tw:text-error-primary',
  warning: 'tw:text-warning-primary',
  info: 'tw:text-primary',
  default: 'tw:text-gray-700',
};

interface NotificationMessageProps {
  message: string | React.ReactNode;
  variant: VariantType;
}

const NotificationMessage: React.FC<NotificationMessageProps> = ({
  message,
  variant,
}) => {
  const getIcon = () => {
    const iconProps = {
      size: 20,
      color: 'currentColor',
    };

    switch (variant) {
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'error':
        return <AlertCircle {...iconProps} />;
      case 'warning':
        return <AlertTriangle {...iconProps} />;
      case 'info':
        return <InfoCircle {...iconProps} />;
      default:
        return null;
    }
  };

  const icon = getIcon();
  if (!icon) {
    return <>{message}</>;
  }

  return (
    <div className="tw:flex tw:items-center">
      <div
        className={`tw:flex tw:items-center tw:justify-center tw:shrink-0 tw:my-0 tw:mr-4.75 tw:ml-1.25 ${VARIANT_COLOR_CLASS[variant]}`}
        data-testid="alert-icon"
        style={iconRingVariants.notification as React.CSSProperties}>
        {icon}
      </div>
      <div className="tw:flex-1">{message}</div>
    </div>
  );
};

export default NotificationMessage;
