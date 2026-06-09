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
import type { ErrorTransformer } from '@rjsf/utils';
import { compact, startCase } from 'lodash';
import { t } from './i18next/LocalUtil';

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

export const getPopupContainer = (triggerNode: HTMLElement) =>
  triggerNode.parentElement || document.body;

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
            top: Math.max(0, scrollTop),
            behavior,
          });
        } else {
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
