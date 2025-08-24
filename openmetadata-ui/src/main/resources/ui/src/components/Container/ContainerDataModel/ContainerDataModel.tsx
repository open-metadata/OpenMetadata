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
import { ColumnsType } from 'antd/lib/table';
import {
  cloneDeep,
  groupBy,
  isEmpty,
  isUndefined,
  toLower,
  uniqBy,
} from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_CONTAINER_DATA_MODEL_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../constants/TableKeys.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Column, TagLabel } from '../../../generated/entity/data/container';
import { TagSource } from '../../../generated/type/tagLabel';
import {
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from '../../../utils/ContainerDetailUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  getTableExpandableConfig,
  pruneEmptyChildren,
} from '../../../utils/TableUtils';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../common/Table/Table';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { ContainerDataModelProps } from './ContainerDataModel.interface';

const ContainerDataModel: FC<ContainerDataModelProps> = ({
  dataModel,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  isReadOnly,
  onUpdate,
  entityFqn,
}) => {
  const { t } = useTranslation();

  const [editContainerColumnDescription, setEditContainerColumnDescription] =
    useState<Column>();

  const schema = pruneEmptyChildren(dataModel?.columns ?? []);

  const handleFieldTagsChange = useCallback(
    async (selectedTags: EntityTags[], editColumnTag: Column) => {
      if (selectedTags && editColumnTag) {
        const containerDataModel = cloneDeep(dataModel);

        updateContainerColumnTags(
          containerDataModel?.columns,
          editColumnTag.fullyQualifiedName ?? '',
          selectedTags
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

  const tagFilter = useMemo(() => {
    const tags = getAllTags(schema);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [schema]);

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
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
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
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
                {dataTypeDisplay ?? record.dataType}
              </Typography.Text>
            </Tooltip>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 350,
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              field: record.description,
            }}
            entityFqn={entityFqn}
            entityType={EntityType.CONTAINER}
            hasEditPermission={hasDescriptionEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            onClick={() => setEditContainerColumnDescription(record)}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 300,
        filterIcon: columnFilterIcon,
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn}
            entityType={EntityType.CONTAINER}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Classification}
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        width: 300,
        filterIcon: columnFilterIcon,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn}
            entityType={EntityType.CONTAINER}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasGlossaryTermEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
    ],
    [
      isReadOnly,
      entityFqn,
      hasTagEditAccess,
      hasGlossaryTermEditAccess,
      hasDescriptionEditAccess,
      editContainerColumnDescription,
      getEntityName,
      handleFieldTagsChange,
    ]
  );

  if (isEmpty(schema)) {
    return <ErrorPlaceHolder className="border-default border-radius-sm" />;
  }

  return (
    <>
      <Table
        className="align-table-filter-left"
        columns={columns}
        data-testid="container-data-model-table"
        dataSource={schema}
        defaultVisibleColumns={DEFAULT_CONTAINER_DATA_MODEL_VISIBLE_COLUMNS}
        expandable={{
          ...getTableExpandableConfig<Column>(),
          rowExpandable: (record) => !isEmpty(record.children),
        }}
        pagination={false}
        rowKey="name"
        scroll={TABLE_SCROLL_VALUE}
        size="small"
        staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
      />
      {editContainerColumnDescription && (
        <EntityAttachmentProvider
          entityFqn={editContainerColumnDescription.fullyQualifiedName}
          entityType={EntityType.CONTAINER}>
          <ModalWithMarkdownEditor
            header={`${t('label.edit-entity', {
              entity: t('label.column'),
            })}: "${getEntityName(editContainerColumnDescription)}"`}
            placeholder={t('label.enter-field-description', {
              field: t('label.column'),
            })}
            value={editContainerColumnDescription.description ?? ''}
            visible={Boolean(editContainerColumnDescription)}
            onCancel={() => setEditContainerColumnDescription(undefined)}
            onSave={handleContainerColumnDescriptionChange}
          />
        </EntityAttachmentProvider>
      )}
    </>
  );
};

export default ContainerDataModel;
