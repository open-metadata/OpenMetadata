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
import type {
  ColumnType,
  FilterValue,
  SortOrder,
} from 'antd/lib/table/interface';
import type { ColumnsType } from 'antd/es/table/interface';
import { isEmpty } from 'lodash';
import React, { ReactNode } from 'react';
import type { FlatRow } from './TableV2.interface';

export function flattenTreeRows<T>(
  data: T[],
  getRowKey: (r: T, i: number) => string,
  expandedKeys: Set<string>,
  rowExpandable: ((record: T) => boolean) | undefined,
  depth = 0,
  startIdx = 0
): FlatRow<T>[] {
  const rows: FlatRow<T>[] = [];
  let nextIdx = startIdx;

  for (const record of data) {
    const actualIndex = nextIdx++;
    const rowKey = getRowKey(record, actualIndex);
    const children = (record as Record<string, unknown>).children as
      | T[]
      | undefined;
    const hasChildren = rowExpandable
      ? rowExpandable(record)
      : !isEmpty(children);

    rows.push({ record, depth, actualIndex, hasChildren, rowKey });

    if (hasChildren && expandedKeys.has(rowKey) && children?.length) {
      const childRows = flattenTreeRows(
        children,
        getRowKey,
        expandedKeys,
        rowExpandable,
        depth + 1,
        nextIdx
      );
      rows.push(...childRows);
      nextIdx += childRows.length;
    }
  }

  return rows;
}

export function resolveCellValue<T>(
  col: ColumnType<T>,
  record: T,
  index: number
): ReactNode {
  const { dataIndex, render } = col;
  const rawValue = Array.isArray(dataIndex)
    ? dataIndex.reduce(
        (obj: unknown, key) =>
          (obj as Record<string, unknown>)?.[key as string],
        record as unknown
      )
    : typeof dataIndex === 'string'
    ? (record as Record<string, unknown>)[dataIndex]
    : undefined;

  if (render) {
    const rendered = render(rawValue, record, index);
    if (
      rendered !== null &&
      typeof rendered === 'object' &&
      'children' in rendered &&
      !('$$typeof' in rendered)
    ) {
      return (rendered as { children: ReactNode }).children;
    }

    return rendered as ReactNode;
  }

  return rawValue !== undefined && rawValue !== null ? String(rawValue) : null;
}

export function resolveColumnTitle<T>(
  col: ColumnType<T>,
  propsColumns: ColumnsType<T>
): ReactNode {
  if (typeof col.title === 'function') {
    const sortedColumn = propsColumns.find(
      (c) => (c as ColumnType<T>).sortOrder
    ) as ColumnType<T> | undefined;

    return (
      col.title as (props: {
        sortOrder?: SortOrder;
        sortColumn?: ColumnType<T>;
        filters?: Record<string, FilterValue | null>;
      }) => ReactNode
    )({
      sortOrder: col.sortOrder ?? null,
      sortColumn: sortedColumn,
      filters: {},
    });
  }

  return col.title as ReactNode;
}

/**
 * Returns sticky positioning styles for a fixed column.
 * Note: assumes a single fixed column per side. If multiple columns are fixed
 * to the same side, offsets must be computed by the caller.
 */
export function getColumnStickyStyle(
  fixed: ColumnType<unknown>['fixed'],
  zIndex: number
): React.CSSProperties {
  if (fixed === 'left') {
    return { background: 'white', left: 0, position: 'sticky', zIndex };
  }
  if (fixed === 'right') {
    return { background: 'white', position: 'sticky', right: 0, zIndex };
  }

  return {};
}
