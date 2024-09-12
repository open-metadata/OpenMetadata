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
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import React from 'react';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';

const LineageDataGrid = () => {
  const { edges } = useLineageProvider();

  const columns = [
    { name: 'name', header: 'From', defaultFlex: 1 },
    { name: 'age', header: 'Age', defaultFlex: 1 },
  ];

  const gridStyle = { minHeight: 550 };

  return (
    <div className="lineage-data-grid p-sm">
      <ReactDataGrid
        columns={columns}
        dataSource={edges}
        idProperty="id"
        style={gridStyle}
      />
    </div>
  );
};

export default LineageDataGrid;
