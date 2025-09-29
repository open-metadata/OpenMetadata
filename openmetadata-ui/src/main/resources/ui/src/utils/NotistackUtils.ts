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
import { AxiosError } from 'axios';
import { isString } from 'lodash';
import { VariantType } from 'notistack';
import { ClientErrors } from '../enums/Axios.enum';
import i18n from './i18next/LocalUtil';
import { getErrorText } from './StringsUtils';

/**
 * Display an error using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param error error text or AxiosError object
 * @param fallbackText Fallback error message to be displayed
 * @param anchorOrigin Optional position for the snackbar (defaults to top-right)
 */
export const showNotistackError = (
  enqueueSnackbar: (
    message: string,
    options?: {
      variant?: VariantType;
      anchorOrigin?: {
        vertical: 'top' | 'bottom';
        horizontal: 'left' | 'center' | 'right';
      };
    }
  ) => void,
  error: AxiosError | string,
  fallbackText?: string,
  anchorOrigin?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  }
) => {
  let errorMessage: string;

  if (isString(error)) {
    errorMessage = error.toString();
  } else if ('config' in error && 'response' in error) {
    const method = error.config?.method?.toUpperCase();
    const fallback =
      fallbackText && fallbackText.length > 0
        ? fallbackText
        : i18n.t('server.unexpected-error');
    errorMessage = getErrorText(error, fallback);

    // do not show error toasts for 401
    // since they will be intercepted and the user will be redirected to the signin page
    // except for principal domain mismatch errors
    if (
      error &&
      (error.response?.status === ClientErrors.UNAUTHORIZED ||
        (error.response?.status === ClientErrors.FORBIDDEN &&
          method === 'GET')) &&
      !errorMessage.includes('principal domain')
    ) {
      return;
    }
  } else {
    errorMessage = fallbackText ?? i18n.t('server.unexpected-error');
  }

  enqueueSnackbar(errorMessage, {
    variant: 'error',
    anchorOrigin: anchorOrigin || { vertical: 'top', horizontal: 'right' },
  });
};

/**
 * Display a success message using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param message success message
 */
export const showNotistackSuccess = (
  enqueueSnackbar: (
    message: string,
    options?: { variant?: VariantType }
  ) => void,
  message: string
) => {
  enqueueSnackbar(message, { variant: 'success' });
};

/**
 * Display an info message using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param message info message
 */
export const showNotistackInfo = (
  enqueueSnackbar: (
    message: string,
    options?: { variant?: VariantType }
  ) => void,
  message: string
) => {
  enqueueSnackbar(message, { variant: 'info' });
};

/**
 * Display a warning message using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param message warning message
 */
export const showNotistackWarning = (
  enqueueSnackbar: (
    message: string,
    options?: { variant?: VariantType }
  ) => void,
  message: string
) => {
  enqueueSnackbar(message, { variant: 'warning' });
};
