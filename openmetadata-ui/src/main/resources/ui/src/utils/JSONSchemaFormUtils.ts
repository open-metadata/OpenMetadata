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

import { isString } from 'lodash';

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

export function removeAddnFieldsWithDefVal<T>(formData: T): T {
  for (const key in formData) {
    if (typeof formData[key as keyof T] === 'object') {
      removeAddnFieldsWithDefVal(formData[key as keyof T]);
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

export function FormatFormDataForSubmit<T>(formData: T): T {
  escapeBackwardSlashChar(formData);
  removeAddnFieldsWithDefVal(formData);

  return formData;
}
