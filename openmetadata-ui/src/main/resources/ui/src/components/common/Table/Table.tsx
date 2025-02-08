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
import { SpinProps, Table as AntdTable, TableProps } from 'antd';
import React, { forwardRef, Ref, useMemo } from 'react';
import { useAntdColumnResize } from 'react-antd-column-resize';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import Loader from '../Loader/Loader';

interface TableComponentProps<T> extends TableProps<T> {
  resizableColumns?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
const Table = <T extends object = any>(
  { loading, ...rest }: TableComponentProps<T>,
  ref: Ref<HTMLDivElement> | null | undefined
) => {
  const { resizableColumns, components, tableWidth } = useAntdColumnResize(
    () => ({ columns: rest.columns || [], minWidth: 150 }),
    [rest.columns]
  );

  const isLoading = useMemo(
    () => (loading as SpinProps)?.spinning ?? (loading as boolean) ?? false,
    [loading]
  );

  // TODO: Need to remove the skeleton loading to fix: https://github.com/open-metadata/OpenMetadata/issues/16655
  // Let's circle back once we have a better solution for this.
  //   const dataSource = useMemo(
  //     () => getUniqueArray(SMALL_TABLE_LOADER_SIZE) as T[],
  //     []
  //   );

  //   if (isLoading) {
  //     const { columns } = { ...rest };
  //     const column = columns?.map((column) => {
  //       return {
  //         ...column,
  //         render: () => (
  //           <Skeleton
  //             title
  //             active={isLoading}
  //             key={column.key}
  //             paragraph={false}
  //           />
  //         ),
  //       };
  //     });

  //     return (
  //       <AntdTable
  //         {...rest}
  //         columns={column}
  //         data-testid="skeleton-table"
  //         dataSource={isEmpty(rest.dataSource) ? dataSource : rest.dataSource}
  //         expandable={undefined}
  //       />
  //     );
  //   }

  const resizingTableProps = rest.resizableColumns
    ? {
        columns: resizableColumns,
        components: {
          ...rest.components,
          header: {
            row: rest.components?.header?.row,
            cell: components.header.cell,
          },
        },
        scroll: { x: tableWidth },
      }
    : {};

  return (
    <AntdTable
      {...rest}
      expandable={{ ...getTableExpandableConfig<T>(), ...rest.expandable }}
      loading={{
        spinning: isLoading,
        indicator: <Loader />,
      }}
      locale={{
        ...rest.locale,
        emptyText: isLoading ? null : rest.locale?.emptyText,
      }}
      ref={ref}
      {...resizingTableProps}
    />
  );
};

export default forwardRef<HTMLDivElement, TableComponentProps<any>>(Table);
