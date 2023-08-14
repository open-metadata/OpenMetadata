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

import { Col, Row, Space, Table } from 'antd';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import { NO_DATA_PLACEHOLDER } from 'constants/constants';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { Column } from '../../generated/entity/data/table';
import {
  getFrequentlyJoinedColumns,
  searchInColumns,
} from '../../utils/EntityUtils';
import {
  getTableExpandableConfig,
  makeData,
  prepareConstraintIcon,
} from '../../utils/TableUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import Searchbar from '../common/searchbar/Searchbar';
import TagsViewer from '../Tag/TagsViewer/TagsViewer';
import { VersionTableProps } from './VersionTable.interfaces';

const VersionTable = ({
  columnName,
  columns,
  joins,
  tableConstraints,
  constraintUpdatedColumns,
}: VersionTableProps) => {
  const [searchedColumns, setSearchedColumns] = useState<Column[]>([]);
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState('');

  const data = useMemo(() => makeData(searchedColumns), [searchedColumns]);

  const versionTableColumns = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        ellipsis: true,
        width: 180,
        render: (name: Column['name'], record: Column) => (
          <Space
            align="start"
            className="w-max-90 vertical-align-inherit"
            size={2}>
            {prepareConstraintIcon(
              name,
              record.constraint,
              tableConstraints,
              undefined,
              undefined,
              constraintUpdatedColumns?.includes(name)
            )}
            <RichTextEditorPreviewer markdown={name} />
          </Space>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        accessor: 'dataTypeDisplay',
        ellipsis: true,
        width: 200,
        render: (dataTypeDisplay: Column['dataTypeDisplay']) =>
          dataTypeDisplay ? (
            <RichTextEditorPreviewer markdown={dataTypeDisplay.toLowerCase()} />
          ) : (
            NO_DATA_PLACEHOLDER
          ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        width: 400,
        render: (description: Column['description']) =>
          description ? (
            <>
              <RichTextEditorPreviewer markdown={description} />
              {getFrequentlyJoinedColumns(
                columnName,
                joins,
                t('label.frequently-joined-column-plural')
              )}
            </>
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 272,
        render: (tags: Column['tags']) => (
          <TagsViewer
            sizeCap={-1}
            tags={getFilterTags(tags ?? []).Classification}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 272,
        render: (tags: Column['tags']) => (
          <TagsViewer sizeCap={-1} tags={getFilterTags(tags ?? []).Glossary} />
        ),
      },
    ],
    [columnName, joins, data]
  );

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  useEffect(() => {
    if (!searchText) {
      setSearchedColumns(columns);
    } else {
      const searchCols = searchInColumns(columns, searchText);
      setSearchedColumns(searchCols);
    }
  }, [searchText, columns]);

  return (
    <Row>
      <Col>
        <Searchbar
          placeholder={`${t('message.find-in-table')}...`}
          searchValue={searchText}
          typingInterval={500}
          onSearch={handleSearchAction}
        />
      </Col>
      <Col>
        <Table
          bordered
          columns={versionTableColumns}
          data-testid="entity-table"
          dataSource={data}
          expandable={{
            ...getTableExpandableConfig<Column>(),
            defaultExpandAllRows: true,
          }}
          key={`${String(data)}`} // Necessary for working of the default auto expand all rows functionality.
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="name"
          scroll={TABLE_SCROLL_VALUE}
          size="small"
        />
      </Col>
    </Row>
  );
};

export default VersionTable;
