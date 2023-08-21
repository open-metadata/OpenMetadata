/*
 *  Copyright 2023 Collate.
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
// skeleton-table.tsx

import { Skeleton, SkeletonProps, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import React from 'react';

export type SkeletonTableColumnsType = {
  key: string;
};

type SkeletonTableProps<T> = SkeletonProps & {
  columns: ColumnsType<T>;
  rowCount?: number;
};

export default function SkeletonTable<T>({
  loading = false,
  active = false,
  rowCount = 5,
  columns,
  children,
  className,
}: SkeletonTableProps<T>): JSX.Element {
  return loading ? (
    <Table
      columns={
        columns.map((column) => {
          return {
            ...column,
            render: function renderPlaceholder() {
              return (
                <Skeleton
                  title
                  active={active}
                  className={className}
                  key={column.key}
                  paragraph={false}
                />
              );
            },
          };
        }) as SkeletonTableColumnsType[]
      }
      dataSource={[...Array(rowCount)].map((_, index) => ({
        key: `key${index}`,
      }))}
      pagination={false}
      rowKey="key"
      size="small"
    />
  ) : (
    <>{children}</>
  );
}
