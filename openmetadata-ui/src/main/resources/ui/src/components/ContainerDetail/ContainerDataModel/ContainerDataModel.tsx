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
import { Tooltip, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import { ModalWithMarkdownEditor } from 'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TableDescription from 'components/TableDescription/TableDescription.component';
import TableTags from 'components/TableTags/TableTags.component';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import { EntityType } from 'enums/entity.enum';
import { Column, TagLabel } from 'generated/entity/data/container';
import { TagSource } from 'generated/type/tagLabel';
import { cloneDeep, isEmpty, isUndefined, map, toLower } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from 'utils/ContainerDetailUtils';
import { getEntityName } from 'utils/EntityUtils';
import { getTableExpandableConfig } from 'utils/TableUtils';
import { ContainerDataModelProps } from './ContainerDataModel.interface';

const ContainerDataModel: FC<ContainerDataModelProps> = ({
  dataModel,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  isReadOnly,
  onUpdate,
  entityFqn,
  entityFieldThreads,
  onThreadLinkSelect,
}) => {
  const { t } = useTranslation();

  const [editContainerColumnDescription, setEditContainerColumnDescription] =
    useState<Column>();

  const handleFieldTagsChange = useCallback(
    async (selectedTags: EntityTags[], editColumnTag: Column) => {
      const newSelectedTags: TagOption[] = map(selectedTags, (tag) => ({
        fqn: tag.tagFQN,
        source: tag.source,
      }));

      if (newSelectedTags && editColumnTag) {
        const containerDataModel = cloneDeep(dataModel);

        updateContainerColumnTags(
          containerDataModel?.columns,
          editColumnTag.fullyQualifiedName ?? '',
          newSelectedTags
        );

        await onUpdate(containerDataModel);
      }
    },
    [dataModel, onUpdate]
  );

  const handleContainerColumnDescriptionChange = async (
    updatedDescription: string
  ) => {
    if (!isUndefined(editContainerColumnDescription)) {
      const containerDataModel = cloneDeep(dataModel);
      updateContainerColumnDescription(
        containerDataModel?.columns,
        editContainerColumnDescription.fullyQualifiedName ?? '',
        updatedDescription
      );
      await onUpdate(containerDataModel);
    }
    setEditContainerColumnDescription(undefined);
  };

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        fixed: 'left',
        width: 300,
        render: (_, record: Column) => (
          <Tooltip destroyTooltipOnHide title={getEntityName(record)}>
            <Typography.Text>{getEntityName(record)}</Typography.Text>
          </Tooltip>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        accessor: 'dataTypeDisplay',
        ellipsis: true,
        width: 220,
        render: (
          dataTypeDisplay: Column['dataTypeDisplay'],
          record: Column
        ) => {
          return (
            <Tooltip
              destroyTooltipOnHide
              overlayInnerStyle={{
                maxWidth: '420px',
                overflowWrap: 'break-word',
                textAlign: 'center',
              }}
              title={toLower(dataTypeDisplay)}>
              <Typography.Text ellipsis className="cursor-pointer">
                {dataTypeDisplay || record.dataType}
              </Typography.Text>
            </Tooltip>
          );
        },
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
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            entityType={EntityType.CONTAINER}
            hasEditPermission={hasDescriptionEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            onClick={() => setEditContainerColumnDescription(record)}
            onThreadLinkSelect={onThreadLinkSelect}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            entityType={EntityType.CONTAINER}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasTagEditAccess}
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
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            entityType={EntityType.CONTAINER}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasTagEditAccess}
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
      isReadOnly,
      entityFqn,
      hasTagEditAccess,
      entityFieldThreads,
      hasDescriptionEditAccess,
      editContainerColumnDescription,
      getEntityName,
      onThreadLinkSelect,
      handleFieldTagsChange,
    ]
  );

  if (isEmpty(dataModel?.columns)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <>
      <Table
        bordered
        columns={columns}
        data-testid="container-data-model-table"
        dataSource={dataModel?.columns}
        expandable={{
          ...getTableExpandableConfig<Column>(),
          rowExpandable: (record) => !isEmpty(record.children),
        }}
        pagination={false}
        rowKey="name"
        scroll={TABLE_SCROLL_VALUE}
        size="small"
      />
      {editContainerColumnDescription && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.column'),
          })}: "${editContainerColumnDescription.name}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.column'),
          })}
          value={editContainerColumnDescription.description ?? ''}
          visible={Boolean(editContainerColumnDescription)}
          onCancel={() => setEditContainerColumnDescription(undefined)}
          onSave={handleContainerColumnDescriptionChange}
        />
      )}
    </>
  );
};

export default ContainerDataModel;
