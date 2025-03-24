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

import { Col, Row } from 'antd';
import { ExpandableConfig } from 'antd/lib/table/interface';
import { isEmpty, sortBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Searchbar from '../../../components/common/SearchBarComponent/SearchBar.component';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericProvider';
import {
  SearchIndex,
  SearchIndexField,
} from '../../../generated/entity/data/searchIndex';
import { useFqn } from '../../../hooks/useFqn';
import {
  getAllRowKeysByKeyName,
  getTableExpandableConfig,
  searchInFields,
} from '../../../utils/TableUtils';
import SearchIndexFieldsTable from '../SearchIndexFieldsTable/SearchIndexFieldsTable';

function SearchIndexFieldsTab() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [searchedFields, setSearchedFields] = useState<Array<SearchIndexField>>(
    []
  );
  const { fqn: entityFqn } = useFqn();
  const { data, permissions, onUpdate } = useGenericContext<SearchIndex>();

  const { fields, deleted } = useMemo(() => data, [data.fields, data.deleted]);

  const {
    hasDescriptionEditAccess,
    hasGlossaryTermEditAccess,
    hasTagEditAccess,
  } = useMemo(
    () => ({
      hasDescriptionEditAccess:
        permissions.EditAll || permissions.EditDescription,
      hasGlossaryTermEditAccess:
        permissions.EditAll || permissions.EditGlossaryTerms,
      hasTagEditAccess: permissions.EditAll || permissions.EditTags,
    }),
    [permissions]
  );

  const sortByOrdinalPosition = useMemo(
    () => sortBy(fields, 'ordinalPosition'),
    [fields]
  );

  const handleSearchAction = useCallback((searchValue: string) => {
    setSearchText(searchValue);
  }, []);

  const fieldAllRowKeys = useMemo(() => {
    return getAllRowKeysByKeyName<SearchIndexField>(
      fields,
      'fullyQualifiedName'
    );
  }, [fields]);

  const toggleExpandAll = useCallback(() => {
    if (expandedRowKeys.length < fieldAllRowKeys.length) {
      setExpandedRowKeys(fieldAllRowKeys);
    } else {
      setExpandedRowKeys([]);
    }
  }, [expandedRowKeys, fieldAllRowKeys]);

  const expandableConfig: ExpandableConfig<SearchIndexField> = useMemo(
    () => ({
      ...getTableExpandableConfig<SearchIndexField>(),
      rowExpandable: (record) => !isEmpty(record.children),
      expandedRowKeys,
      onExpand: (expanded, record) => {
        setExpandedRowKeys(
          expanded
            ? [...expandedRowKeys, record.fullyQualifiedName ?? '']
            : expandedRowKeys.filter((key) => key !== record.fullyQualifiedName)
        );
      },
    }),
    [expandedRowKeys]
  );

  const handleSearchIndexFieldsUpdate = useCallback(
    async (updatedFields: Array<SearchIndexField>) => {
      await onUpdate({
        ...data,
        fields: updatedFields,
      });
    },
    [data, onUpdate]
  );

  useEffect(() => {
    if (!searchText) {
      setSearchedFields(sortByOrdinalPosition);
      setExpandedRowKeys([]);
    } else {
      const searchFields = searchInFields<SearchIndexField>(
        sortByOrdinalPosition,
        searchText
      );
      setSearchedFields(searchFields);
      setExpandedRowKeys(fieldAllRowKeys);
    }
  }, [searchText, sortByOrdinalPosition]);

  return (
    <Row align="middle" gutter={16} justify="space-between">
      <Col span={12}>
        <Searchbar
          removeMargin
          placeholder={`${t('message.find-in-table')}`}
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearchAction}
        />
      </Col>

      <Col span={24}>
        <SearchIndexFieldsTable
          entityFqn={entityFqn}
          expandableConfig={expandableConfig}
          expandedRowKeys={expandedRowKeys}
          fieldAllRowKeys={fieldAllRowKeys}
          hasDescriptionEditAccess={hasDescriptionEditAccess}
          hasGlossaryTermEditAccess={hasGlossaryTermEditAccess}
          hasTagEditAccess={hasTagEditAccess}
          isReadOnly={Boolean(deleted)}
          searchIndexFields={fields}
          searchText={searchText}
          searchedFields={searchedFields}
          toggleExpandAll={toggleExpandAll}
          onUpdate={handleSearchIndexFieldsUpdate}
        />
      </Col>
    </Row>
  );
}

export default SearchIndexFieldsTab;
