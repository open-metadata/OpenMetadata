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

import { isObject } from 'lodash';
import { unparse } from 'papaparse';
import { SampleDataType } from './SampleData.interface';

export const stringifySampleDataValue = (value: SampleDataType): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (isObject(value)) {
    return JSON.stringify(value);
  }

  return String(value);
};

export const buildSampleDataCSVContent = (
  columnNames: string[],
  rows: Record<string, SampleDataType>[],
  rowLimit: number
): string => {
  const limitedRows = rows.slice(0, rowLimit);

  const data = limitedRows.map((row) =>
    Object.fromEntries(
      columnNames.map((col) => [col, stringifySampleDataValue(row[col])])
    )
  );

  return unparse(data, {
    columns: columnNames,
    header: true,
    newline: '\n',
  });
};

export const downloadSampleDataCSV = (
  csvContent: string,
  fileName: string
): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();

  URL.revokeObjectURL(link.href);
  document.body.removeChild(link);
};
