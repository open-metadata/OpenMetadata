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
  isEqual,
  isUndefined,
  set,
  uniqBy,
} from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_DASHBOARD_DATA_MODEL_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../../../constants/TableKeys.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import {
  Column,
  DashboardDataModel,
} from '../../../../../generated/entity/data/dashboardDataModel';
import { TagLabel, TagSource } from '../../../../../generated/type/tagLabel';
import { updateDataModelColumnDescription } from '../../../../../utils/DataModelsUtils';
import {
  getColumnSorter,
  getEntityName,
} from '../../../../../utils/EntityUtils';
import { columnFilterIcon } from '../../../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../../../utils/TableTags/TableTags.utils';
import {
  prepareConstraintIcon,
  updateFieldTags,
} from '../../../../../utils/TableUtils';
import { EntityAttachmentProvider } from '../../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import { EditIconButton } from '../../../../common/IconButtons/EditIconButton';
import Table from '../../../../common/Table/Table';
import { useGenericContext } from '../../../../Customization/GenericProvider/GenericProvider';
import { ColumnFilter } from '../../../../Database/ColumnFilter/ColumnFilter.component';
import { UpdatedColumnFieldData } from '../../../../Database/SchemaTable/SchemaTable.interface';
import TableDescription from '../../../../Database/TableDescription/TableDescription.component';
import TableTags from '../../../../Database/TableTags/TableTags.component';
import EntityNameModal from '../../../../Modals/EntityNameModal/EntityNameModal.component';
import {
  EntityName,
  EntityNameWithAdditionFields,
} from '../../../../Modals/EntityNameModal/EntityNameModal.interface';
import { ModalWithMarkdownEditor } from '../../../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';

const ModelTab = () => {
  const { t } = useTranslation();
  const [editColumnDescription, setEditColumnDescription] = useState<Column>();
  const [editColumnDisplayName, setEditColumnDisplayName] = useState<Column>();
  const {
    data: dataModel,
    permissions,
    onUpdate,
  } = useGenericContext<DashboardDataModel>();
  const {
    columns: data,
    fullyQualifiedName: entityFqn,
    deleted: isReadOnly,
  } = dataModel;

  const { tableColumns, deleted } = useMemo(
    () => ({
      tableColumns: dataModel?.columns ?? [],
      deleted: dataModel?.deleted,
    }),
    [dataModel]
  );
  const {
    hasEditDescriptionPermission,
    hasEditTagsPermission,
    hasEditGlossaryTermPermission,
    editDisplayNamePermission,
  } = useMemo(() => {
    return {
      hasEditDescriptionPermission:
        permissions.EditAll || permissions.EditDescription,
      hasEditTagsPermission: permissions.EditAll || permissions.EditTags,
      hasEditGlossaryTermPermission:
        permissions.EditAll || permissions.EditGlossaryTerms,
      editDisplayNamePermission:
        (permissions.EditDisplayName || permissions.EditAll) && !deleted,
    };
  }, [permissions]);

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

      await onUpdate({ ...dataModel, columns: dataModelData });
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
        await onUpdate({
          ...dataModel,
          columns: dataModelColumns,
        });
      }
      setEditColumnDescription(undefined);
    },
    [editColumnDescription, data]
  );

  const handleEditDisplayNameClick = (record: Column) => {
    setEditColumnDisplayName(record);
  };
  const updateColumnFields = ({
    fqn,
    field,
    value,
    columns,
  }: UpdatedColumnFieldData) => {
    columns?.forEach((col) => {
      if (col.fullyQualifiedName === fqn) {
        set(col, field, value);
      } else {
        updateColumnFields({
          fqn,
          field,
          value,
          columns: col.children as Column[],
        });
      }
    });
  };
  const handleColumnUpdate = async (updatedColumns: Column[]) => {
    if (dataModel && !isEqual(tableColumns, updatedColumns)) {
      const updatedTableDetails = {
        ...dataModel,
        columns: updatedColumns,
      };
      await onUpdate(updatedTableDetails);
    }
  };

  const handleEditColumnData = async (data: EntityName) => {
    const { displayName } = data as EntityNameWithAdditionFields;
    if (
      !isUndefined(editColumnDisplayName) &&
      editColumnDisplayName.fullyQualifiedName
    ) {
      const tableCols = cloneDeep(tableColumns);

      updateColumnFields({
        fqn: editColumnDisplayName.fullyQualifiedName,
        value: isEmpty(displayName) ? undefined : displayName,
        field: 'displayName',
        columns: tableCols,
      });

      await handleColumnUpdate(tableCols);
      setEditColumnDisplayName(undefined);
    } else {
      setEditColumnDisplayName(undefined);
    }
  };
  const tableColumn: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 250,
        fixed: 'left',
        sorter: getColumnSorter<Column, 'name'>('name'),
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
                  className="m-b-0 d-block break-word"
                  data-testid="column-name">
                  {name}
                </Typography.Text>
              </div>
              {!isEmpty(displayName) ? (
                // It will render displayName fallback to name
                <Typography.Text
                  className="m-b-0 d-block break-word"
                  data-testid="column-display-name">
                  {name}
                </Typography.Text>
              ) : null}

              {editDisplayNamePermission && (
                <Tooltip placement="right" title={t('label.edit')}>
                  <EditIconButton
                    className="cursor-pointer hover-cell-icon w-fit-content"
                    data-testid="edit-displayName-button"
                    onClick={() => handleEditDisplayNameClick(record)}
                  />
                </Tooltip>
              )}
            </div>
          );
        },
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE,
        width: 100,
        render: (dataType, record) => (
          <Typography.Text>
            {record.dataTypeDisplay || dataType}
          </Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        accessor: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 350,
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              field: record.description,
            }}
            entityFqn={entityFqn ?? ''}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            hasEditPermission={hasEditDescriptionPermission}
            index={index}
            isReadOnly={isReadOnly}
            onClick={() => setEditColumnDescription(record)}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        accessor: TABLE_COLUMNS_KEYS.TAGS,
        width: 250,
        filters: tagFilter.Classification,
        filterIcon: columnFilterIcon,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn ?? ''}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditTagsPermission}
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
        accessor: TABLE_COLUMNS_KEYS.TAGS,
        width: 250,
        filterIcon: columnFilterIcon,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            entityFqn={entityFqn ?? ''}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditGlossaryTermPermission}
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
      entityFqn,
      isReadOnly,
      tagFilter,
      hasEditTagsPermission,
      hasEditGlossaryTermPermission,
      editColumnDescription,
      hasEditDescriptionPermission,
      handleFieldTagsChange,
    ]
  );

  return (
    <>
      <Table
        className="p-t-xs align-table-filter-left"
        columns={tableColumn}
        data-testid="data-model-column-table"
        dataSource={data}
        defaultVisibleColumns={DEFAULT_DASHBOARD_DATA_MODEL_VISIBLE_COLUMNS}
        pagination={false}
        rowKey="name"
        scroll={{ x: 1200 }}
        size="small"
        staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
      />

      {editColumnDescription && (
        <EntityAttachmentProvider
          entityFqn={editColumnDescription.fullyQualifiedName}
          entityType={EntityType.DASHBOARD_DATA_MODEL}>
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
        </EntityAttachmentProvider>
      )}
      {editColumnDisplayName && (
        <EntityNameModal
          entity={editColumnDisplayName}
          title={`${t('label.edit-entity', {
            entity: t('label.column'),
          })}: "${editColumnDisplayName?.name}"`}
          visible={Boolean(editColumnDisplayName)}
          onCancel={() => setEditColumnDisplayName(undefined)}
          onSave={handleEditColumnData}
        />
      )}
    </>
  );
};

export default ModelTab;
