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
import { dismiss, subscribe, type ToastItem } from './toast-store';

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
  'bottom-center':
    'tw:bottom-4 tw:left-1/2 tw:-translate-x-1/2 tw:items-center',
};

export interface ToastProviderProps {
  position?: ToastPosition;
  /** The DOM node to portal into. Defaults to document.body. */
  container?: Element;
}

export const ToastProvider = ({
  position = 'top-right',
  container,
}: ToastProviderProps) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return () => { unsubscribe(); };
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
      className={`tw:pointer-events-none tw:fixed tw:z-[9999] tw:flex tw:flex-col tw:gap-3 ${positionClasses[position]}`}
      role="region">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="tw:pointer-events-auto tw:animate-in tw:fade-in tw:slide-in-from-top-2 tw:duration-200">
          <Toast
            closable={t.closable}
            description={t.description}
            icon={t.icon}
            title={t.title}
            variant={t.variant}
            onClose={() => dismiss(t.id)}
          />
        </div>
      ))}
    </div>,
    portalTarget
  );
};
