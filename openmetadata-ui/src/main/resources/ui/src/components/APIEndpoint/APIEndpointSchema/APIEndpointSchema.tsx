/*
 *  Copyright 2024 Collate.
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
import { Col, Row, Segmented, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { cloneDeep, groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { FC, Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  HIGHLIGHTED_ROW_SELECTOR,
  TABLE_SCROLL_VALUE,
} from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_API_ENDPOINT_SCHEMA_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../constants/TableKeys.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  APIEndpoint,
  ChangeDescription,
  DataTypeTopic as DataType,
  Field,
  TagSource,
} from '../../../generated/entity/data/apiEndpoint';
import { APISchema } from '../../../generated/type/apiSchema';
import { TagLabel } from '../../../generated/type/tagLabel';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { useFqnDeepLink } from '../../../hooks/useFqnDeepLink';
import { useScrollToElement } from '../../../hooks/useScrollToElement';
import { getColumnSorter, getEntityName } from '../../../utils/EntityUtils';
import { getVersionedSchema } from '../../../utils/SchemaVersionUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  fieldExistsByFQN,
  getAllRowKeysByKeyName,
  getHighlightedRowClassName,
  getTableExpandableConfig,
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TableUtils';
import CopyLinkButton from '../../common/CopyLinkButton/CopyLinkButton';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import Table from '../../common/Table/Table';
import ToggleExpandButton from '../../common/ToggleExpandButton/ToggleExpandButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';

interface APIEndpointSchemaProps {
  isVersionView?: boolean;
}

export enum SchemaViewType {
  REQUEST_SCHEMA = 'request-schema',
  RESPONSE_SCHEMA = 'response-schema',
}

const APIEndpointSchema: FC<APIEndpointSchemaProps> = ({
  isVersionView = false,
}) => {
  const { theme } = useApplicationStore();
  const { t } = useTranslation();

  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.REQUEST_SCHEMA
  );

  const {
    data: apiEndpointDetails,
    permissions,
    onUpdate: onApiEndpointUpdate,
    openColumnDetailPanel,
    selectedColumn,
    setDisplayedColumns,
  } = useGenericContext<APIEndpoint>();

  const { columnFqn: columnPart, fqn } = useFqn({
    type: EntityType.API_ENDPOINT,
  });

  const viewTypeOptions = [
    {
      label: t('label.request'),
      value: SchemaViewType.REQUEST_SCHEMA,
    },
    {
      label: t('label.response'),
      value: SchemaViewType.RESPONSE_SCHEMA,
    },
  ];
  const {
    requestSchemaAllRowKeys,
    responseSchemaAllRowKeys,
    requestSchemaFields,
    responseSchemaFields,
    requestSchema,
    responseSchema,
  } = useMemo(() => {
    const requestSchema = apiEndpointDetails.requestSchema;
    const responseSchema = apiEndpointDetails.responseSchema;

    const requestSchemaFields = requestSchema?.schemaFields || [];
    const responseSchemaFields = responseSchema?.schemaFields || [];

    const requestSchemaAllRowKeys = getAllRowKeysByKeyName<Field>(
      requestSchemaFields,
      'fullyQualifiedName'
    );
    const responseSchemaAllRowKeys = getAllRowKeysByKeyName<Field>(
      responseSchemaFields,
      'fullyQualifiedName'
    );

    return {
      requestSchemaFields,
      responseSchemaFields,
      requestSchemaAllRowKeys,
      responseSchemaAllRowKeys,
      requestSchema,
      responseSchema,
    };
  }, [apiEndpointDetails]);

  const {
    activeSchemaFields,
    activeSchema,
    activeSchemaKey,
    schemaAllRowKeys,
  } = useMemo(() => {
    let schemaFields, schema, schemaKey, schemaType, allRowKeys;

    if (viewType === SchemaViewType.REQUEST_SCHEMA) {
      schemaFields = requestSchemaFields;
      schema = requestSchema;
      schemaKey = 'requestSchema';
      schemaType = requestSchema?.schemaType;
      allRowKeys = requestSchemaAllRowKeys;
    } else {
      schemaFields = responseSchemaFields;
      schema = responseSchema;
      schemaKey = 'responseSchema';
      schemaType = responseSchema?.schemaType;
      allRowKeys = responseSchemaAllRowKeys;
    }

    return {
      activeSchemaFields: schemaFields,
      activeSchema: schema,
      activeSchemaKey: schemaKey as keyof APIEndpoint,
      activeSchemaType: schemaType,
      schemaAllRowKeys: allRowKeys,
    };
  }, [
    viewType,
    requestSchemaFields,
    responseSchemaFields,
    requestSchema,
    responseSchema,
    requestSchemaAllRowKeys,
    responseSchemaAllRowKeys,
  ]);

  const tagFilter = useMemo(() => {
    const tags = getAllTags(activeSchemaFields);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [activeSchemaFields]);

  const activeSchemaFieldsDiff = useMemo(() => {
    const changeDescription =
      apiEndpointDetails.changeDescription as ChangeDescription;
    const activeSchemaDiff = getVersionedSchema(
      activeSchema as APISchema,
      changeDescription
    );

    return activeSchemaDiff?.schemaFields ?? [];
  }, [activeSchema, apiEndpointDetails]);

  // Detect if URL contains a field FQN and switch view type
  useEffect(() => {
    if (fqn) {
      const isInRequestSchema = fieldExistsByFQN(requestSchemaFields, fqn);
      const isInResponseSchema = fieldExistsByFQN(responseSchemaFields, fqn);

      if (isInRequestSchema) {
        setViewType(SchemaViewType.REQUEST_SCHEMA);
      } else if (isInResponseSchema) {
        setViewType(SchemaViewType.RESPONSE_SCHEMA);
      }
    }
  }, [fqn, requestSchemaFields, responseSchemaFields]);

  useFqnDeepLink({
    data: activeSchemaFields,
    columnPart,
    fqn,
    setExpandedRowKeys: setExpandedRowKeys,
    openColumnDetailPanel,
    selectedColumn: selectedColumn as Field | null,
  });

  // Sync displayed columns with GenericProvider for ColumnDetailPanel navigation
  useEffect(() => {
    setDisplayedColumns(activeSchemaFields);
  }, [activeSchemaFields, setDisplayedColumns]);

  useScrollToElement(
    HIGHLIGHTED_ROW_SELECTOR,
    Boolean(fqn && activeSchemaFields?.length)
  );

  const getRowClassName = useCallback(
    (record: Field) => getHighlightedRowClassName(record, fqn),
    [fqn]
  );

  const handleExpandedRowsChange = (keys: readonly Key[]) => {
    setExpandedRowKeys(keys as string[]);
  };

  const handleToggleExpandAll = () => {
    if (expandedRowKeys.length < schemaAllRowKeys.length) {
      setExpandedRowKeys(schemaAllRowKeys);
    } else {
      setExpandedRowKeys([]);
    }
  };

  const handleFieldClick = useCallback(
    (field: Field, event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      const isExpandIcon = target.closest('.table-expand-icon') !== null;
      const isButton = target.closest('button') !== null;

      if (!isExpandIcon && !isButton) {
        openColumnDetailPanel(field);
      }
    },
    [openColumnDetailPanel]
  );

  const renderSchemaName = useCallback(
    (_: string, record: Field) => (
      <div className="d-inline-flex items-center gap-2 hover-icon-group w-max-90 vertical-align-inherit">
        <Tooltip destroyTooltipOnHide title={getEntityName(record)}>
          <span className="break-word">
            {isVersionView ? (
              <RichTextEditorPreviewerV1 markdown={getEntityName(record)} />
            ) : (
              <span className="text-link-color">{getEntityName(record)}</span>
            )}
          </span>
        </Tooltip>
        {!isVersionView && record.fullyQualifiedName && (
          <CopyLinkButton
            entityType={EntityType.API_ENDPOINT}
            fieldFqn={record.fullyQualifiedName}
          />
        )}
      </div>
    ),
    [isVersionView]
  );

  const renderDataType = useCallback(
    (dataType: DataType, record: Field) => (
      <Typography.Text>
        {isVersionView ? (
          <RichTextEditorPreviewerV1
            markdown={record.dataTypeDisplay ?? dataType}
          />
        ) : (
          record.dataTypeDisplay ?? dataType
        )}
      </Typography.Text>
    ),
    [isVersionView]
  );

  const handleFieldTagsChange = async (
    selectedTags: EntityTags[],
    editColumnTag: Field
  ) => {
    if (selectedTags && editColumnTag && !isUndefined(onApiEndpointUpdate)) {
      const schema = cloneDeep(activeSchema);
      updateFieldTags<Field>(
        editColumnTag.fullyQualifiedName ?? '',
        selectedTags,
        schema?.schemaFields
      );

      await onApiEndpointUpdate(
        {
          ...apiEndpointDetails,
          [activeSchemaKey]: schema,
        },
        activeSchemaKey
      );
    }
  };

  const handleFieldDescriptionChange = async (updatedDescription: string) => {
    if (
      !isUndefined(editFieldDescription) &&
      !isUndefined(onApiEndpointUpdate)
    ) {
      const schema = cloneDeep(activeSchema);
      updateFieldDescription<Field>(
        editFieldDescription.fullyQualifiedName ?? '',
        updatedDescription,
        schema?.schemaFields
      );

      await onApiEndpointUpdate(
        {
          ...apiEndpointDetails,
          [activeSchemaKey]: schema,
        },
        activeSchemaKey
      );

      setEditFieldDescription(undefined);
    } else {
      setEditFieldDescription(undefined);
    }
  };

  const columns: ColumnsType<Field> = useMemo(
    () => [
      {
        title: t('label.name'),
        className: 'cursor-pointer',
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        fixed: 'left',
        width: 220,
        sorter: getColumnSorter<Field, 'name'>('name'),
        onCell: (record: Field) => ({
          onClick: (event) => handleFieldClick(record, event),
          'data-testid': 'column-name-cell',
        }),
        render: renderSchemaName,
      },
      {
        title: t('label.type'),
        dataIndex: TABLE_COLUMNS_KEYS.DATA_TYPE,
        key: TABLE_COLUMNS_KEYS.DATA_TYPE,
        ellipsis: true,
        width: 220,
        render: renderDataType,
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
            entityFqn={apiEndpointDetails.fullyQualifiedName ?? ''}
            entityType={EntityType.API_ENDPOINT}
            hasEditPermission={
              permissions.EditDescription || permissions.EditAll
            }
            index={index}
            isReadOnly={Boolean(apiEndpointDetails.deleted) || isVersionView}
            onClick={() => setEditFieldDescription(record)}
          />
        ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 300,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
            entityFqn={apiEndpointDetails.fullyQualifiedName ?? ''}
            entityType={EntityType.API_ENDPOINT}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={permissions.EditTags || permissions.EditAll}
            index={index}
            isReadOnly={Boolean(apiEndpointDetails.deleted) || isVersionView}
            record={record}
            tags={tags}
            type={TagSource.Classification}
          />
        ),
        filters: tagFilter.Classification,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.GLOSSARY,
        width: 300,
        filterIcon: columnFilterIcon,
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
            entityFqn={apiEndpointDetails.fullyQualifiedName ?? ''}
            entityType={EntityType.API_ENDPOINT}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={
              permissions.EditGlossaryTerms || permissions.EditAll
            }
            index={index}
            isReadOnly={Boolean(apiEndpointDetails.deleted) || isVersionView}
            record={record}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
    ],
    [
      apiEndpointDetails,
      editFieldDescription,
      renderSchemaName,
      renderDataType,
      tagFilter,
      theme,
      handleFieldTagsChange,
      handleFieldClick,
      permissions,
      isVersionView,
    ]
  );

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Table
          className={classNames('align-table-filter-left')}
          columns={columns}
          data-testid="schema-fields-table"
          dataSource={
            isVersionView ? activeSchemaFieldsDiff : activeSchemaFields
          }
          defaultVisibleColumns={DEFAULT_API_ENDPOINT_SCHEMA_VISIBLE_COLUMNS}
          expandable={{
            ...getTableExpandableConfig<Field>(false, 'text-link-color'),
            rowExpandable: (record) => !isEmpty(record.children),
            onExpandedRowsChange: handleExpandedRowsChange,
            expandedRowKeys,
          }}
          extraTableFilters={
            <div className="d-flex justify-between items-center w-full">
              <Segmented
                className="segment-toggle"
                options={viewTypeOptions}
                value={viewType}
                onChange={(value) => setViewType(value as SchemaViewType)}
              />

              <ToggleExpandButton
                allRowKeys={schemaAllRowKeys}
                expandedRowKeys={expandedRowKeys}
                toggleExpandAll={handleToggleExpandAll}
              />
            </div>
          }
          key={viewType}
          pagination={false}
          rowClassName={getRowClassName}
          rowKey="fullyQualifiedName"
          scroll={TABLE_SCROLL_VALUE}
          size="small"
          staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
        />
      </Col>
      {editFieldDescription && (
        <EntityAttachmentProvider
          entityFqn={editFieldDescription.fullyQualifiedName}
          entityType={EntityType.API_ENDPOINT}>
          <ModalWithMarkdownEditor
            header={`${t('label.edit-entity', {
              entity: t('label.schema-field'),
            })}: "${getEntityName(editFieldDescription)}"`}
            placeholder={t('label.enter-field-description', {
              field: t('label.schema-field'),
            })}
            value={editFieldDescription.description ?? ''}
            visible={Boolean(editFieldDescription)}
            onCancel={() => setEditFieldDescription(undefined)}
            onSave={handleFieldDescriptionChange}
          />
        </EntityAttachmentProvider>
      )}
    </Row>
  );
};

export default APIEndpointSchema;
