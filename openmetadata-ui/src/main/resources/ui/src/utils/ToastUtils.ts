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

import { AxiosError } from 'axios';
import { isString } from 'lodash';
import { toast } from 'react-toastify';
import jsonData from '../jsons/en';
import { getErrorText } from './StringsUtils';

/**
 * Display an error toast message.
 * @param error error text or AxiosError object
 * @param fallbackText Fallback error message to the displayed.
 */
export const showErrorToast = (
  error: AxiosError | string,
  fallbackText?: string
) => {
  let errorMessage;
  if (isString(error)) {
    errorMessage = error.toString();
  } else {
    const fallback =
      fallbackText && fallbackText.length > 0
        ? fallbackText
        : jsonData['api-error-messages']['unexpected-error'];
    errorMessage = getErrorText(error, fallback);
    // do not show error toasts for 401
    // since they will be intercepted and the user will be redirected to the signin page
    if (error && error.response?.status === 401) {
      return;
    }
  }
  toast.error(errorMessage);
};

/**
 * Display a success toast message.
 * @param message success message.
 */
export const showSuccessToast = (message: string) => {
  toast.success(message, {
    autoClose: 10000,
  });
};

/**
 * Display an info toast message.
 * @param message info message.
 */
export const showInfoToast = (message: string) => {
  toast.info(message, {
    autoClose: 10000,
  });
};

/**
 * Clear all the toast messages.
 */
export const clearAllToasts = () => {
  toast.clearWaitingQueue();
  toast.dismiss();
};
