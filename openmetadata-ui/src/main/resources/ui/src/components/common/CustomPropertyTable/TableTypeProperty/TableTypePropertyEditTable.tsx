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
import DataGrid, { Column, textEditor } from 'react-data-grid';
import { TableTypePropertyEditTableProps } from './TableTypePropertyEditTable.interface';

const TableTypePropertyEditTable = ({
  dataSource,
  columns,
  handleEditDataSource,
  gridContainerRef,
  handleCopy,
  handlePaste,
  pushToUndoStack,
}: TableTypePropertyEditTableProps) => {
  const filterColumns = columns.map((column) => ({
    key: column,
    name: column,
    sortable: false,
    resizable: true,
    cellClass: () => `rdg-cell-${column.replace(/[^a-zA-Z0-9-_]/g, '')}`,
    editable: true,
    renderEditCell: textEditor,
    minWidth: 180,
  }));

  const onEditComplete = (data: Record<string, string>[]) => {
    handleEditDataSource(data);
  };

  return (
    <div className="om-rdg" ref={gridContainerRef}>
      <DataGrid
        className="rdg-light"
        columns={filterColumns as Column<any>[]}
        rows={dataSource}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onRowsChange={(updatedRows) => {
          onEditComplete(updatedRows);
          pushToUndoStack(dataSource);
        }}
      />
    </div>
  );
};

export default TableTypePropertyEditTable;
