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

import { isUndefined, lowerCase } from 'lodash';
import { DatasetSchemaTableTab } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router';
import { getDatasetTabPath } from '../../constants/constants';
import {
  ColumnJoins,
  Table,
  TableData,
} from '../../generated/entity/data/table';
import Searchbar from '../common/searchbar/Searchbar';
import EntityTable from '../EntityTable/EntityTable.component';
import SampleDataTable, {
  SampleColumns,
} from '../SampleDataTable/SampleDataTable.component';

type Props = {
  owner?: Table['owner'];
  columns: Table['columns'];
  joins: Array<ColumnJoins>;
  sampleData?: TableData;
  columnName: string;
  hasEditAccess?: boolean;
  isReadOnly?: boolean;
  onUpdate?: (columns: Table['columns']) => void;
};

const SchemaTab: FunctionComponent<Props> = ({
  columns,
  joins,
  onUpdate,
  sampleData,
  columnName,
  hasEditAccess,
  owner,
  isReadOnly = false,
}: Props) => {
  const history = useHistory();
  const { datasetFQN: tableFQN, tab } = useParams() as Record<string, string>;
  const [searchText, setSearchText] = useState('');
  const [checkedValue, setCheckedValue] =
    useState<DatasetSchemaTableTab>('schema');

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const handleToggleChange = (value: DatasetSchemaTableTab) => {
    setCheckedValue(value);
    history.push({
      pathname: getDatasetTabPath(tableFQN, value),
    });
  };

  useEffect(() => {
    if (tab && ['schema', 'sample_data'].includes(tab)) {
      const activeTab = isUndefined(tab)
        ? 'schema'
        : (tab as DatasetSchemaTableTab);
      setCheckedValue(activeTab);
    }
  }, [tab]);

  const getToggleButtonClasses = (type: string): string => {
    return (
      'tw-flex-1 tw-text-primary tw-font-medium tw-border tw-border-transparent tw-rounded tw-py-1 tw-px-2 focus:tw-outline-none' +
      (type === checkedValue ? ' tw-bg-primary-hover-lite tw-border-main' : '')
    );
  };

  const getSampleDataWithType = () => {
    const updatedColumns = sampleData?.columns?.map((column) => {
      const matchedColumn = columns.find((col) => col.name === column);

      if (matchedColumn) {
        return {
          name: matchedColumn.name,
          dataType: matchedColumn.dataType,
        };
      } else {
        return {
          name: column,
          dataType: '',
        };
      }
    });

    return {
      columns: updatedColumns as SampleColumns[] | undefined,
      rows: sampleData?.rows,
    };
  };

  return (
    <div>
      <div className="tw-grid tw-grid-cols-3 tw-gap-x-2">
        <div>
          {checkedValue === 'schema' && (
            <Searchbar
              placeholder="Find in table..."
              searchValue={searchText}
              typingInterval={1500}
              onSearch={handleSearchAction}
            />
          )}
        </div>
        {!isReadOnly ? (
          <div className="tw-col-span-2 tw-text-right tw-mb-4">
            <div
              className="tw-w-60 tw-inline-flex tw-border tw-border-main
            tw-text-sm tw-rounded-md tw-h-8 tw-bg-white">
              <button
                className={getToggleButtonClasses('schema')}
                data-testid="schema-button"
                onClick={() => handleToggleChange('schema')}>
                Schema
              </button>
              <button
                className={getToggleButtonClasses('sample_data')}
                data-testid="sample-data-button"
                onClick={() => {
                  handleToggleChange('sample_data');
                }}>
                Sample Data
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="row">
        {columns?.length > 0 ? (
          <div className="col-sm-12">
            {checkedValue === 'schema' ? (
              <EntityTable
                columnName={columnName}
                hasEditAccess={Boolean(hasEditAccess)}
                isReadOnly={isReadOnly}
                joins={joins}
                owner={owner}
                searchText={lowerCase(searchText)}
                tableColumns={columns}
                onUpdate={onUpdate}
              />
            ) : (
              <SampleDataTable sampleData={getSampleDataWithType()} />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SchemaTab;
