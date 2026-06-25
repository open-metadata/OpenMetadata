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
  X,
} from '@untitledui/icons';
import {
  Button,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastStateContext,
} from 'react-aria-components';
import type { QueuedToast } from 'react-aria-components';
import { useContext } from 'react';
import type { ToastContent, ToastVariant } from './toast-store';
import { cx } from '@/utils/cx';

const variantConfig: Record<
  ToastVariant,
  { icon: FC<{ className?: string }>; iconClass: string; showClose: boolean }
> = {
  success: {
    icon: CheckCircle,
    iconClass: 'tw:text-fg-success-secondary',
    showClose: false,
  },
  error: {
    icon: AlertCircle,
    iconClass: 'tw:text-fg-error-secondary',
    showClose: true,
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'tw:text-fg-warning-secondary',
    showClose: false,
  },
  info: {
    icon: InfoCircle,
    iconClass: 'tw:text-fg-brand-secondary',
    showClose: false,
  },
  default: {
    icon: CheckCircle,
    iconClass: 'tw:text-fg-success-secondary',
    showClose: false,
  },
};

interface ToastProps {
  toast: QueuedToast<ToastContent>;
}

export const Toast = ({ toast }: ToastProps) => {
  const state = useContext(UNSTABLE_ToastStateContext);
  const { variant = 'default', message: messageOrNode } = toast.content;
  const config = variantConfig[variant];
  const Icon = config.icon;
  const showClose = config.showClose || toast.timeout === 0;

  return (
    <AriaToast
      className={cx(
        'tw:inline-flex tw:items-center tw:gap-2.5',
        'tw:rounded-[10px] tw:bg-primary-solid tw:px-4 tw:py-2.75',
        'tw:text-sm tw:font-medium tw:text-fg-white',
        'tw:shadow-2xl tw:outline-none',
        'tw:animate-in tw:fade-in tw:slide-in-from-bottom-2 tw:duration-150'
      )}
      data-testid="alert-bar"
      toast={toast}>
      <span className="tw:flex tw:shrink-0" data-testid="alert-icon">
        <Icon
          aria-hidden="true"
          className={cx('tw:size-4', config.iconClass)}
        />
      </span>
      {typeof messageOrNode === 'string' ? (
        <span>{messageOrNode}</span>
      ) : (
        (messageOrNode as ReactNode)
      )}
      {showClose && state && (
        <Button
          aria-label="Close"
          className="tw:-mr-1 tw:ml-1 tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-md tw:p-0.5 tw:text-fg-white/60 tw:outline-none tw:transition tw:hover:bg-white/10 tw:hover:text-fg-white"
          data-testid="alert-icon-close"
          slot="close"
          onPress={() => state.close(toast.key)}>
          <X aria-hidden="true" className="tw:size-3.5" />
        </Button>
      )}
    </AriaToast>
  );
};
