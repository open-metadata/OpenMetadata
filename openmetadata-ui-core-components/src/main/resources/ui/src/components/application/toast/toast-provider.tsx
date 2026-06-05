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

import type { QueuedToast } from '@react-stately/toast';
import { UNSTABLE_ToastRegion as ToastRegion, UNSTABLE_ToastList as ToastList } from 'react-aria-components';
import { Toast } from './toast';
import { toastQueue, type ToastContent } from './toast-store';
import { cx } from '@/utils/cx';

export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'top-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-center';

const positionClasses: Record<ToastPosition, string> = {
  'top-right': 'tw:top-4 tw:right-4 tw:items-end',
  'top-left': 'tw:top-4 tw:left-4 tw:items-start',
  'top-center': 'tw:top-4 tw:left-1/2 tw:-translate-x-1/2 tw:items-center',
  'bottom-right': 'tw:bottom-4 tw:right-4 tw:items-end',
  'bottom-left': 'tw:bottom-4 tw:left-4 tw:items-start',
  'bottom-center': 'tw:bottom-6.5 tw:left-1/2 tw:-translate-x-1/2 tw:items-center',
};

export interface ToastProviderProps {
  position?: ToastPosition;
}

export const ToastProvider = ({ position = 'bottom-center' }: ToastProviderProps) => {
  return (
    <ToastRegion
      className={cx(
        'tw:fixed tw:z-200 tw:flex tw:flex-col tw:gap-2 tw:outline-none',
        positionClasses[position]
      )}
      queue={toastQueue}>
      <ToastList>
        {({ toast }) => <Toast toast={toast as QueuedToast<ToastContent>} />}
      </ToastList>
    </ToastRegion>
  );
};
