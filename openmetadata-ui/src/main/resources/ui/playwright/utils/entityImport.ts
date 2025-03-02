/*
 *  Copyright 2025 Collate.
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
import { isEmpty } from 'lodash';

type ParsedDataType<T> = Array<T>;

export const parseCSV = <T extends Record<string, unknown>>(
  csvData: string[][]
): ParsedDataType<T> => {
  const recordList: ParsedDataType<T> = [];

  if (!isEmpty(csvData)) {
    const [headers, ...data] = csvData;

    data.forEach((line) => {
      const record: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        record[header] = line[index] as unknown;
      });

      recordList.push(record as T);
    });
  }

  return recordList;
};
