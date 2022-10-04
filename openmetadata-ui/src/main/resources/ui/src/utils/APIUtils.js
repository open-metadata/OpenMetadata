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

import { isArray, isObject, transform } from 'lodash';

export const omitDeep = (obj, predicate) => {
  return transform(obj, function (result, value, key) {
    if (isObject(value)) {
      value = omitDeep(value, predicate);
    }
    const doOmit = predicate(value, key);
    if (!doOmit) {
      if (isArray(obj)) {
        result.push(value);
      } else {
        result[key] = value;
      }
    }
  });
};

export const getURLWithQueryFields = (url, lstQueryFields, qParams = '') => {
  let strQuery = lstQueryFields
    ? typeof lstQueryFields === 'string'
      ? lstQueryFields
      : lstQueryFields.length
      ? lstQueryFields.join()
      : ''
    : '';
  strQuery = strQuery.replace(/ /g, '');

  let queryParam = strQuery ? `?fields=${strQuery}` : '';

  if (qParams) {
    queryParam += queryParam ? `&${qParams}` : `?${qParams}`;
  }

  return url + queryParam;
};
