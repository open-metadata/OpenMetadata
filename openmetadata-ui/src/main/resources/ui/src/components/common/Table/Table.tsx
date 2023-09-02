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
import { Skeleton, SpinProps, Table as AntdTable, TableProps } from 'antd';
import { uniqueId } from 'lodash';
import React, { useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
const Table = <T extends object = any>({ loading, ...rest }: TableProps<T>) => {
  const isLoading = useMemo(
    () => (loading as SpinProps)?.spinning ?? (loading as boolean) ?? false,
    [loading]
  );

  if (isLoading) {
    const { columns } = { ...rest };
    const dataSource = [...Array(3)].map(() => ({
      key: `key${uniqueId()}`,
    })) as T[];
    const column = columns?.map((column) => {
      return {
        ...column,
        render: () => (
          <Skeleton
            title
            active={isLoading}
            key={column.key}
            paragraph={false}
          />
        ),
      };
    });

    return (
      <AntdTable
        {...rest}
        columns={column}
        data-testid="skeleton-table"
        dataSource={dataSource}
      />
    );
  }

  return <AntdTable {...rest} />;
};

export default Table;
