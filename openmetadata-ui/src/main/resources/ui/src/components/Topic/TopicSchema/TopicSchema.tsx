/*
 *  Copyright 2022 Collate.
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

import { Col, Row, Segmented, Tag, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { Key } from 'antd/lib/table/interface';
import classNames from 'classnames';
import { cloneDeep, groupBy, isEmpty, isUndefined, uniqBy } from 'lodash';
import { EntityTags, TagFilterOptions } from 'Models';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HIGHLIGHTED_ROW_SELECTOR,
  TABLE_SCROLL_VALUE,
} from '../../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_TOPIC_VISIBLE_COLUMNS,
  TABLE_COLUMNS_KEYS,
} from '../../../constants/TableKeys.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import {
  DataTypeTopic,
  Field,
  MessageSchemaObject,
  Topic,
} from '../../../generated/entity/data/topic';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
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
  getAllRowKeysByKeyName,
  getExpandAllKeysToDepth,
  getHighlightedRowClassName,
  getSafeExpandAllKeys,
  getSchemaDepth,
  getSchemaFieldCount,
  getTableExpandableConfig,
  isLargeSchema,
  shouldCollapseSchema,
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TableUtils';
import CopyLinkButton from '../../common/CopyLinkButton/CopyLinkButton';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import Table from '../../common/Table/Table';
import ToggleExpandButton from '../../common/ToggleExpandButton/ToggleExpandButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ColumnFilter } from '../../Database/ColumnFilter/ColumnFilter.component';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import TableDescription from '../../Database/TableDescription/TableDescription.component';
import TableTags from '../../Database/TableTags/TableTags.component';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import {
  SchemaViewType,
  TopicSchemaFieldsProps,
} from './TopicSchema.interface';

const TopicSchemaFields: FC<TopicSchemaFieldsProps> = ({
  className,
  schemaTypePlaceholder,
}) => {
  const { t } = useTranslation();
  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.FIELDS
  );

  const viewTypeOptions = [
    {
      label: t('label.field-plural'),
      value: SchemaViewType.FIELDS,
    },
    { label: t('label.text'), value: SchemaViewType.TEXT },
  ];

  const {
    data: topicDetails,
    isVersionView,
    permissions,
    onUpdate,
    currentVersionData,
    openColumnDetailPanel,
    selectedColumn,
    setDisplayedColumns,
  } = useGenericContext<Topic>();

  const {
    entityFqn: topicFqn,
    columnFqn: columnPart,
    fqn,
  } = useFqn({
    type: EntityType.TOPIC,
  });

  const isReadOnly = useMemo(() => {
    // If there is a current version, it should be read only
    return currentVersionData ? true : topicDetails.deleted;
  }, [currentVersionData, topicDetails.deleted]);

  const messageSchema = useMemo(
    () =>
      isVersionView && currentVersionData?.changeDescription
        ? getVersionedSchema(
            currentVersionData?.['messageSchema'] as MessageSchemaObject,
            currentVersionData?.changeDescription
          )
        : topicDetails.messageSchema,
    [currentVersionData, isVersionView, topicDetails]
  );

  const {
    hasDescriptionEditAccess,
    hasTagEditAccess,
    hasGlossaryTermEditAccess,
  } = useMemo(
    () => ({
      hasDescriptionEditAccess:
        permissions.EditAll || permissions.EditDescription,
      hasTagEditAccess: permissions.EditAll || permissions.EditTags,
      hasGlossaryTermEditAccess:
        permissions.EditAll || permissions.EditGlossaryTerms,
    }),
    [permissions]
  );

  const schemaAllRowKeys = useMemo(() => {
    return getAllRowKeysByKeyName<Field>(
      messageSchema?.schemaFields ?? [],
      'fullyQualifiedName'
    );
  }, [messageSchema?.schemaFields]);

  useScrollToElement(
    HIGHLIGHTED_ROW_SELECTOR,
    Boolean(fqn && messageSchema?.schemaFields?.length)
  );

  const getRowClassName = useCallback(
    (record: Field) => getHighlightedRowClassName(record, fqn),
    [fqn]
  );

  const schemaStats = useMemo(() => {
    const fields = messageSchema?.schemaFields ?? [];

    return {
      totalFields: getSchemaFieldCount(fields),
      maxDepth: getSchemaDepth(fields),
      isLargeSchema: isLargeSchema(fields),
      shouldCollapse: shouldCollapseSchema(fields),
    };
  }, [messageSchema?.schemaFields]);

  const handleFieldTagsChange = async (
    selectedTags: EntityTags[],
    editColumnTag: Field
  ) => {
    if (selectedTags && editColumnTag && !isUndefined(onUpdate)) {
      const schema = cloneDeep(messageSchema);
      updateFieldTags<Field>(
        editColumnTag.fullyQualifiedName ?? '',
        selectedTags,
        schema?.schemaFields
      );
      await onUpdate({ ...topicDetails, messageSchema: schema });
    }
  };

  const handleFieldDescriptionChange = async (updatedDescription: string) => {
    if (!isUndefined(editFieldDescription) && !isUndefined(onUpdate)) {
      const schema = cloneDeep(messageSchema);
      updateFieldDescription<Field>(
        editFieldDescription.fullyQualifiedName ?? '',
        updatedDescription,
        schema?.schemaFields
      );
      await onUpdate({ ...topicDetails, messageSchema: schema });
      setEditFieldDescription(undefined);
    } else {
      setEditFieldDescription(undefined);
    }
  };

  const handleColumnClick = useCallback(
    (field: Field, event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          'button, a, input, textarea, select, .table-expand-icon'
        ) !== null
      ) {
        return;
      }
      openColumnDetailPanel(field);
    },
    [openColumnDetailPanel]
  );

  useFqnDeepLink({
    data: topicDetails?.messageSchema?.schemaFields ?? [],
    columnPart,
    fqn,
    setExpandedRowKeys: setExpandedRowKeys,
    openColumnDetailPanel,
    selectedColumn: selectedColumn as Field | null,
  });

  // Sync displayed columns with GenericProvider for ColumnDetailPanel navigation
  useEffect(() => {
    setDisplayedColumns(messageSchema?.schemaFields ?? []);
  }, [messageSchema?.schemaFields, setDisplayedColumns]);

  const toggleExpandAll = () => {
    if (expandedRowKeys.length < schemaAllRowKeys.length) {
      const safeKeys = getSafeExpandAllKeys(
        messageSchema?.schemaFields ?? [],
        schemaStats.isLargeSchema,
        schemaAllRowKeys
      );
      setExpandedRowKeys(safeKeys);
    } else {
      setExpandedRowKeys([]);
    }
  };

  const handleExpandedRowsChange = (keys: readonly Key[]) => {
    setExpandedRowKeys(keys as string[]);
  };

  const renderSchemaName = useCallback(
    (_: unknown, record: Field) => (
      <div
        className="d-inline-flex gap-1 hover-icon-group vertical-align-inherit flex-column items-start"
        style={{ maxWidth: '80%' }}>
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
            entityType={EntityType.TOPIC}
            fieldFqn={record.fullyQualifiedName}
          />
        )}
      </div>
    ),
    [isVersionView]
  );

  const renderDataType = useCallback(
    (dataType: DataTypeTopic, record: Field) => (
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

  const tagFilter = useMemo(() => {
    const tags = getAllTags(messageSchema?.schemaFields ?? []);

    return groupBy(uniqBy(tags, 'value'), (tag) => tag.source) as Record<
      TagSource,
      TagFilterOptions[]
    >;
  }, [messageSchema?.schemaFields]);

  const renderDescription = useCallback(
    (_: string, record: Field, index: number) => (
      <TableDescription
        columnData={{
          fqn: record.fullyQualifiedName ?? '',
          field: record.description,
        }}
        entityFqn={topicFqn}
        entityType={EntityType.TOPIC}
        hasEditPermission={hasDescriptionEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        onClick={() => setEditFieldDescription(record)}
      />
    ),
    [topicFqn, hasDescriptionEditAccess, isReadOnly]
  );

  const renderClassificationTags = useCallback(
    (tags: TagLabel[], record: Field, index: number) => (
      <TableTags<Field>
        entityFqn={topicFqn}
        entityType={EntityType.TOPIC}
        handleTagSelection={handleFieldTagsChange}
        hasTagEditAccess={hasTagEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        record={record}
        tags={tags}
        type={TagSource.Classification}
      />
    ),
    [topicFqn, handleFieldTagsChange, hasTagEditAccess, isReadOnly]
  );

  const renderGlossaryTags = useCallback(
    (tags: TagLabel[], record: Field, index: number) => (
      <TableTags<Field>
        entityFqn={topicFqn}
        entityType={EntityType.TOPIC}
        handleTagSelection={handleFieldTagsChange}
        hasTagEditAccess={hasGlossaryTermEditAccess}
        index={index}
        isReadOnly={isReadOnly}
        record={record}
        tags={tags}
        type={TagSource.Glossary}
      />
    ),
    [topicFqn, handleFieldTagsChange, hasGlossaryTermEditAccess, isReadOnly]
  );

  const columns: ColumnsType<Field> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: TABLE_COLUMNS_KEYS.NAME,
        key: TABLE_COLUMNS_KEYS.NAME,
        fixed: 'left',
        width: 220,
        sorter: getColumnSorter<Field, 'name'>('name'),
        render: renderSchemaName,
        className: 'cursor-pointer hover:text-link-color',
        onCell: (record: Field) => ({
          onClick: (event) => handleColumnClick(record, event),
          'data-testid': 'column-name-cell',
        }),
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
        render: renderDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: TABLE_COLUMNS_KEYS.TAGS,
        key: TABLE_COLUMNS_KEYS.TAGS,
        width: 300,
        filterIcon: columnFilterIcon,
        render: renderClassificationTags,
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
        render: renderGlossaryTags,
        filters: tagFilter.Glossary,
        filterDropdown: ColumnFilter,
        onFilter: searchTagInData,
      },
    ],
    [
      t,
      renderSchemaName,
      renderDataType,
      renderDescription,
      renderClassificationTags,
      renderGlossaryTags,
      tagFilter,
    ]
  );

  useEffect(() => {
    const fields = messageSchema?.schemaFields ?? [];

    if (schemaStats.shouldCollapse) {
      // For large schemas, expand only 2 levels deep for better performance
      const optimalKeys = getExpandAllKeysToDepth(fields, 2);
      setExpandedRowKeys(optimalKeys);
    } else {
      // For small schemas, expand all for better UX
      setExpandedRowKeys(schemaAllRowKeys);
    }
  }, [
    schemaStats.shouldCollapse,
    schemaAllRowKeys,
    messageSchema?.schemaFields,
  ]);

  return (
    <Row gutter={[16, 16]}>
      {messageSchema?.schemaType && (
        <Col>
          <Typography.Text type="secondary">
            {t('label.schema')}
          </Typography.Text>
          {schemaTypePlaceholder ?? (
            <Tag className="ml-4">{messageSchema.schemaType}</Tag>
          )}
        </Col>
      )}
      {isEmpty(messageSchema?.schemaFields) &&
      isEmpty(messageSchema?.schemaText) ? (
        <ErrorPlaceHolder />
      ) : (
        <>
          {!isEmpty(messageSchema?.schemaFields) && !isVersionView && (
            <Col span={24}>
              <Segmented
                className="segment-toggle"
                options={viewTypeOptions}
                value={viewType}
                onChange={(value) => setViewType(value as SchemaViewType)}
              />
            </Col>
          )}

          <Col span={24}>
            {viewType === SchemaViewType.TEXT ||
            isEmpty(messageSchema?.schemaFields) ? (
              messageSchema?.schemaText && (
                <SchemaEditor
                  className="custom-code-mirror-theme custom-query-editor"
                  editorClass={classNames('table-query-editor')}
                  mode={{ name: CSMode.JAVASCRIPT }}
                  options={{
                    styleActiveLine: false,
                  }}
                  value={messageSchema?.schemaText ?? ''}
                />
              )
            ) : (
              <Table
                className={classNames('align-table-filter-left', className)}
                columns={columns}
                data-testid="topic-schema-fields-table"
                dataSource={messageSchema?.schemaFields}
                defaultVisibleColumns={DEFAULT_TOPIC_VISIBLE_COLUMNS}
                expandable={{
                  ...getTableExpandableConfig<Field>(false, 'text-link-color'),
                  rowExpandable: (record) => !isEmpty(record.children),
                  onExpandedRowsChange: handleExpandedRowsChange,
                  expandedRowKeys,
                }}
                extraTableFilters={
                  <ToggleExpandButton
                    allRowKeys={schemaAllRowKeys}
                    expandedRowKeys={expandedRowKeys}
                    toggleExpandAll={toggleExpandAll}
                  />
                }
                pagination={false}
                rowClassName={getRowClassName}
                rowKey="fullyQualifiedName"
                scroll={TABLE_SCROLL_VALUE}
                size="small"
                staticVisibleColumns={COMMON_STATIC_TABLE_VISIBLE_COLUMNS}
              />
            )}
          </Col>
        </>
      )}
      {editFieldDescription && (
        <EntityAttachmentProvider
          entityFqn={editFieldDescription.fullyQualifiedName}
          entityType={EntityType.TOPIC}>
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

export default TopicSchemaFields;
