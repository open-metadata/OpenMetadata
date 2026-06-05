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

import { Check } from '@untitledui/icons';
import type { QueuedToast } from '@react-stately/toast';
import { UNSTABLE_Toast as AriaToast } from 'react-aria-components';
import type { ToastContent } from './toast-store';
import { cx } from '@/utils/cx';

interface ToastProps {
  toast: QueuedToast<ToastContent>;
}

export const Toast = ({ toast }: ToastProps) => {
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
      <Check
        aria-hidden="true"
        className="tw:size-4 tw:shrink-0 tw:text-[#17B26A]"
      />
      <span>{toast.content.message}</span>
    </AriaToast>
  );
};
