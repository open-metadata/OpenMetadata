/*
 *  Copyright 2024 Collate.
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
import { AlertProps } from 'antd';
import { create } from 'zustand';

export type AlertType = {
  type: AlertProps['type'];
  message: string | JSX.Element;
};

interface AlertStore {
  alert: AlertType | undefined;
  timeoutId: ReturnType<typeof setTimeout> | null;
  isErrorTimeOut: boolean;
  animationClass: string;
  addAlert: (alert: AlertType, timer?: number) => void;
  resetAlert: VoidFunction;
}

export const useAlertStore = create<AlertStore>()((set, get) => ({
  alert: undefined,
  animationClass: '',
  timeoutId: null,
  isErrorTimeOut: false,
  addAlert: (alert: AlertType, timer?: number) => {
    const { timeoutId } = get();
    set({ alert, animationClass: 'show-alert' });
    if (alert.type === 'error') {
      setTimeout(() => {
        set({ isErrorTimeOut: true });
      }, 5000);
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const autoCloseTimer = timer ?? (alert.type === 'error' ? Infinity : 5000);

    if (autoCloseTimer !== Infinity) {
      const newTimeoutId = setTimeout(() => {
        set({ animationClass: 'hide-alert', alert: undefined });
      }, autoCloseTimer);

      set({ timeoutId: newTimeoutId });
    }
  },
  resetAlert: () => {
    set({ alert: undefined, isErrorTimeOut: false });
  },
}));
