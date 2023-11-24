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
import { cloneDeep, isEmpty, isUndefined, toLower } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FilterTablePlaceHolder from '../../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../../components/common/Table/Table';
import { ModalWithMarkdownEditor } from '../../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TableDescription from '../../../components/TableDescription/TableDescription.component';
import TableTags from '../../../components/TableTags/TableTags.component';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndexField } from '../../../generated/entity/data/searchIndex';
import { TagSource } from '../../../generated/type/schema';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityUtils';
import { makeData } from '../../../utils/SearchIndexUtils';
import {
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TableUtils';
import {
  SearchIndexCellRendered,
  SearchIndexFieldsTableProps,
} from './SearchIndexFieldsTable.interface';

const SearchIndexFieldsTable = ({
  searchIndexFields,
  searchedFields,
  expandableConfig,
  onUpdate,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  isReadOnly = false,
  onThreadLinkSelect,
  entityFqn,
}: SearchIndexFieldsTableProps) => {
  const { t } = useTranslation();
  const [editField, setEditField] = useState<{
    field: SearchIndexField;
    index: number;
  }>();

  const data = React.useMemo(() => makeData(searchedFields), [searchedFields]);

  const handleEditField = useCallback(
    (field: SearchIndexField, index: number) => {
      setEditField({ field, index });
    },
    []
  );
  const closeEditFieldModal = useCallback(() => {
    setEditField(undefined);
  }, []);

  const handleEditFieldChange = async (fieldDescription: string) => {
    if (!isUndefined(editField) && editField.field.fullyQualifiedName) {
      const fields = cloneDeep(searchIndexFields);
      updateFieldDescription<SearchIndexField>(
        editField.field.fullyQualifiedName,
        fieldDescription,
        fields
      );
      await onUpdate(fields);
      setEditField(undefined);
    } else {
      setEditField(undefined);
    }
  };

  const handleTagSelection = async (
    selectedTags: EntityTags[],
    editFieldTag: SearchIndexField
  ) => {
    if (selectedTags && editFieldTag) {
      const fields = cloneDeep(searchIndexFields);
      updateFieldTags<SearchIndexField>(
        editFieldTag.fullyQualifiedName ?? '',
        selectedTags,
        fields
      );
      await onUpdate(fields);
    }
  };

  const handleUpdate = useCallback(
    (field: SearchIndexField, index: number) => {
      handleEditField(field, index);
    },
    [handleEditField]
  );

  const renderDataTypeDisplay: SearchIndexCellRendered<
    SearchIndexField,
    'dataTypeDisplay'
  > = useCallback(
    (dataTypeDisplay, record) => {
      const displayValue = isEmpty(dataTypeDisplay)
        ? record.dataType
        : dataTypeDisplay;

      if (isEmpty(displayValue)) {
        return <>{NO_DATA_PLACEHOLDER}</>;
      }

      return (
        <div data-testid={`${record.name}-data-type`}>
          {isReadOnly ||
          (displayValue && displayValue.length < 25 && !isReadOnly) ? (
            toLower(displayValue)
          ) : (
            <Tooltip title={toLower(displayValue)}>
              <Typography.Text ellipsis className="cursor-pointer">
                {displayValue}
              </Typography.Text>
            </Tooltip>
          )}
        </div>
      );
    },
    [isReadOnly]
  );

  const renderDescription: SearchIndexCellRendered<
    SearchIndexField,
    'description'
  > = useCallback(
    (_, record, index) => (
      <TableDescription
        columnData={{
          fqn: record.fullyQualifiedName ?? '',
          field: record.description,
        }}
        entityFqn={entityFqn}
        entityType={EntityType.SEARCH_INDEX}
        hasEditPermission={hasDescriptionEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        onClick={() => handleUpdate(record, index)}
        onThreadLinkSelect={onThreadLinkSelect}
      />
    ),
    [
      entityFqn,
      hasDescriptionEditAccess,
      isReadOnly,
      handleUpdate,
      onThreadLinkSelect,
    ]
  );

  const fields: ColumnsType<SearchIndexField> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        width: 220,
        fixed: 'left',
        render: (_, record: SearchIndexField) => (
          <div className="d-inline-flex w-max-90">
            <span className="break-word">{getEntityName(record)}</span>
          </div>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        accessor: 'dataTypeDisplay',
        ellipsis: true,
        width: 180,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        width: 320,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 250,
        render: (tags: TagLabel[], record: SearchIndexField, index: number) => (
          <TableTags<SearchIndexField>
            entityFqn={entityFqn}
            entityType={EntityType.SEARCH_INDEX}
            handleTagSelection={handleTagSelection}
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
        width: 250,
        render: (tags: TagLabel[], record: SearchIndexField, index: number) => (
          <TableTags<SearchIndexField>
            entityFqn={entityFqn}
            entityType={EntityType.SEARCH_INDEX}
            handleTagSelection={handleTagSelection}
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
      entityFqn,
      isReadOnly,
      hasTagEditAccess,
      handleUpdate,
      handleTagSelection,
      renderDataTypeDisplay,
      renderDescription,
      handleTagSelection,
      onThreadLinkSelect,
    ]
  );

  return (
    <>
      <Table
        bordered
        className="m-b-sm"
        columns={fields}
        data-testid="search-index-fields-table"
        dataSource={data}
        expandable={expandableConfig}
        locale={{
          emptyText: <FilterTablePlaceHolder />,
        }}
        pagination={false}
        rowKey="fullyQualifiedName"
        scroll={TABLE_SCROLL_VALUE}
        size="middle"
      />
      {editField && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.field'),
          })}: "${editField.field.name}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.field'),
          })}
          value={editField.field.description as string}
          visible={Boolean(editField)}
          onCancel={closeEditFieldModal}
          onSave={handleEditFieldChange}
        />
      )}
    </>
  );
};

export default SearchIndexFieldsTable;
