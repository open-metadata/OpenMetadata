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

import {
  UNSTABLE_ToastList as ToastList,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import type { QueuedToast } from 'react-aria-components';
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

const positionClasses: Record<ToastPosition, { region: string; list: string }> =
  {
    'top-right': {
      region: 'tw:top-4 tw:right-4 tw:items-end',
      list: 'tw:flex-col',
    },
    'top-left': {
      region: 'tw:top-4 tw:left-4 tw:items-start',
      list: 'tw:flex-col',
    },
    'top-center': {
      region: 'tw:top-4 tw:left-1/2 tw:-translate-x-1/2 tw:items-center',
      list: 'tw:flex-col',
    },
    'bottom-right': {
      region: 'tw:bottom-4 tw:right-4 tw:items-end',
      list: 'tw:flex-col-reverse',
    },
    'bottom-left': {
      region: 'tw:bottom-4 tw:left-4 tw:items-start',
      list: 'tw:flex-col-reverse',
    },
    'bottom-center': {
      region: 'tw:bottom-6.5 tw:left-1/2 tw:-translate-x-1/2 tw:items-center',
      list: 'tw:flex-col-reverse',
    },
  };

export interface ToastProviderProps {
  position?: ToastPosition;
}

export const ToastProvider = ({
  position = 'bottom-center',
}: ToastProviderProps) => {
  const classes = positionClasses[position];

  return (
    <ToastRegion
      className={cx(
        'tw:fixed tw:z-[1000] tw:flex tw:flex-col tw:gap-2 tw:outline-none',
        classes.region
      )}
      queue={toastQueue}>
      <ToastList className={cx('tw:flex tw:gap-2', classes.list)}>
        {({ toast }) => <Toast toast={toast as QueuedToast<ToastContent>} />}
      </ToastList>
    </ToastRegion>
  );
};
