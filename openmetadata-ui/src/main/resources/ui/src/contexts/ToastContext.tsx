/*
 *  Copyright 2021 Collate
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

import React, { createContext, ReactNode, useCallback, useState } from 'react';
import Toaster from '../components/common/toaster/Toaster';

interface Toast {
  variant: string;
  body: string;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ToastContext = createContext((_value: Toast) => {
  return;
});

export default ToastContext;

export const ToastContextProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Array<Toast>>([]);

  const addToast = useCallback(
    function (toast) {
      setToasts((toasts) => [...toasts, toast]);
    },
    [setToasts]
  );

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="tw-notification-container">
        <Toaster toastList={toasts} />
      </div>
    </ToastContext.Provider>
  );
};
