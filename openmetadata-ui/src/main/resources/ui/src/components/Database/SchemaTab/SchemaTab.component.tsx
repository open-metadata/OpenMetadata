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

import { Button } from 'antd';
import { t } from 'i18next';
import { lowerCase } from 'lodash';
import React, { Fragment, FunctionComponent, useMemo, useState } from 'react';
import EntityLink from '../../../utils/EntityLink';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import SchemaTable from '../SchemaTable/SchemaTable.component';
import { Props } from './SchemaTab.interfaces';

const SchemaTab: FunctionComponent<Props> = ({
  columns,
  joins,
  onUpdate,
  columnName,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  onThreadLinkSelect,
  isReadOnly = false,
  entityFqn,
  tableConstraints,
}: Props) => {
  const [searchText, setSearchText] = useState('');
  const { selectedUserSuggestions } = useSuggestionsContext();

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const columnSuggestions = useMemo(
    () =>
      selectedUserSuggestions?.filter(
        (item) => EntityLink.getTableColumnName(item.entityLink) !== undefined
      ) ?? [],
    [selectedUserSuggestions]
  );

  return (
    <Fragment>
      <div className="d-flex items-center justify-between">
        <div className="w-1/2">
          <Searchbar
            removeMargin
            placeholder={`${t('message.find-in-table')}`}
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchAction}
          />
        </div>
        {columnSuggestions.length > 0 && (
          <Button className="suggestion-pending-btn">
            {columnSuggestions.length} {t('label.suggestion-pending')}
          </Button>
        )}
      </div>
      <SchemaTable
        columnName={columnName}
        entityFqn={entityFqn}
        hasDescriptionEditAccess={hasDescriptionEditAccess}
        hasTagEditAccess={hasTagEditAccess}
        isReadOnly={isReadOnly}
        joins={joins}
        searchText={lowerCase(searchText)}
        tableColumns={columns}
        tableConstraints={tableConstraints}
        onThreadLinkSelect={onThreadLinkSelect}
        onUpdate={onUpdate}
      />
    </Fragment>
  );
};

export default SchemaTab;
