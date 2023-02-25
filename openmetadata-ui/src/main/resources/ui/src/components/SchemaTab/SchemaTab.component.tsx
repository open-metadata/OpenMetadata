/*
 *  Copyright 2022 Collate.
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

import { t } from 'i18next';
import { lowerCase } from 'lodash';
import React, { Fragment, FunctionComponent, useState } from 'react';
import Searchbar from '../common/searchbar/Searchbar';
import EntityTableV1 from '../EntityTable/EntityTable.component';
import { Props } from './SchemaTab.interfaces';

const SchemaTab: FunctionComponent<Props> = ({
  columns,
  joins,
  onUpdate,
  columnName,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  entityFieldThreads,
  onThreadLinkSelect,
  onEntityFieldSelect,
  isReadOnly = false,
  entityFqn,
  tableConstraints,
  entityFieldTasks,
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
            placeholder={`${t('message.find-in-table')}..`}
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchAction}
          />
        </div>
      </div>
      <div className="row">
        <div className="col-sm-12">
          <EntityTableV1
            columnName={columnName}
            entityFieldTasks={entityFieldTasks}
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            hasDescriptionEditAccess={hasDescriptionEditAccess}
            hasTagEditAccess={hasTagEditAccess}
            isReadOnly={isReadOnly}
            joins={joins}
            searchText={lowerCase(searchText)}
            tableColumns={columns}
            tableConstraints={tableConstraints}
            onEntityFieldSelect={onEntityFieldSelect}
            onThreadLinkSelect={onThreadLinkSelect}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </Fragment>
  );
};

export default SchemaTab;
