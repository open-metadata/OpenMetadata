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
import { useMemo } from 'react';
import DataGrid from 'react-data-grid';
import { TableTypePropertyEditTableProps } from './TableTypePropertyEditTable.interface';

const TableTypePropertyEditTable = ({
  dataSource,
  columns,
  setGridContainer,
  handleCopy,
  handlePaste,
  handleOnRowsChange,
}: TableTypePropertyEditTableProps) => {
  return useMemo(() => {
    return (
      <div className="om-rdg" ref={setGridContainer}>
        <DataGrid
          className="rdg-light"
          columns={columns}
          rows={dataSource}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onRowsChange={handleOnRowsChange}
        />
      </div>
    );
  }, [columns, dataSource, handleCopy, handlePaste, handleOnRowsChange]);
};

export default TableTypePropertyEditTable;
