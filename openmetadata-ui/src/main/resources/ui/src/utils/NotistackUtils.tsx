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
import { toast } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isString } from 'lodash';
import React from 'react';
import { ClientErrors } from '../enums/Axios.enum';
import i18n from './i18next/LocalUtil';
import { getErrorText } from './StringUtils';

const isSuppressedAuthError = (
  error: AxiosError,
  message: string | React.ReactNode
): boolean => {
  const method = error.config?.method?.toUpperCase();

  return (
    (error.response?.status === ClientErrors.UNAUTHORIZED ||
      (error.response?.status === ClientErrors.FORBIDDEN &&
        method === 'GET')) &&
    typeof message === 'string' &&
    !message.includes('principal domain')
  );
};

const resolveErrorMessage = (
  error: AxiosError | string | React.ReactNode,
  fallbackText?: string
): { message: string | React.ReactNode; suppressed: boolean } => {
  let message: string | React.ReactNode;
  let suppressed = false;

  if (React.isValidElement(error)) {
    message = error;
  } else if (isString(error)) {
    message = error.toString();
  } else if (
    error &&
    typeof error === 'object' &&
    'config' in error &&
    'response' in error
  ) {
    const axiosError = error as AxiosError;
    const fallback =
      fallbackText && fallbackText.length > 0
        ? fallbackText
        : String(i18n.t('server.unexpected-error'));
    message = getErrorText(axiosError, fallback);
    suppressed = isSuppressedAuthError(axiosError, message);
  } else {
    message = fallbackText ?? String(i18n.t('server.unexpected-error'));
  }

  return { message, suppressed };
};

/**
 * Display an error toast.
 * @param error error text or AxiosError object
 * @param fallbackText Fallback error message to be displayed
 */
export const showNotistackError = (
  error: AxiosError | string | React.ReactNode,
  fallbackText?: string
) => {
  const { message, suppressed } = resolveErrorMessage(error, fallbackText);

  if (!suppressed) {
    toast.error(message);
  }
};

/**
 * Display a success toast.
 * @param message success message
 */
export const showNotistackSuccess = (message: string | React.ReactNode) => {
  toast.success(message);
};

/**
 * Display an info toast.
 * @param message info message
 */
export const showNotistackInfo = (message: string | React.ReactNode) => {
  toast.info(message);
};

/**
 * Display a warning toast.
 * @param message warning message
 */
export const showNotistackWarning = (message: string | React.ReactNode) => {
  toast.warning(message);
};
