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

import type { FC } from 'react';
import type { QueuedToast } from '@react-stately/toast';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  InfoCircle,
} from '@untitledui/icons';
import {
  Button,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastStateContext,
} from 'react-aria-components';
import { useContext } from 'react';
import { X } from '@untitledui/icons';
import type { ToastContent, ToastVariant } from './toast-store';
import { cx } from '@/utils/cx';

const variantConfig: Record<
  ToastVariant,
  { icon: FC<{ className?: string }>; iconClass: string; showClose: boolean }
> = {
  success: {
    icon: CheckCircle,
    iconClass: 'tw:text-[#17B26A]',
    showClose: false,
  },
  error: {
    icon: AlertCircle,
    iconClass: 'tw:text-[#F04438]',
    showClose: true,
  },
  warning: {
    icon: AlertTriangle,
    iconClass: 'tw:text-[#F79009]',
    showClose: false,
  },
  info: {
    icon: InfoCircle,
    iconClass: 'tw:text-[#2E90FA]',
    showClose: false,
  },
  default: {
    icon: CheckCircle,
    iconClass: 'tw:text-[#17B26A]',
    showClose: false,
  },
};

interface ToastProps {
  toast: QueuedToast<ToastContent>;
}

export const Toast = ({ toast }: ToastProps) => {
  const state = useContext(UNSTABLE_ToastStateContext);
  const { variant = 'default', message } = toast.content;
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <AriaToast
      className={cx(
        'tw:inline-flex tw:items-center tw:gap-2.5',
        'tw:rounded-[10px] tw:bg-[#181D27] tw:px-4 tw:py-[11px]',
        'tw:text-[13px] tw:font-medium tw:leading-5 tw:text-white',
        'tw:shadow-2xl tw:outline-none',
        'tw:animate-in tw:fade-in tw:slide-in-from-bottom-2 tw:duration-150'
      )}
      toast={toast}>
      <Icon
        aria-hidden="true"
        className={cx('tw:size-4 tw:shrink-0', config.iconClass)}
      />
      <span>{message}</span>
      {config.showClose && state && (
        <Button
          aria-label="Close"
          className="tw:-mr-1 tw:ml-1 tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-md tw:p-0.5 tw:text-white/60 tw:outline-none tw:transition tw:hover:text-white"
          slot="close"
          onPress={() => state.close(toast.key)}>
          <X aria-hidden="true" className="tw:size-3.5" />
        </Button>
      )}
    </AriaToast>
  );
};
