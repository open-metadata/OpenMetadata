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
import { ShowToastOptions, toast } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { get, isString } from 'lodash';
import React from 'react';
import { ReactComponent as SuccessIcon } from '../assets/svg/ic-alert-success.svg';
import { AlertBarProps } from '../components/AlertBar/AlertBar.interface';
import { ClientErrors, ErrorTypes } from '../enums/Axios.enum';
import i18n from './i18next/LocalUtil';
import { getErrorText } from './StringUtils';

export const getIconAndClassName = (type: AlertBarProps['type']) => {
  switch (type) {
    case 'info':
      return {
        icon: InfoCircleOutlined,
        className: 'info',
        type: 'info',
      };

    case 'grey-info':
      return {
        icon: InfoCircleOutlined,
        className: 'grey-info',
        type: 'info',
      };

    case 'success':
      return {
        icon: SuccessIcon,
        className: 'success',
        type: 'success',
      };

    case 'warning':
      return {
        icon: WarningOutlined,
        className: 'warning',
        type: 'warning',
      };

    case 'error':
      return {
        icon: ExclamationCircleOutlined,
        className: 'error',
        type: 'error',
      };

    default:
      return {
        icon: null,
        className: '',
        type: 'info',
      };
  }
};

/**
 * Display an error toast message.
 * @param error error text or AxiosError object
 * @param fallbackText Fallback error message to be displayed.
 * @param autoCloseTimer Set the delay in ms to close the toast automatically.
 */
export const showErrorToast = (
  error: AxiosError | string | JSX.Element,
  fallbackText?: string,
  autoCloseTimer?: number,
  callback?: (value: React.SetStateAction<string | JSX.Element>) => void
) => {
  let errorMessage;
  let isRuleViolation = false;
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
    isRuleViolation =
      get(error, 'response.data.errorType') === ErrorTypes.RULE_VIOLATION;
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

  if (isRuleViolation) {
    toast.warning(errorMessage, { timeout: autoCloseTimer ?? 5000 });
  } else {
    toast.error(errorMessage, autoCloseTimer ? { timeout: autoCloseTimer } : {});
  }
};

/**
 * Display a success toast message.
 * @param message success message.
 * @param autoCloseTimer Set the delay in ms to close the toast automatically. `Default: 5000`
 */
export const showSuccessToast = (message: string, autoCloseTimer = 5000) => {
  toast.success(message, { timeout: autoCloseTimer });
};

/**
 * Display a warning toast message.
 * @param message warning message.
 * @param autoCloseTimer Set the delay in ms to close the toast automatically. `Default: 5000`
 */
export const showWarningToast = (message: string, autoCloseTimer = 5000) => {
  toast.warning(message, { timeout: autoCloseTimer });
};

/**
 * Display an info toast message.
 * @param message info message.
 * @param autoCloseTimer Set the delay in ms to close the toast automatically. `Default: 5000`
 */
export const showInfoToast = (message: string, autoCloseTimer = 5000) => {
  toast.info(message, { timeout: autoCloseTimer });
};
