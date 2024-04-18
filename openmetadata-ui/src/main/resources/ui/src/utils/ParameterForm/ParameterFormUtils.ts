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
import i18next from '../../utils/i18next/LocalUtil';

export const validateGreaterThanOrEquals = (
  fieldValue: number,
  value: number
) => {
  if (fieldValue > value) {
    return Promise.reject(new Error(i18next.t('message.maximum-value-error')));
  }

  return Promise.resolve();
};

export const validateLessThanOrEquals = (fieldValue: number, value: number) => {
  if (fieldValue < value) {
    return Promise.reject(new Error(i18next.t('message.minimum-value-error')));
  }

  return Promise.resolve();
};

export const validateEquals = (fieldValue: number, value: number) => {
  if (fieldValue !== value) {
    return Promise.reject(
      new Error(
        i18next.t('message.value-should-equal-to-value', { value: fieldValue })
      )
    );
  }

  return Promise.resolve();
};

export const validateNotEquals = (fieldValue: number, value: number) => {
  if (fieldValue === value) {
    return Promise.reject(
      new Error(
        i18next.t('message.value-should-not-equal-to-value', {
          value: fieldValue,
        })
      )
    );
  }

  return Promise.resolve();
};
