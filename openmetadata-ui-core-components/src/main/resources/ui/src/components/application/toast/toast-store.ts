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
import type { ToastVariant } from './toast';

export interface ToastItem {
  id: string;
  variant?: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
  closable?: boolean;
  icon?: FC<{ className?: string }> | null;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

let idCounter = 0;

function notify() {
  const snapshot = [...toasts];
  listeners.forEach((l) => l(snapshot));
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => listeners.delete(listener);
}

export function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export interface ShowToastOptions
  extends Omit<ToastItem, 'id'> {}

export function showToast(options: ShowToastOptions): string {
  const id = String(++idCounter);
  const item: ToastItem = { duration: 4000, closable: true, ...options, id };

  toasts = [...toasts, item];
  notify();

  if (item.duration && item.duration > 0) {
    setTimeout(() => dismiss(id), item.duration);
  }

  return id;
}

export const toast = {
  show: showToast,
  success: (title: string, options?: Partial<ShowToastOptions>) =>
    showToast({ ...options, title, variant: 'success' }),
  error: (title: string, options?: Partial<ShowToastOptions>) =>
    showToast({ ...options, title, variant: 'error' }),
  warning: (title: string, options?: Partial<ShowToastOptions>) =>
    showToast({ ...options, title, variant: 'warning' }),
  info: (title: string, options?: Partial<ShowToastOptions>) =>
    showToast({ ...options, title, variant: 'brand' }),
  default: (title: string, options?: Partial<ShowToastOptions>) =>
    showToast({ ...options, title, variant: 'default' }),
  dismiss,
};
