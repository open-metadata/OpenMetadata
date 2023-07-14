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

import {
  Button,
  Col,
  Popover,
  Radio,
  RadioChangeEvent,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import { Key } from 'antd/lib/table/interface';
import { ReactComponent as DownUpArrowIcon } from 'assets/svg/ic-down-up-arrow.svg';
import { ReactComponent as UpDownArrowIcon } from 'assets/svg/ic-up-down-arrow.svg';
import classNames from 'classnames';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import TableDescription from 'components/TableDescription/TableDescription.component';
import TableTags from 'components/TableTags/TableTags.component';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import { CSMode } from 'enums/codemirror.enum';
import { EntityType } from 'enums/entity.enum';
import { TagLabel, TagSource } from 'generated/type/tagLabel';
import { cloneDeep, isEmpty, isUndefined, map } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import { DataTypeTopic, Field } from '../../../generated/entity/data/topic';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import {
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TopicSchema.utils';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import {
  SchemaViewType,
  TopicSchemaFieldsProps,
} from './TopicSchema.interface';

const TopicSchemaFields: FC<TopicSchemaFieldsProps> = ({
  messageSchema,
  className,
  hasDescriptionEditAccess,
  isReadOnly,
  onUpdate,
  hasTagEditAccess,
  defaultExpandAllRows = false,
  showSchemaDisplayTypeSwitch = true,
  entityFqn,
  entityFieldThreads,
  onThreadLinkSelect,
}) => {
  const { t } = useTranslation();
  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.FIELDS
  );

  const getAllRowKeys = (data: Field[]) => {
    let keys: string[] = [];
    data.forEach((item) => {
      if (item.children && item.children.length > 0) {
        keys.push(item.name);
        keys = [...keys, ...getAllRowKeys(item.children)];
      }
    });

    return keys;
  };

  const schemaAllRowKeys = useMemo(() => {
    return getAllRowKeys(messageSchema?.schemaFields ?? []);
  }, [messageSchema?.schemaFields]);

  const handleFieldTagsChange = async (
    selectedTags: EntityTags[],
    editColumnTag: Field
  ) => {
    const newSelectedTags: TagOption[] = map(selectedTags, (tag) => ({
      fqn: tag.tagFQN,
      source: tag.source,
    }));

    if (newSelectedTags && editColumnTag && !isUndefined(onUpdate)) {
      const schema = cloneDeep(messageSchema);
      updateFieldTags(
        schema?.schemaFields,
        editColumnTag.fullyQualifiedName ?? '',
        newSelectedTags
      );
      await onUpdate(schema);
    }
  };

  const handleFieldDescriptionChange = async (updatedDescription: string) => {
    if (!isUndefined(editFieldDescription) && !isUndefined(onUpdate)) {
      const schema = cloneDeep(messageSchema);
      updateFieldDescription(
        schema?.schemaFields,
        editFieldDescription.fullyQualifiedName ?? '',
        updatedDescription
      );
      await onUpdate(schema);
      setEditFieldDescription(undefined);
    } else {
      setEditFieldDescription(undefined);
    }
  };

  const toggleExpandAll = () => {
    if (expandedRowKeys.length > 0) {
      setExpandedRowKeys([]);
    } else {
      setExpandedRowKeys(schemaAllRowKeys);
    }
  };

  const handleExpandedRowsChange = (keys: readonly Key[]) => {
    setExpandedRowKeys(keys as string[]);
  };

  const columns: ColumnsType<Field> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        fixed: 'left',
        width: 220,
        render: (_, record: Field) => (
          <Space
            align="start"
            className="w-max-90 vertical-align-inherit"
            size={2}>
            <Popover
              destroyTooltipOnHide
              content={getEntityName(record)}
              trigger="hover">
              <Typography.Text className="break-word">
                {getEntityName(record)}
              </Typography.Text>
            </Popover>
          </Space>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataType',
        key: 'dataType',
        ellipsis: true,
        width: 220,
        render: (dataType: DataTypeTopic, record: Field) => (
          <Typography.Text>
            {record.dataTypeDisplay || dataType}
          </Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: 350,
        render: (_, record, index) => (
          <TableDescription
            columnData={{
              fqn: record.fullyQualifiedName ?? '',
              description: record.description,
            }}
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            entityType={EntityType.TOPIC}
            hasEditPermission={hasDescriptionEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            onClick={() => setEditFieldDescription(record)}
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
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            entityType={EntityType.TOPIC}
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
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
            entityFieldThreads={entityFieldThreads}
            entityFqn={entityFqn}
            entityType={EntityType.TOPIC}
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
      messageSchema,
      hasTagEditAccess,
      editFieldDescription,
      hasDescriptionEditAccess,
      handleFieldTagsChange,
    ]
  );

  const handleViewChange = (e: RadioChangeEvent) => {
    setViewType(e.target.value);
  };

  return (
    <Row className="mt-4" gutter={[16, 16]}>
      <Col>
        <Space>
          <Typography.Text type="secondary">
            {t('label.schema')}
          </Typography.Text>
          <Tag>{messageSchema?.schemaType ?? ''}</Tag>
        </Space>
      </Col>
      {isEmpty(messageSchema?.schemaFields) &&
      isEmpty(messageSchema?.schemaText) ? (
        <ErrorPlaceHolder />
      ) : (
        <>
          {!isEmpty(messageSchema?.schemaFields) &&
            showSchemaDisplayTypeSwitch && (
              <Col className="d-flex items-center justify-between" span={24}>
                <Radio.Group value={viewType} onChange={handleViewChange}>
                  <Radio.Button value={SchemaViewType.FIELDS}>
                    {t('label.field-plural')}
                  </Radio.Button>
                  <Radio.Button value={SchemaViewType.TEXT}>
                    {t('label.text')}
                  </Radio.Button>
                </Radio.Group>

                <Button
                  className="text-primary rounded-4"
                  size="small"
                  type="text"
                  onClick={toggleExpandAll}>
                  <Space align="center" size={4}>
                    {expandedRowKeys.length === schemaAllRowKeys.length ? (
                      <DownUpArrowIcon color={DE_ACTIVE_COLOR} height="14px" />
                    ) : (
                      <UpDownArrowIcon color={DE_ACTIVE_COLOR} height="14px" />
                    )}

                    {expandedRowKeys.length === schemaAllRowKeys.length
                      ? t('label.collapse-all')
                      : t('label.expand-all')}
                  </Space>
                </Button>
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
                bordered
                className={className}
                columns={columns}
                data-testid="topic-schema-fields-table"
                dataSource={messageSchema?.schemaFields}
                expandable={{
                  ...getTableExpandableConfig<Field>(),
                  rowExpandable: (record) => !isEmpty(record.children),
                  onExpandedRowsChange: handleExpandedRowsChange,
                  defaultExpandAllRows,
                  expandedRowKeys,
                }}
                pagination={false}
                rowKey="name"
                scroll={TABLE_SCROLL_VALUE}
                size="small"
              />
            )}
          </Col>
        </>
      )}
      {editFieldDescription && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.schema-field'),
          })}: "${editFieldDescription.name}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.schema-field'),
          })}
          value={editFieldDescription.description ?? ''}
          visible={Boolean(editFieldDescription)}
          onCancel={() => setEditFieldDescription(undefined)}
          onSave={handleFieldDescriptionChange}
        />
      )}
    </Row>
  );
};

export default TopicSchemaFields;
