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
import ReactDataGrid from '@inovua/reactdatagrid-community';
import { TypeEditInfo } from '@inovua/reactdatagrid-community/types';
import { useCallback } from 'react';
import { TableTypePropertyEditTableProps } from './TableTypePropertyEditTable.interface';

let inEdit = false;

const TableTypePropertyEditTable = ({
  dataSource,
  columns,
  gridRef,
  handleEditGridRef,
  handleEditDataSource,
}: TableTypePropertyEditTableProps) => {
  const filterColumns = columns.map((column) => ({
    name: column,
    header: column,
    defaultFlex: 1,
    sortable: false,
    minWidth: 180,
  }));

  const onEditComplete = useCallback(
    ({ value, columnId, rowId }: TypeEditInfo) => {
      const data = [...dataSource];

      data[Number(rowId)][columnId] = value;

      handleEditDataSource(data);
    },
    [dataSource]
  );

  const onEditStart = () => {
    inEdit = true;
  };

  const onEditStop = () => {
    requestAnimationFrame(() => {
      inEdit = false;
      gridRef.current?.focus();
    });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (inEdit) {
      if (event.key === 'Escape') {
        const [rowIndex, colIndex] = gridRef.current?.computedActiveCell ?? [
          0, 0,
        ];
        const column = gridRef.current?.getColumnBy(colIndex);

        gridRef.current?.cancelEdit?.({
          rowIndex,
          columnId: column?.name ?? '',
        });
      }

      return;
    }
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    let [rowIndex, colIndex] = grid.computedActiveCell ?? [0, 0];

    if (event.key === ' ' || event.key === 'Enter') {
      const column = grid.getColumnBy(colIndex);
      grid.startEdit?.({ columnId: column.name ?? '', rowIndex });
      event.preventDefault();

      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const direction = event.shiftKey ? -1 : 1;

    const columns = grid.visibleColumns;
    const rowCount = grid.count;

    colIndex += direction;
    if (colIndex === -1) {
      colIndex = columns.length - 1;
      rowIndex -= 1;
    }
    if (colIndex === columns.length) {
      rowIndex += 1;
      colIndex = 0;
    }
    if (rowIndex < 0 || rowIndex === rowCount) {
      return;
    }

    grid?.setActiveCell([rowIndex, colIndex]);
  };

  return (
    <ReactDataGrid
      editable
      className="edit-table-type-property"
      columns={filterColumns}
      dataSource={dataSource}
      handle={handleEditGridRef}
      idProperty="id"
      minRowHeight={30}
      showZebraRows={false}
      style={{ height: '350px' }}
      onEditComplete={onEditComplete}
      onEditStart={onEditStart}
      onEditStop={onEditStop}
      onKeyDown={onKeyDown}
    />
  );
};

export default TableTypePropertyEditTable;
