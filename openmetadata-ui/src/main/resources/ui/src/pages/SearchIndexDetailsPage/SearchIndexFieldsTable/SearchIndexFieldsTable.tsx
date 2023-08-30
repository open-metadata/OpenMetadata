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

import { Space, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import { ModalWithMarkdownEditor } from 'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TableDescription from 'components/TableDescription/TableDescription.component';
import TableTags from 'components/TableTags/TableTags.component';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import { EntityType } from 'enums/entity.enum';
import { SearchIndexField } from 'generated/entity/data/searchIndex';
import { LabelType, State, TagSource } from 'generated/type/schema';
import { TagLabel } from 'generated/type/tagLabel';
import {
  cloneDeep,
  isEmpty,
  isUndefined,
  lowerCase,
  map,
  reduce,
  sortBy,
  toLower,
} from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import { makeData } from 'utils/SearchIndexUtils';
import { getDataTypeString, getTableExpandableConfig } from 'utils/TableUtils';
import {
  SearchIndexCellRendered,
  SearchIndexFieldsTableProps,
} from './SearchIndexFieldsTable.interface';

const SearchIndexFieldsTable = ({
  searchIndexFields,
  searchText,
  onUpdate,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  isReadOnly = false,
  onThreadLinkSelect,
  entityFqn,
}: SearchIndexFieldsTableProps) => {
  const { t } = useTranslation();

  const [searchedFields, setSearchedFields] = useState<Array<SearchIndexField>>(
    []
  );
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const sortByOrdinalPosition = useMemo(
    () => sortBy(searchIndexFields, 'ordinalPosition'),
    [searchIndexFields]
  );

  const data = React.useMemo(() => makeData(searchedFields), [searchedFields]);

  const [editField, setEditField] = useState<{
    field: SearchIndexField;
    index: number;
  }>();

  const handleEditField = (field: SearchIndexField, index: number): void => {
    setEditField({ field, index });
  };
  const closeEditFieldModal = (): void => {
    setEditField(undefined);
  };

  const updateFieldDescription = (
    searchIndexFields: Array<SearchIndexField>,
    changedFieldFQN: string,
    description: string
  ) => {
    searchIndexFields?.forEach((field) => {
      if (field.fullyQualifiedName === changedFieldFQN) {
        field.description = description;
      } else {
        updateFieldDescription(
          field?.children as Array<SearchIndexField>,
          changedFieldFQN,
          description
        );
      }
    });
  };

  const getUpdatedTags = (
    field: SearchIndexField,
    newFieldTags: Array<EntityTags>
  ): TagLabel[] => {
    const prevTagsFqn = field?.tags?.map((tag) => tag.tagFQN);

    return reduce(
      newFieldTags,
      (acc: Array<EntityTags>, cv: TagOption) => {
        if (prevTagsFqn?.includes(cv.fqn)) {
          const prev = field?.tags?.find((tag) => tag.tagFQN === cv.fqn);

          return [...acc, prev];
        } else {
          return [
            ...acc,
            {
              labelType: LabelType.Manual,
              state: State.Confirmed,
              source: cv.source,
              tagFQN: cv.fqn,
            },
          ];
        }
      },
      []
    );
  };

  const updateFieldTags = (
    searchIndexFields: Array<SearchIndexField>,
    changedFieldFQN: string,
    newFieldTags: Array<TagOption>
  ) => {
    searchIndexFields?.forEach((field) => {
      if (field.fullyQualifiedName === changedFieldFQN) {
        field.tags = getUpdatedTags(field, newFieldTags);
      } else {
        updateFieldTags(
          field?.children as Array<SearchIndexField>,
          changedFieldFQN,
          newFieldTags
        );
      }
    });
  };

  const handleEditFieldChange = async (fieldDescription: string) => {
    if (editField && editField.field.fullyQualifiedName) {
      const fields = cloneDeep(searchIndexFields);
      updateFieldDescription(
        fields,
        editField.field.fullyQualifiedName,
        fieldDescription
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
    const newSelectedTags: TagOption[] = map(selectedTags, (tag) => ({
      fqn: tag.tagFQN,
      source: tag.source,
    }));
    if (newSelectedTags && editFieldTag) {
      const fields = cloneDeep(searchIndexFields);
      updateFieldTags(
        fields,
        editFieldTag.fullyQualifiedName ?? '',
        newSelectedTags
      );
      await onUpdate(fields);
    }
  };

  const searchInFields = (
    searchIndex: Array<SearchIndexField>,
    searchText: string
  ): Array<SearchIndexField> => {
    const searchedValue: Array<SearchIndexField> = searchIndex.reduce(
      (searchedFields, field) => {
        const isContainData =
          lowerCase(field.name).includes(searchText) ||
          lowerCase(field.description).includes(searchText) ||
          lowerCase(getDataTypeString(field.dataType)).includes(searchText);

        if (isContainData) {
          return [...searchedFields, field];
        } else if (!isUndefined(field.children)) {
          const searchedChildren = searchInFields(field.children, searchText);
          if (searchedChildren.length > 0) {
            return [
              ...searchedFields,
              {
                ...field,
                children: searchedChildren,
              },
            ];
          }
        }

        return searchedFields;
      },
      [] as Array<SearchIndexField>
    );

    return searchedValue;
  };

  const handleUpdate = (field: SearchIndexField, index: number) => {
    handleEditField(field, index);
  };

  const renderDataTypeDisplay: SearchIndexCellRendered<
    SearchIndexField,
    'dataTypeDisplay'
  > = (dataTypeDisplay, record) => {
    return (
      <>
        {dataTypeDisplay ? (
          isReadOnly || (dataTypeDisplay.length < 25 && !isReadOnly) ? (
            toLower(dataTypeDisplay)
          ) : (
            <Tooltip title={toLower(dataTypeDisplay)}>
              <Typography.Text ellipsis className="cursor-pointer">
                {dataTypeDisplay || record.dataType}
              </Typography.Text>
            </Tooltip>
          )
        ) : (
          '--'
        )}
      </>
    );
  };

  const renderDescription: SearchIndexCellRendered<
    SearchIndexField,
    'description'
  > = (_, record, index) => {
    return (
      <>
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
      </>
    );
  };

  const fields: ColumnsType<SearchIndexField> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        width: 180,
        fixed: 'left',
        render: (_, record: SearchIndexField) => (
          <Space
            align="start"
            className="w-max-90 vertical-align-inherit"
            size={2}>
            <span className="break-word">{getEntityName(record)}</span>
          </Space>
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

  useEffect(() => {
    if (!searchText) {
      setSearchedFields(sortByOrdinalPosition);
    } else {
      const searchFields = searchInFields(sortByOrdinalPosition, searchText);
      setSearchedFields(searchFields);
    }
  }, [searchText, sortByOrdinalPosition]);

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
