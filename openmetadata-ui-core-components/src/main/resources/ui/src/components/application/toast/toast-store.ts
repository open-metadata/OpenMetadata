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

export interface ToastItem {
  id: string;
  message: string;
  /** Auto-dismiss delay in ms. Pass 0 to disable. Default: 2200. */
  duration?: number;
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
  return () => { listeners.delete(listener); };
}

export function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export interface ShowToastOptions {
  message: string;
  duration?: number;
}

export function showToast(options: ShowToastOptions | string): string {
  const id = String(++idCounter);
  const opts = typeof options === 'string' ? { message: options } : options;
  const item: ToastItem = { duration: 2200, ...opts, id };

  toasts = [...toasts, item];
  notify();

  if (item.duration && item.duration > 0) {
    setTimeout(() => dismiss(id), item.duration);
  }

  return id;
}

export const toast = {
  show: showToast,
  dismiss,
};
