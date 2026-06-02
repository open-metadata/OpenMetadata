/*
 *  Copyright 2023 Collate.
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
import { ErrorTransformer } from '@rjsf/utils';
import { AxiosError } from 'axios';
import { compact, startCase } from 'lodash';
import { InlineAlertProps } from '../components/common/InlineAlert/InlineAlert.interface';
import { HTTP_STATUS_CODE } from '../constants/Auth.constants';
import { t } from './i18next/LocalUtil';
import { getErrorText } from './StringUtils';

export const transformErrors: ErrorTransformer = (errors) => {
  const errorRet = errors.map((error) => {
    const { property, params, name } = error;

    /**
     * For nested fields we have to check if it's property start with "."
     * else we will just prepend the root to property
     */
    const id = property?.startsWith('.')
      ? 'root' + property?.replaceAll('.', '/')
      : `root/${property}`;

    // If element is not present in DOM, ignore error
    if (document.getElementById(id)) {
      const fieldName = startCase(property?.split('/').pop() ?? '');

      const errorMessages = {
        required: () => ({
          message: t('message.field-text-is-required', {
            fieldText: startCase(params?.missingProperty),
          }),
        }),
        minimum: () => ({
          message: t('message.value-must-be-greater-than', {
            field: fieldName,
            minimum: params?.limit,
          }),
        }),
      };

      const errorHandler = errorMessages[name as keyof typeof errorMessages];
      if (errorHandler && params) {
        error.message = errorHandler().message;

        return error;
      }
    }

    return null;
  });

  return compact(errorRet);
};

export const setInlineErrorValue = (
  description: string,
  serverAPIError: string,
  setInlineAlertDetails: (alertDetails?: InlineAlertProps | undefined) => void
) => {
  setInlineAlertDetails({
    type: 'error',
    heading: t('label.error'),
    description,
    subDescription: serverAPIError,
    onClose: () => setInlineAlertDetails(undefined),
  });
};

export const handleEntityCreationError = ({
  error,
  setInlineAlertDetails,
  entity,
  entityLowercase,
  entityLowercasePlural,
  name,
  defaultErrorType,
}: {
  error: AxiosError;
  setInlineAlertDetails: (alertDetails?: InlineAlertProps | undefined) => void;
  entity: string;
  entityLowercase?: string;
  entityLowercasePlural?: string;
  name: string;
  defaultErrorType?: 'create';
}) => {
  if (error.response?.status === HTTP_STATUS_CODE.CONFLICT) {
    setInlineErrorValue(
      t('server.entity-already-exist', {
        entity,
        entityPlural: entityLowercasePlural ?? entity,
        name: name,
      }),
      getErrorText(error, t('server.unexpected-error')),
      setInlineAlertDetails
    );

    return;
  }

  if (error.response?.status === HTTP_STATUS_CODE.LIMIT_REACHED) {
    setInlineErrorValue(
      t('server.entity-limit-reached', {
        entity,
      }),
      getErrorText(error, t('server.unexpected-error')),
      setInlineAlertDetails
    );

    return;
  }

  setInlineErrorValue(
    defaultErrorType === 'create'
      ? t(`server.entity-creation-error`, {
          entity: entityLowercase ?? entity,
        })
      : getErrorText(error, t('server.unexpected-error')),
    getErrorText(error, t('server.unexpected-error')),
    setInlineAlertDetails
  );
};

export const getPopupContainer = (triggerNode: HTMLElement) =>
  triggerNode.parentElement || document.body;

/**
 * Configuration options for custom scroll-to-error behavior
 */
export interface ScrollToErrorOptions {
  /** CSS selector for the scrollable container. Defaults to '.drawer-form-content' for drawer layouts */
  scrollContainer?: string;
  /** CSS selector for form error elements. Defaults to '.ant-form-item-has-error' */
  errorSelector?: string;
  /** Offset from top in pixels for better visibility. Defaults to 100 */
  offsetTop?: number;
  /** Delay in milliseconds before scrolling. Defaults to 100 */
  delay?: number;
  /** Scroll behavior. Defaults to 'smooth' */
  behavior?: ScrollBehavior;
}

/**
 * Creates a reusable scroll-to-error handler for forms in complex layouts
 *
 * This utility is particularly useful when:
 * - Form is inside a drawer or modal with custom scroll containers
 * - Ant Design's built-in scrollToFirstError doesn't work due to layout complexity
 * - Form is nested within grid layouts or other complex structures
 *
 * @param options - Configuration options for scroll behavior
 * @returns Function to be used as onFinishFailed handler for Ant Design forms
 *
 * @example
 * ```tsx
 * // Basic usage for drawer forms
 * const scrollToError = createScrollToErrorHandler();
 *
 * <Form onFinishFailed={scrollToError}>
 *   // form content
 * </Form>
 *
 * // Custom configuration
 * const scrollToError = createScrollToErrorHandler({
 *   scrollContainer: '.my-custom-scroll-container',
 *   offsetTop: 150,
 *   delay: 50
 * });
 * ```
 */
export const createScrollToErrorHandler = (
  options: ScrollToErrorOptions = {}
) => {
  const {
    scrollContainer = '.drawer-form-content',
    errorSelector = '.ant-form-item-has-error',
    offsetTop = 100,
    delay = 100,
    behavior = 'smooth',
  } = options;

  return () => {
    setTimeout(() => {
      const firstError = document.querySelector(errorSelector);
      if (firstError) {
        const scrollableContainer = document.querySelector(scrollContainer);
        if (scrollableContainer) {
          const errorRect = firstError.getBoundingClientRect();
          const containerRect = scrollableContainer.getBoundingClientRect();
          const scrollTop =
            scrollableContainer.scrollTop +
            errorRect.top -
            containerRect.top -
            offsetTop;

          scrollableContainer.scrollTo({
            top: Math.max(0, scrollTop), // Ensure we don't scroll to negative values
            behavior,
          });
        } else {
          // Fallback to standard scrollIntoView if container not found
          firstError.scrollIntoView({
            behavior,
            block: 'center',
            inline: 'nearest',
          });
        }
      }
    }, delay);
  };
};
