/*
 *  Copyright 2021 Collate
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

import { lowerCase } from 'lodash';
import { EntityFieldThreads } from 'Models';
import React, { Fragment, FunctionComponent, useState } from 'react';
import {
  ColumnJoins,
  Table,
  TableData,
} from '../../generated/entity/data/table';
import Searchbar from '../common/searchbar/Searchbar';
import EntityTable from '../EntityTable/EntityTable.component';

type Props = {
  owner?: Table['owner'];
  columns: Table['columns'];
  joins: Array<ColumnJoins>;
  sampleData?: TableData;
  columnName: string;
  hasEditAccess?: boolean;
  isReadOnly?: boolean;
  entityFqn?: string;
  entityFieldThreads?: EntityFieldThreads[];
  onThreadLinkSelect?: (value: string) => void;
  onEntityFieldSelect?: (value: string) => void;
  onUpdate?: (columns: Table['columns']) => void;
};

const SchemaTab: FunctionComponent<Props> = ({
  columns,
  joins,
  onUpdate,
  columnName,
  hasEditAccess,
  owner,
  entityFieldThreads,
  onThreadLinkSelect,
  onEntityFieldSelect,
  isReadOnly = false,
  entityFqn,
}: Props) => {
  const [searchText, setSearchText] = useState('');

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  return (
    <Fragment>
      <div className="tw-grid tw-grid-cols-3 tw-gap-x-2">
        <div>
          <Searchbar
            placeholder="Find in table..."
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchAction}
          />
        </div>
      </div>
      <div className="row">
        {columns?.length > 0 ? (
          <div className="col-sm-12">
            <EntityTable
              columnName={columnName}
              entityFieldThreads={entityFieldThreads}
              entityFqn={entityFqn}
              hasEditAccess={Boolean(hasEditAccess)}
              isReadOnly={isReadOnly}
              joins={joins}
              owner={owner}
              searchText={lowerCase(searchText)}
              tableColumns={columns}
              onEntityFieldSelect={onEntityFieldSelect}
              onThreadLinkSelect={onThreadLinkSelect}
              onUpdate={onUpdate}
            />
          </div>
        ) : null}
      </div>
    </Fragment>
  );
};

export default SchemaTab;
