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
import { TableColumnDropdownList } from '../components/common/Table/Table.interface';

/**
 * Get customizable column details for table dropdown
 * @param columns - Table columns configuration
 * @param staticVisibleColumns - List of static visible column keys
 * @returns Array of customizable columns for dropdown
 */
export const getCustomizeColumnDetails = <T extends ColumnType<T>>(
  columns?: ColumnType<T>[],
  staticVisibleColumns?: string[]
): TableColumnDropdownList[] => {
  if (!columns?.length) {
    return [];
  }

  return columns
    .filter(
      (item) => !(staticVisibleColumns ?? []).includes(item.key as string)
    )
    .map((item) => ({
      label: item.title as string,
      value: item.key as string,
    }));
};

/**
 * Reorder columns based on the order in labels
 * @param updatedColumnDropdownList - List of updated column dropdown list
 * @param oldColumns - List of old columns
 * @returns Reordered columns
 */
export const getReorderedColumns = <T extends ColumnType<T>>(
  updatedColumnDropdownList: TableColumnDropdownList[],
  oldColumns: ColumnType<T>[]
) => {
  // create a map of column positions based on labels
  const orderedColumns: Record<string, number> =
    updatedColumnDropdownList.reduce((acc, curr, index) => {
      acc[curr.label] = index;

      return acc;
    }, {} as Record<string, number>);

  // sort columns based on the order in labels
  // creating a new reference for oldColumns, so that the useAntdColumnResize hook is triggered
  return [...oldColumns].sort((a, b) => {
    const titleA = String(a.title);
    const titleB = String(b.title);
    const indexA = orderedColumns[titleA];
    const indexB = orderedColumns[titleB];

    return indexA - indexB;
  });
};
