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
import { IconButton } from '@mui/material';
import { X } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isString } from 'lodash';
import React from 'react';
import NotificationMessage from '../components/common/atoms/notifications/NotificationMessage';
import { ClientErrors } from '../enums/Axios.enum';
import i18n from './i18next/LocalUtil';
import { getErrorText } from './StringsUtils';

const CloseButton = ({ closeSnackbar }: { closeSnackbar?: () => void }) => (
  <IconButton
    data-testid="alert-icon-close"
    size="small"
    sx={{ color: 'currentColor' }}
    onClick={closeSnackbar}>
    <X size={16} />
  </IconButton>
);

/**
 * Display an error using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param error error text or AxiosError object
 * @param fallbackText Fallback error message to be displayed
 * @param anchorOrigin Optional position for the snackbar (defaults to top-right)
 */
export const showNotistackError = (
  enqueueSnackbar: any,
  error: AxiosError | string | React.ReactNode,
  fallbackText?: string,
  anchorOrigin?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  },
  closeSnackbar?: (key?: string | number) => void
) => {
  let errorMessage: string | React.ReactNode;

  if (React.isValidElement(error)) {
    errorMessage = error;
  } else if (isString(error)) {
    errorMessage = error.toString();
  } else if (
    error &&
    typeof error === 'object' &&
    'config' in error &&
    'response' in error
  ) {
    const axiosError = error as AxiosError;
    const method = axiosError.config?.method?.toUpperCase();
    const fallback =
      fallbackText && fallbackText.length > 0
        ? fallbackText
        : i18n.t('server.unexpected-error');
    errorMessage = getErrorText(axiosError, fallback);

    // do not show error toasts for 401
    // since they will be intercepted and the user will be redirected to the signin page
    // except for principal domain mismatch errors
    if (
      axiosError &&
      (axiosError.response?.status === ClientErrors.UNAUTHORIZED ||
        (axiosError.response?.status === ClientErrors.FORBIDDEN &&
          method === 'GET')) &&
      typeof errorMessage === 'string' &&
      !errorMessage.includes('principal domain')
    ) {
      return;
    }
  } else {
    errorMessage = (fallbackText ??
      i18n.t('server.unexpected-error')) as string;
  }

  enqueueSnackbar(
    React.createElement(NotificationMessage, {
      message: errorMessage,
      variant: 'error',
    }),
    {
      variant: 'error',
      anchorOrigin: anchorOrigin || { vertical: 'top', horizontal: 'right' },
      SnackbarProps: {
        'data-testid': 'alert-bar',
      },
      action: closeSnackbar
        ? (snackbarId: string | number) =>
            React.createElement(CloseButton, {
              closeSnackbar: () => closeSnackbar(snackbarId),
            })
        : undefined,
    }
  );
};

/**
 * Display a success message using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param message success message
 */
export const showNotistackSuccess = (
  enqueueSnackbar: any,
  message: string | React.ReactNode,
  closeSnackbar?: (key?: string | number) => void
) => {
  enqueueSnackbar(
    React.createElement(NotificationMessage, {
      message,
      variant: 'success',
    }),
    {
      variant: 'success',
      SnackbarProps: {
        'data-testid': 'alert-bar',
      },
      action: closeSnackbar
        ? (snackbarId: string | number) =>
            React.createElement(CloseButton, {
              closeSnackbar: () => closeSnackbar(snackbarId),
            })
        : undefined,
    }
  );
};

/**
 * Display an info message using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param message info message
 */
export const showNotistackInfo = (
  enqueueSnackbar: any,
  message: string | React.ReactNode,
  closeSnackbar?: (key?: string | number) => void
) => {
  enqueueSnackbar(
    React.createElement(NotificationMessage, {
      message,
      variant: 'info',
    }),
    {
      variant: 'info',
      SnackbarProps: {
        'data-testid': 'alert-bar',
      },
      action: closeSnackbar
        ? (snackbarId: string | number) =>
            React.createElement(CloseButton, {
              closeSnackbar: () => closeSnackbar(snackbarId),
            })
        : undefined,
    }
  );
};

/**
 * Display a warning message using notistack
 * @param enqueueSnackbar notistack's enqueueSnackbar function
 * @param message warning message
 */
export const showNotistackWarning = (
  enqueueSnackbar: any,
  message: string | React.ReactNode,
  closeSnackbar?: (key?: string | number) => void
) => {
  enqueueSnackbar(
    React.createElement(NotificationMessage, {
      message,
      variant: 'warning',
    }),
    {
      variant: 'warning',
      SnackbarProps: {
        'data-testid': 'alert-bar',
      },
      action: closeSnackbar
        ? (snackbarId: string | number) =>
            React.createElement(CloseButton, {
              closeSnackbar: () => closeSnackbar(snackbarId),
            })
        : undefined,
    }
  );
};
