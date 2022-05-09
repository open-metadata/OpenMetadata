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

import { cloneDeep, isString } from 'lodash';

export function escapeBackwardSlashChar<T>(formData: T): T {
  for (const key in formData) {
    if (typeof formData[key as keyof T] === 'object') {
      escapeBackwardSlashChar(formData[key as keyof T]);
    } else {
      const data = formData[key as keyof T];
      if (isString(data)) {
        formData[key as keyof T] = data.replace(
          /\\n/g,
          '\n'
        ) as unknown as T[keyof T];
      }
    }
  }

  return formData;
}

function formatConnectionFields<T>(formData: T, field: string): T {
  if (formData && formData[field as keyof T]) {
    // Since connection options support value of type string or object
    // try to parse the string value as object
    const options = formData[field as keyof T];

    for (const key in options) {
      const value = options[key];
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        formData[field as keyof T][key] = JSON.parse(value);
      } catch (_) {
        // ignore exception
      }
    }
  }

  return formData;
}

function formatAdditionalProperties<T>(formData: T): T {
  for (const key in formData) {
    if (typeof formData[key as keyof T] === 'object') {
      formatAdditionalProperties(formData[key as keyof T]);
    } else {
      const data = formData[key as keyof T];
      if (
        key.startsWith('newKey') &&
        data === ('New Value' as unknown as T[keyof T])
      ) {
        delete formData[key];
      }
    }
  }

  return formData;
}

export function formatFormDataForSubmit<T>(formData: T): T {
  formData = cloneDeep(formData);
  formData = escapeBackwardSlashChar(formData);
  formData = formatAdditionalProperties(formData);
  formData = formatConnectionFields(formData, 'connectionOptions');
  formData = formatConnectionFields(formData, 'connectionArguments');

  return formData;
}

function formatConnectionFieldsForRender<T>(formData: T, field: string): T {
  if (formData && formData[field as keyof T]) {
    // Since connection options support value of type string or object
    // convert object into string
    const options = formData[field as keyof T];

    for (const key in options) {
      const value = options[key];
      if (typeof value === 'object') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        formData[field as keyof T][key] = JSON.stringify(value);
      }
    }
  }

  return formData;
}

export function formatFormDataForRender<T>(formData: T): T {
  formData = cloneDeep(formData);
  formData = formatConnectionFieldsForRender(formData, 'connectionOptions');
  formData = formatConnectionFieldsForRender(formData, 'connectionArguments');

  return formData;
}
