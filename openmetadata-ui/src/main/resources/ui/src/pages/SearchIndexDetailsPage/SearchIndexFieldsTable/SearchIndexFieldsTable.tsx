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
import { Tooltip } from '../../../components/common/AntdCompat';;
import { ColumnsType } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import {
  cloneDeep,
  groupBy,
  isEmpty,
  isUndefined,
  sortBy,
  toLower,
  uniqBy,
} from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityAttachmentProvider } from '../../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import FilterTablePlaceHolder from '../../../components/common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../../../components/common/Table/Table';
import ToggleExpandButton from '../../../components/common/ToggleExpandButton/ToggleExpandButton';
import { ColumnFilter } from '../../../components/Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../../components/Database/TableDescription/TableDescription.component';
import TableTags from '../../../components/Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_SEARCH_INDEX_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../constants/TableKeys.constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndexField } from '../../../generated/entity/data/searchIndex';
import { TagSource } from '../../../generated/type/schema';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  getColumnSorter,
  getEntityName,
  highlightSearchArrayElement,
  highlightSearchText,
} from '../../../utils/EntityUtils';
import { makeData } from '../../../utils/SearchIndexUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  getTableExpandableConfig,
  searchInFields,
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TableUtils';
import {
  SearchIndexCellRendered,
  SearchIndexFieldsTableProps,
} from './SearchIndexFieldsTable.interface';

const SearchIndexFieldsTable = ({
  searchIndexFields,
  onUpdate,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  hasGlossaryTermEditAccess,
  isReadOnly = false,
  entityFqn,
  fieldAllRowKeys,
}: SearchIndexFieldsTableProps) => {
  const { t } = useTranslation();
  const [editField, setEditField] = useState<{
    field: SearchIndexField;
    index: number;
  }>();
  const [searchText, setSearchText] = useState('');
  const [searchedFields, setSearchedFields] = useState<Array<SearchIndexField>>(
    []
  );
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const sortByOrdinalPosition = useMemo(
    () => sortBy(searchIndexFields, 'ordinalPosition'),
    [searchIndexFields]
  );

  const data = useMemo(() => makeData(searchedFields), [searchedFields]);

  const tagFilter = useMemo(() => {
    const tags = getAllTags(data ?? []);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [data]);

  const toggleExpandAll = useCallback(() => {
    if (expandedRowKeys.length < fieldAllRowKeys.length) {
      setExpandedRowKeys(fieldAllRowKeys);
    } else {
      setExpandedRowKeys([]);
    }
  }, [expandedRowKeys, fieldAllRowKeys]);

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
                {highlightSearchArrayElement(displayValue, searchText)}
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
          field: highlightSearchText(record.description, searchText),
        }}
        entityFqn={entityFqn}
        entityType={EntityType.SEARCH_INDEX}
        hasEditPermission={hasDescriptionEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        onClick={() => handleUpdate(record, index)}
      />
    ),
    [entityFqn, hasDescriptionEditAccess, isReadOnly, handleUpdate]
  );

  const fields: ColumnsType<SearchIndexField> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        width: 220,
        fixed: 'left',
        sorter: getColumnSorter<SearchIndexField, 'name'>('name'),
        render: (_, record: SearchIndexField) => (
          <div className="d-inline-flex w-max-90">
            <span className="break-word">
              {stringToHTML(
                highlightSearchText(getEntityName(record), searchText)
              )}
            </span>
          </div>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE_DISPLAY,
        ellipsis: true,
        width: 180,
        render: renderDataTypeDisplay,
      },
      {
        title: t('label.description'),
        dataIndex: TABLE_COLUMNS_KEYS.DESCRIPTION,
        key: TABLE_COLUMNS_KEYS.DESCRIPTION,
        width: 320,
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 250,
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
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
          />
        ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        width: 250,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
        render: (tags: TagLabel[], record: SearchIndexField, index: number) => (
          <TableTags<SearchIndexField>
            entityFqn={entityFqn}
            entityType={EntityType.SEARCH_INDEX}
            handleTagSelection={handleTagSelection}
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
      entityFqn,
      isReadOnly,
      hasTagEditAccess,
      hasGlossaryTermEditAccess,
      handleUpdate,
      handleTagSelection,
      renderDataTypeDisplay,
      renderDescription,
      tagFilter,
    ]
  );

  const handleSearchAction = useCallback((searchValue: string) => {
    setSearchText(searchValue);
  }, []);

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
      setExpandedRowKeys([]);
    } else {
      const searchFields = searchInFields<SearchIndexField>(
        sortByOrdinalPosition,
        searchText
      );
      setSearchedFields(searchFields);
      setExpandedRowKeys(fieldAllRowKeys);
    }
  }, [searchText, searchIndexFields]);

  return (
    <>
      <Table
        className="align-table-filter-left"
        columns={fields}
        data-testid="search-index-fields-table"
        dataSource={data}
        defaultVisibleColumns={DEFAULT_SEARCH_INDEX_VISIBLE_COLUMNS}
        expandable={expandableConfig}
        extraTableFilters={
          <ToggleExpandButton
            allRowKeys={fieldAllRowKeys}
            expandedRowKeys={expandedRowKeys}
            toggleExpandAll={toggleExpandAll}
          />
        }
        locale={{
          emptyText: <FilterTablePlaceHolder />,
        }}
        pagination={false}
        rowKey="fullyQualifiedName"
        scroll={TABLE_SCROLL_VALUE}
        searchProps={{
          placeholder: `${t('message.find-in-table')}`,
          value: searchText,
          typingInterval: 500,
          onSearch: handleSearchAction,
        }}
        size="middle"
        staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
      />
      {editField && (
        <EntityAttachmentProvider
          entityFqn={editField.field.fullyQualifiedName}
          entityType={EntityType.SEARCH_INDEX}>
          <ModalWithMarkdownEditor
            header={`${t('label.edit-entity', {
              entity: t('label.field'),
            })}: "${getEntityName(editField.field)}"`}
            placeholder={t('label.enter-field-description', {
              field: t('label.field'),
            })}
            value={editField.field.description as string}
            visible={Boolean(editField)}
            onCancel={closeEditFieldModal}
            onSave={handleEditFieldChange}
          />
        </EntityAttachmentProvider>
      )}
    </>
  );
};

export default SearchIndexFieldsTable;
