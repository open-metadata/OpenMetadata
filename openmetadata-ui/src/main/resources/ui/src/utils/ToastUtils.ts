/*
 *  Copyright 2022 Collate.
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
import {
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { AlertProps } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isString } from 'lodash';
import React from 'react';
import { ReactComponent as SuccessIcon } from '../assets/svg/ic-alert-success.svg';
import { ClientErrors } from '../enums/Axios.enum';
import { useAlertStore } from '../hooks/useAlertStore';
import i18n from './i18next/LocalUtil';
import { getErrorText } from './StringsUtils';

export const getIconAndClassName = (type: AlertProps['type']) => {
  switch (type) {
    case 'info':
      return {
        icon: InfoCircleOutlined,
        className: 'info',
      };

    case 'success':
      return {
        icon: SuccessIcon,
        className: 'success',
      };

    case 'warning':
      return {
        icon: WarningOutlined,
        className: 'warning',
      };

    case 'error':
      return {
        icon: ExclamationCircleOutlined,
        className: 'error',
      };

    default:
      return {
        icon: null,
        className: '',
      };
  }
};

export const hashCode = (str: string) => {
  let hash = 0,
    i,
    chr;
  if (isEmpty(str)) {
    return hash;
  }
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }

  return hash;
};

/**
 * Display an error toast message.
 * @param error error text or AxiosError object
 * @param fallbackText Fallback error message to the displayed.
 * @param autoCloseTimer Set the delay in ms to close the toast automatically.
 */
export const showErrorToast = (
  error: AxiosError | string | JSX.Element,
  fallbackText?: string,
  autoCloseTimer?: number,
  callback?: (value: React.SetStateAction<string | JSX.Element>) => void
) => {
  let errorMessage;
  if (React.isValidElement(error)) {
    errorMessage = error;
  } else if (isString(error)) {
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
  callback && callback(errorMessage);
  useAlertStore
    .getState()
    .addAlert({ type: 'error', message: errorMessage }, autoCloseTimer);
};

/**
 * Display a success toast message.
 * @param message success message.
 * @param autoCloseTimer Set the delay in ms to close the toast automatically. `Default: 5000`
 */
export const showSuccessToast = (message: string, autoCloseTimer = 5000) => {
  useAlertStore
    .getState()
    .addAlert({ type: 'success', message }, autoCloseTimer);
};

/**
 * Display an info toast message.
 * @param message info message.
 * @param autoCloseTimer Set the delay in ms to close the toast automatically. `Default: 5000`
 */
export const showInfoToast = (message: string, autoCloseTimer = 5000) => {
  useAlertStore.getState().addAlert({ type: 'info', message }, autoCloseTimer);
};
