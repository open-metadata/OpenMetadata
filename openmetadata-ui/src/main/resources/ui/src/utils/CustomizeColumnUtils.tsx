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
import { ColumnType } from 'antd/lib/table';
import { has } from 'lodash';
import {
  TableColumnDropdownList,
  TableColumns,
} from '../components/common/Table/Table.interface';

export const getCustomizeColumnDetails = <T extends ColumnType<T>>(
  columns: TableColumns<T>[]
) => {
  const result = columns.reduce(
    (acc, item) => {
      const key = item.key as string;
      const isCustomizable = has(item, 'defaultVisible');

      if (isCustomizable) {
        acc.customizeColumns.push(key);
        acc.dropdownColumnList.push({
          label: item.title as string,
          value: key,
        });
        if (item.defaultVisible) {
          acc.columnDropdownSelections.push(key);
        }
      } else {
        acc.staticColumns.push(key);
      }

      return acc;
    },
    {
      staticColumns: [] as string[],
      customizeColumns: [] as string[],
      columnDropdownSelections: [] as string[],
      dropdownColumnList: [] as { label: string; value: string }[],
    }
  );

  return result;
};

export const getReorderedColumns = <T extends ColumnType<T>>(
  updatedColumnDropdownList: TableColumnDropdownList[],
  propsColumns: TableColumns<T>[]
) => {
  // create a map of column positions based on labels
  const orderedColumns: Record<string, number> =
    updatedColumnDropdownList.reduce((acc, curr, index) => {
      acc[curr.label] = index;

      return acc;
    }, {} as Record<string, number>);

  // sort columns based on the order in labels
  return propsColumns.sort((a, b) => {
    const titleA = String(a.title);
    const titleB = String(b.title);
    const indexA = orderedColumns[titleA];
    const indexB = orderedColumns[titleB];

    return indexA - indexB;
  });
};
