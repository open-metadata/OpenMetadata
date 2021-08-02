/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { lowerCase } from 'lodash';
import { ColumnJoins, MockColumn, TableColumn } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { fetchData } from '../../pages/my-data-details/index.mock';
import Searchbar from '../common/searchbar/Searchbar';
import SampleDataTable from './SampleDataTable';
import SchemaTable from './SchemaTable';

type Props = {
  columns: Array<TableColumn>;
  joins: Array<ColumnJoins>;
  onUpdate: (columns: Array<TableColumn>) => void;
};

const SchemaTab: FunctionComponent<Props> = ({
  columns,
  joins,
  onUpdate,
}: Props) => {
  const [data, setData] = useState<Array<Record<string, string>>>([]);
  const [searchText, setSearchText] = useState('');
  const [checkedValue] = useState('schema');
  const [mockColumns, setMockColumns] = useState<Array<MockColumn>>([]);

  useEffect(() => {
    const schemaDetails = fetchData();
    setData(schemaDetails.data);
    // TODO remove this to show actual columns from tables api
    setMockColumns(schemaDetails.columns);
  }, []);

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  // const handleToggleChange = (value: string) => {
  //   setCheckedValue(value);
  // };

  // const getToggleButtonClasses = (type: string): string => {
  //   return (
  //     'tw-flex-1 tw-text-primary tw-font-medium tw-border tw-border-transparent
  //      tw-rounded-md tw-py-1 tw-px-2 focus:tw-outline-none' +
  //     (type === checkedValue ? ' tw-bg-blue-100 tw-border-blue-100' : '')
  //   );
  // };

  return (
    <div>
      <div className="tw-grid tw-grid-cols-3 tw-gap-x-2">
        <div>
          <Searchbar
            placeholder="Find in table..."
            searchValue={searchText}
            typingInterval={1500}
            onSearch={handleSearchAction}
          />
        </div>
        {/* <div className="tw-col-span-2 tw-text-right">
          <div 
            className="tw-w-60 tw-inline-flex tw-border tw-border-blue-100 
            tw-text-sm tw-rounded-md tw-h-8 tw-bg-white">
            <button
              className={getToggleButtonClasses('schema')}
              data-testid="schema-button"
              onClick={() => handleToggleChange('schema')}>
              Schema
            </button>
            <button
              className={getToggleButtonClasses('sample-data')}
              data-testid="sample-data-button"
              onClick={() => handleToggleChange('sample-data')}>
              Sample Data
            </button>
          </div>
        </div> */}
      </div>
      <div className="row">
        <div className="col-sm-12">
          {checkedValue === 'schema' ? (
            <SchemaTable
              columns={columns}
              joins={joins}
              searchText={lowerCase(searchText)}
              onUpdate={onUpdate}
            />
          ) : (
            <SampleDataTable
              columns={mockColumns
                .filter((column) => {
                  return column;
                })
                .map((column) => {
                  return {
                    columnId: column.columnId,
                    name: column.name,
                    columnDataType: column.columnDataType,
                  };
                })}
              data={data}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SchemaTab;
