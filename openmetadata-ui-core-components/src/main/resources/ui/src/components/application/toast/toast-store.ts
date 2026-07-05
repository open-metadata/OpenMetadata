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

import type { ReactNode } from 'react';
import { UNSTABLE_ToastQueue as ToastQueue } from 'react-aria-components';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'default';

export interface ToastContent {
  message: string | ReactNode;
  variant: ToastVariant;
}

export const toastQueue = new ToastQueue<ToastContent>({
  maxVisibleToasts: 5,
});

export interface ShowToastOptions {
  /** Whether the toast should dismiss automatically. Defaults to true. */
  autoDismiss?: boolean;
  /** Auto-dismiss delay in ms. Defaults to 3500. Pass 0 to keep the toast until manually dismissed. */
  timeout?: number;
}

function add(
  message: string | ReactNode,
  variant: ToastVariant,
  options?: ShowToastOptions
): string {
  const { autoDismiss = true, timeout = 3500 } = options ?? {};

  return toastQueue.add(
    { message, variant },
    { timeout: autoDismiss ? timeout : 0 }
  );
}

export function showToast(
  message: string | ReactNode,
  options?: ShowToastOptions
): string {
  return add(message, 'default', options);
}

export const toast = {
  show: showToast,
  success: (message: string | ReactNode, options?: ShowToastOptions) =>
    add(message, 'success', options),
  error: (message: string | ReactNode, options?: ShowToastOptions) =>
    add(message, 'error', { timeout: 0, ...options }),
  warning: (message: string | ReactNode, options?: ShowToastOptions) =>
    add(message, 'warning', options),
  info: (message: string | ReactNode, options?: ShowToastOptions) =>
    add(message, 'info', options),
  dismiss: (key: string) => toastQueue.close(key),
};
