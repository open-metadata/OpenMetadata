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

import Searchbar from 'components/common/searchbar/Searchbar';
import { lowerCase } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SearchIndexFieldsTable from '../SearchIndexFieldsTable/SearchIndexFieldsTable';
import { SearchIndexFieldsTabProps } from './SearchIndexFieldsTab.interface';

function SearchIndexFieldsTab({
  fields,
  onUpdate,
  fieldName,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  onThreadLinkSelect,
  isReadOnly = false,
  entityFqn,
}: SearchIndexFieldsTabProps) {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  return (
    <>
      <div className="w-1/2">
        <Searchbar
          removeMargin
          placeholder={`${t('message.find-in-table')}`}
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearchAction}
        />
      </div>

      <SearchIndexFieldsTable
        entityFqn={entityFqn}
        fieldName={fieldName}
        hasDescriptionEditAccess={hasDescriptionEditAccess}
        hasTagEditAccess={hasTagEditAccess}
        isReadOnly={isReadOnly}
        searchIndexFields={fields}
        searchText={lowerCase(searchText)}
        onThreadLinkSelect={onThreadLinkSelect}
        onUpdate={onUpdate}
      />
    </>
  );
}

export default SearchIndexFieldsTab;
