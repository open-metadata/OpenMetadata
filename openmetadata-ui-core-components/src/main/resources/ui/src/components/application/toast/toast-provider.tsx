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

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from './toast';
import { subscribe, type ToastItem } from './toast-store';

export interface ToastProviderProps {
  /** The DOM node to portal into. Defaults to document.body. */
  container?: Element;
}

export const ToastProvider = ({ container }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribe(setToasts);
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  const portalTarget =
    container ?? (typeof document !== 'undefined' ? document.body : null);

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="tw:pointer-events-none tw:fixed tw:bottom-6.5 tw:left-1/2 tw:z-200 tw:-translate-x-1/2 tw:flex tw:flex-col tw:items-center tw:gap-2"
      role="region">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="tw:pointer-events-auto tw:animate-in tw:fade-in tw:slide-in-from-bottom-2 tw:duration-150">
          <Toast message={t.message} />
        </div>
      ))}
    </div>,
    portalTarget
  );
};
