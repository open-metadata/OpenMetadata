/*
 *  Copyright 2025 Collate.
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
import classNames from 'classnames';
import {
  cloneDeep,
  groupBy,
  isEmpty,
  isUndefined,
  toLower,
  uniqBy,
} from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TABLE_SCROLL_VALUE } from '../../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_WORKSHEET_DATA_MODEL_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../../constants/TableKeys.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { File } from '../../../../generated/entity/data/file';
import { Column, TagSource } from '../../../../generated/entity/data/table';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { getEntityName } from '../../../../utils/EntityUtils';
import { columnFilterIcon } from '../../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../../utils/TableTags/TableTags.utils';
import {
  getTableExpandableConfig,
  prepareConstraintIcon,
  pruneEmptyChildren,
  updateFieldDescription,
  updateFieldTags,
} from '../../../../utils/TableUtils';
import { EntityAttachmentProvider } from '../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../../common/Table/Table';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import { ColumnFilter } from '../../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../../Database/TableDescription/TableDescription.component';
import TableTags from '../../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';

function FileColumnsTable() {
  const { t } = useTranslation();
  const {
    data: fileDetails,
    permissions,
    onUpdate,
  } = useGenericContext<File>();

  const [editFileColumnDescription, setEditFileColumnDescription] =
    useState<Column>();

  const {
    editDescriptionPermission,
    editGlossaryTermsPermission,
    editTagsPermission,
    deleted,
  } = useMemo(() => {
    const isDeleted = fileDetails?.deleted;

    return {
      editDescriptionPermission:
        (permissions.EditAll || permissions.EditDescription) && !isDeleted,
      editGlossaryTermsPermission:
        (permissions.EditAll || permissions.EditGlossaryTerms) && !isDeleted,
      editTagsPermission:
        (permissions.EditAll || permissions.EditTags) && !isDeleted,
      deleted: isDeleted,
    };
  }, [permissions, fileDetails]);

  // Original schema with empty children is required to maintain the integrity of the data and for
  // operations like updating tags and descriptions.
  const schema = fileDetails?.columns;
  // Prune empty children from schema to avoid rendering expandable icon for columns with empty children array
  const prunedChildrenSchema = useMemo(
    () => pruneEmptyChildren(schema ?? []),
    [schema]
  );

  const handleFileColumnTagChange = async (
    selectedTags: EntityTags[],
    editColumnTag: Column
  ) => {
    if (selectedTags && editColumnTag && !isUndefined(onUpdate)) {
      const columns = cloneDeep(schema);
      updateFieldTags<Column>(
        editColumnTag.fullyQualifiedName ?? '',
        selectedTags,
        columns
      );
      await onUpdate({ ...fileDetails, columns });
    }
  };

  const handleFileColumnDescriptionChange = async (
    updatedDescription: string
  ) => {
    if (!isUndefined(editFileColumnDescription) && !isUndefined(onUpdate)) {
      const columns = cloneDeep(schema);
      updateFieldDescription<Column>(
        editFileColumnDescription.fullyQualifiedName ?? '',
        updatedDescription,
        columns
      );
      await onUpdate({ ...fileDetails, columns });
      setEditFileColumnDescription(undefined);
    } else {
      setEditFileColumnDescription(undefined);
    }
  };

  const tagFilter = useMemo(() => {
    const tags = getAllTags(schema ?? []);

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
        render: (name: Column['name'], record: Column) => {
          const { displayName } = record;

          return (
            <div className="d-inline-flex flex-column hover-icon-group w-max-90">
              <div className="d-inline-flex items-baseline">
                {prepareConstraintIcon({
                  columnName: name,
                  columnConstraint: record.constraint,
                })}
                <Typography.Text
                  className={classNames('m-b-0 d-block break-word', {
                    'text-grey-600': !isEmpty(displayName),
                  })}
                  data-testid="column-name">
                  {name}
                </Typography.Text>
              </div>
              {isEmpty(displayName) ? null : (
                <Typography.Text
                  className="m-b-0 d-block break-word"
                  data-testid="column-display-name">
                  {getEntityName(record)}
                </Typography.Text>
              )}
            </div>
          );
        },
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
            entityFqn={fileDetails?.fullyQualifiedName ?? ''}
            entityType={EntityType.FILE}
            hasEditPermission={editDescriptionPermission}
            index={index}
            isReadOnly={Boolean(deleted)}
            onClick={() => setEditFileColumnDescription(record)}
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
            entityFqn={fileDetails?.fullyQualifiedName ?? ''}
            entityType={EntityType.FILE}
            handleTagSelection={handleFileColumnTagChange}
            hasTagEditAccess={editTagsPermission}
            index={index}
            isReadOnly={Boolean(deleted)}
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
            entityFqn={fileDetails?.fullyQualifiedName ?? ''}
            entityType={EntityType.FILE}
            handleTagSelection={handleFileColumnTagChange}
            hasTagEditAccess={editGlossaryTermsPermission}
            index={index}
            isReadOnly={Boolean(deleted)}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
    ],
    [
      deleted,
      fileDetails?.fullyQualifiedName,
      editDescriptionPermission,
      editGlossaryTermsPermission,
      editTagsPermission,
      editFileColumnDescription,
      getEntityName,
      handleFileColumnTagChange,
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
        data-testid="file-columns-table"
        dataSource={prunedChildrenSchema}
        defaultVisibleColumns={DEFAULT_WORKSHEET_DATA_MODEL_VISIBLE_COLUMNS}
        expandable={{
          ...getTableExpandableConfig<Column>(),
          rowExpandable: (record) => !isEmpty(record.children),
        }}
        pagination={false}
        rowKey="fullyQualifiedName"
        scroll={TABLE_SCROLL_VALUE}
        size="small"
        staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
      />
      {editFileColumnDescription && (
        <EntityAttachmentProvider
          entityFqn={editFileColumnDescription.fullyQualifiedName}
          entityType={EntityType.FILE}>
          <ModalWithMarkdownEditor
            header={`${t('label.edit-entity', {
              entity: t('label.column'),
            })}: "${getEntityName(editFileColumnDescription)}"`}
            placeholder={t('label.enter-field-description', {
              field: t('label.column'),
            })}
            value={editFileColumnDescription.description ?? ''}
            visible={Boolean(editFileColumnDescription)}
            onCancel={() => setEditFileColumnDescription(undefined)}
            onSave={handleFileColumnDescriptionChange}
          />
        </EntityAttachmentProvider>
      )}
    </>
  );
}

export default FileColumnsTable;
