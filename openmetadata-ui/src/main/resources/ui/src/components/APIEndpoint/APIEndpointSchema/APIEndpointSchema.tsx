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
import { Button, Col, Row, Segmented, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import { cloneDeep, groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { FC, Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ShareIcon } from '../../../assets/svg/copy-right.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { TABLE_SCROLL_VALUE } from '../../../constants/Table.constants';
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
import { getColumnSorter, getEntityName } from '../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getVersionedSchema } from '../../../utils/SchemaVersionUtils';
import { columnFilterIcon } from '../../../utils/TableColumn.util';
import {
  getAllTags,
  searchTagInData,
} from '../../../utils/TableTags/TableTags.utils';
import {
  getAllRowKeysByKeyName,
  getTableExpandableConfig,
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TableUtils';
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
  const { fqn: entityFqn } = useFqn();
  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [copiedFieldFqn, setCopiedFieldFqn] = useState<string>();
  const [highlightedFieldFqn, setHighlightedFieldFqn] = useState<string>();
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.REQUEST_SCHEMA
  );
  const {
    data: apiEndpointDetails,
    permissions,
    onUpdate: onApiEndpointUpdate,
    openColumnDetailPanel,
  } = useGenericContext<APIEndpoint>();

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

  // Check if field FQN exists in schema fields (recursive)
  const findFieldInSchema = useCallback(
    (fields: Field[], targetFqn: string): boolean => {
      for (const field of fields) {
        if (
          field.fullyQualifiedName === targetFqn ||
          targetFqn.startsWith((field.fullyQualifiedName ?? '') + '.')
        ) {
          return true;
        }
        if (field.children?.length) {
          if (findFieldInSchema(field.children, targetFqn)) {
            return true;
          }
        }
      }

      return false;
    },
    []
  );

  // Get all parent FQNs that need to be expanded to show the target field
  const getParentKeysToExpand = useCallback(
    (
      fields: Field[],
      targetFqn: string,
      parentKeys: string[] = []
    ): string[] => {
      for (const field of fields) {
        if (field.fullyQualifiedName === targetFqn) {
          return parentKeys;
        }
        if (
          field.children?.length &&
          targetFqn.startsWith((field.fullyQualifiedName ?? '') + '.')
        ) {
          const newParentKeys = [...parentKeys, field.fullyQualifiedName ?? ''];
          const result = getParentKeysToExpand(
            field.children,
            targetFqn,
            newParentKeys
          );
          if (
            result.length > 0 ||
            field.children.some((c) => c.fullyQualifiedName === targetFqn)
          ) {
            return newParentKeys;
          }
        }
      }

      return parentKeys;
    },
    []
  );

  // Detect if URL contains a field FQN and highlight it, also auto-switch view type
  useEffect(() => {
    const apiEndpointFqn = apiEndpointDetails?.fullyQualifiedName;
    if (entityFqn && apiEndpointFqn && entityFqn !== apiEndpointFqn) {
      // Check if the field is in request or response schema
      const isInRequestSchema = findFieldInSchema(
        requestSchemaFields,
        entityFqn
      );
      const isInResponseSchema = findFieldInSchema(
        responseSchemaFields,
        entityFqn
      );

      if (isInRequestSchema) {
        setViewType(SchemaViewType.REQUEST_SCHEMA);
        setHighlightedFieldFqn(entityFqn);
        // Expand parent rows to show the nested field
        const parentKeys = getParentKeysToExpand(
          requestSchemaFields,
          entityFqn
        );
        if (parentKeys.length > 0) {
          setExpandedRowKeys((prev) => [...new Set([...prev, ...parentKeys])]);
        }
      } else if (isInResponseSchema) {
        setViewType(SchemaViewType.RESPONSE_SCHEMA);
        setHighlightedFieldFqn(entityFqn);
        // Expand parent rows to show the nested field
        const parentKeys = getParentKeysToExpand(
          responseSchemaFields,
          entityFqn
        );
        if (parentKeys.length > 0) {
          setExpandedRowKeys((prev) => [...new Set([...prev, ...parentKeys])]);
        }
      }

      if (isInRequestSchema || isInResponseSchema) {
        const timer = setTimeout(() => {
          setHighlightedFieldFqn(undefined);
        }, 3000);

        return () => clearTimeout(timer);
      }
    }
  }, [
    entityFqn,
    apiEndpointDetails?.fullyQualifiedName,
    requestSchemaFields,
    responseSchemaFields,
    findFieldInSchema,
    getParentKeysToExpand,
  ]);

  // Scroll to highlighted row when fields are loaded
  useEffect(() => {
    if (highlightedFieldFqn && activeSchemaFields?.length > 0) {
      const scrollTimer = setTimeout(() => {
        const highlightedRow = document.querySelector('.highlighted-row');
        if (highlightedRow) {
          highlightedRow.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);

      return () => clearTimeout(scrollTimer);
    }
  }, [highlightedFieldFqn, activeSchemaFields]);

  const getRowClassName = useCallback(
    (record: Field) => {
      if (highlightedFieldFqn && record.fullyQualifiedName) {
        // Only highlight the exact target field, not parent rows
        if (record.fullyQualifiedName === highlightedFieldFqn) {
          return 'highlighted-row';
        }
      }

      return '';
    },
    [highlightedFieldFqn]
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

  const getFieldLink = useCallback((fieldFqn: string) => {
    const fieldPath = getEntityDetailsPath(EntityType.API_ENDPOINT, fieldFqn);

    return `${window.location.origin}${fieldPath}`;
  }, []);

  const handleCopyFieldLink = useCallback(
    async (fieldFqn: string) => {
      const fieldLink = getFieldLink(fieldFqn);
      try {
        await navigator.clipboard.writeText(fieldLink);
        setCopiedFieldFqn(fieldFqn);
        setTimeout(() => setCopiedFieldFqn(undefined), 2000);
      } catch {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = fieldLink;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) {
            setCopiedFieldFqn(fieldFqn);
            setTimeout(() => setCopiedFieldFqn(undefined), 2000);
          }
        } catch {
          // Silently fail if both methods don't work
        }
      }
    },
    [getFieldLink]
  );

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
              getEntityName(record)
            )}
          </span>
        </Tooltip>
        {!isVersionView && (
          <Tooltip
            placement="top"
            title={
              copiedFieldFqn === record.fullyQualifiedName
                ? t('message.link-copy-to-clipboard')
                : t('label.copy-item', { item: t('label.url-uppercase') })
            }>
            <Button
              className="cursor-pointer hover-cell-icon flex-center"
              data-testid="copy-field-link-button"
              disabled={!record.fullyQualifiedName}
              style={{
                color: DE_ACTIVE_COLOR,
                padding: 0,
                border: 'none',
                background: 'transparent',
                width: '24px',
                height: '24px',
              }}
              onClick={() =>
                record.fullyQualifiedName &&
                handleCopyFieldLink(record.fullyQualifiedName)
              }>
              <ShareIcon
                style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
              />
            </Button>
          </Tooltip>
        )}
      </div>
    ),
    [isVersionView, copiedFieldFqn, handleCopyFieldLink, t,handleFieldClick]
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
            ...getTableExpandableConfig<Field>(),
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
