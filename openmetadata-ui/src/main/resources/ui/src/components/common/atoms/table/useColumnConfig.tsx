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

import { useMemo } from 'react';
import { ColumnConfig } from '../shared/types';

interface UseColumnConfigProps<T> {
  columns: ColumnConfig<T>[];
}

export const useColumnConfig = <T,>(props: UseColumnConfigProps<T>) => {
  const { columns } = props;

  const columnMap = useMemo(() => {
    const map: Record<string, ColumnConfig<T>> = {};
    columns.forEach((column) => {
      map[column.key] = column;
    });

    return map;
  }, [columns]);

  const getColumn = useMemo(
    () =>
      (key: string): ColumnConfig<T> | undefined => {
        return columnMap[key];
      },
    [columnMap]
  );

  const getColumnKeys = useMemo(() => {
    return columns.map((column) => column.key);
  }, [columns]);

  return {
    columns,
    columnMap,
    getColumn,
    getColumnKeys,
  };
};
