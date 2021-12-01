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

import { JSON_TAB_SIZE } from '../../constants/constants';
import { getJSONFromString } from '../../utils/StringsUtils';

export const getSchemaEditorValue = (
  value: string,
  autoFormat = true
): string => {
  if (typeof value === 'string') {
    if (autoFormat) {
      const parsedJson = getJSONFromString(value);

      return parsedJson
        ? JSON.stringify(parsedJson, null, JSON_TAB_SIZE)
        : value;
    } else {
      return value;
    }
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, JSON_TAB_SIZE);
  }

  return '';
};
