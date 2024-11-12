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
import { Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { cloneDeep, groupBy, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { Column } from '../../../../../generated/entity/data/dashboardDataModel';
import { TagLabel, TagSource } from '../../../../../generated/type/tagLabel';
import { updateDataModelColumnDescription } from '../../../../../utils/DataModelsUtils';
import {
  getColumnSorter,
  getEntityName,
} from '../../../../../utils/EntityUtils';
import {
  getAllTags,
  searchTagInData,
} from '../../../../../utils/TableTags/TableTags.utils';
import { updateFieldTags } from '../../../../../utils/TableUtils';
import Table from '../../../../common/Table/Table';
import { ColumnFilter } from '../../../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../../../Database/TableDescription/TableDescription.component';
import TableTags from '../../../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { ModelTabProps } from './ModelTab.interface';

const ModelTab = ({
  data,
  isReadOnly,
  hasEditDescriptionPermission,
  hasEditTagsPermission,
  hasEditGlossaryTermPermission,
  onUpdate,
  entityFqn,
  onThreadLinkSelect,
}: ModelTabProps) => {
  const { t } = useTranslation();
  const [editColumnDescription, setEditColumnDescription] = useState<Column>();

  const tagFilter = useMemo(() => {
    const tags = getAllTags(data ?? []);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [data]);

  const handleFieldTagsChange = useCallback(
    async (selectedTags: EntityTags[], editColumnTag: Column) => {
      const dataModelData = cloneDeep(data);

      updateFieldTags<Column>(
        editColumnTag.fullyQualifiedName ?? '',
        selectedTags,
        dataModelData
      );

      await onUpdate(dataModelData);
    },
    [data, updateFieldTags]
  );

  const handleColumnDescriptionChange = useCallback(
    async (updatedDescription: string) => {
      if (!isUndefined(editColumnDescription)) {
        const dataModelColumns = cloneDeep(data);
        updateDataModelColumnDescription(
          dataModelColumns,
          editColumnDescription?.fullyQualifiedName ?? '',
          updatedDescription
        );
        await onUpdate(dataModelColumns);
      }
      setEditColumnDescription(undefined);
    },
    [editColumnDescription, data]
  );

  const tableColumn: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 250,
        fixed: 'left',
        sorter: getColumnSorter<Column, 'name'>('name'),
        render: (_, record) => (
          <Typography.Text>{getEntityName(record)}</Typography.Text>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataType',
        key: 'dataType',
        width: 100,
        render: (dataType, record) => (
          <Typography.Text>
            {record.dataTypeDisplay || dataType}
          </Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        width: 350,
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              field: record.description,
            }}
            entityFqn={entityFqn}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            hasEditPermission={hasEditDescriptionPermission}
            index={index}
            isReadOnly={isReadOnly}
            onClick={() => setEditColumnDescription(record)}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 250,
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditTagsPermission}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Classification}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary',
        accessor: 'tags',
        width: 250,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditGlossaryTermPermission}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
      },
    ],
    [
      entityFqn,
      isReadOnly,
      tagFilter,
      hasEditTagsPermission,
      hasEditGlossaryTermPermission,
      editColumnDescription,
      hasEditDescriptionPermission,
      onThreadLinkSelect,
      handleFieldTagsChange,
    ]
  );

  return (
    <>
      <Table
        bordered
        className="p-t-xs align-table-filter-left"
        columns={tableColumn}
        data-testid="data-model-column-table"
        dataSource={data}
        pagination={false}
        rowKey="name"
        scroll={{ x: 1200 }}
        size="small"
      />

      {editColumnDescription && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.column'),
          })}: "${getEntityName(editColumnDescription)}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.column'),
          })}
          value={editColumnDescription.description || ''}
          visible={Boolean(editColumnDescription)}
          onCancel={() => setEditColumnDescription(undefined)}
          onSave={handleColumnDescriptionChange}
        />
      )}
    </>
  );
};

export default ModelTab;
