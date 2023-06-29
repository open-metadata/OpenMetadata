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
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import classNames from 'classnames';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import TableTags from 'components/TableTags/TableTags.component';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityField } from 'constants/Feeds.constants';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import { CSMode } from 'enums/codemirror.enum';
import { EntityType } from 'enums/entity.enum';
import { ThreadType } from 'generated/api/feed/createThread';
import { TagLabel, TagSource } from 'generated/type/tagLabel';
import { EntityFieldThreads } from 'interface/feed.interface';
import { cloneDeep, isEmpty, isUndefined, map } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getPartialNameFromTopicFQN } from 'utils/CommonUtils';
import { ENTITY_LINK_SEPARATOR, getEntityName } from 'utils/EntityUtils';
import { getFieldThreadElement } from 'utils/FeedElementUtils';
import {
  getRequestDescriptionPath,
  getUpdateDescriptionPath,
} from 'utils/TasksUtils';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import { DataTypeTopic, Field } from '../../../generated/entity/data/topic';
import { getTableExpandableConfig } from '../../../utils/TableUtils';
import {
  updateFieldDescription,
  updateFieldTags,
} from '../../../utils/TopicSchema.utils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import {
  CellRendered,
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
  entityFieldTasks,
}) => {
  const history = useHistory();
  const { t } = useTranslation();
  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.FIELDS
  );

  const getColumnName = (cell: Field) => {
    const fqn = cell?.fullyQualifiedName || '';
    const columnName = getPartialNameFromTopicFQN(fqn);
    // wrap it in quotes if dot is present

    return columnName.includes(FQN_SEPARATOR_CHAR)
      ? `"${columnName}"`
      : columnName;
  };

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

  const onUpdateDescriptionHandler = (cell: Field) => {
    const field = EntityField.COLUMNS;
    const value = getColumnName(cell);
    history.push(
      getUpdateDescriptionPath(
        EntityType.TOPIC,
        entityFqn as string,
        field,
        value
      )
    );
  };

  const onRequestDescriptionHandler = (cell: Field) => {
    const field = EntityField.COLUMNS;
    const value = getColumnName(cell);
    history.push(
      getRequestDescriptionPath(
        EntityType.TOPIC,
        entityFqn as string,
        field,
        value
      )
    );
  };

  const getRequestDescriptionElement = (cell: Field) => {
    const hasDescription = Boolean(cell?.description ?? '');

    return (
      <Button
        className="p-0 w-7 h-7 flex-none flex-center link-text focus:tw-outline-none hover-cell-icon m-r-xss"
        data-testid="request-description"
        type="text"
        onClick={() =>
          hasDescription
            ? onUpdateDescriptionHandler(cell)
            : onRequestDescriptionHandler(cell)
        }>
        <Popover
          destroyTooltipOnHide
          content={
            hasDescription
              ? t('message.request-update-description')
              : t('message.request-description')
          }
          overlayClassName="ant-popover-request-description"
          trigger="hover"
          zIndex={9999}>
          <IconRequest
            height={14}
            name={t('message.request-description')}
            style={{ color: DE_ACTIVE_COLOR }}
            width={14}
          />
        </Popover>
      </Button>
    );
  };

  const renderFieldDescription: CellRendered<Field, 'description'> = (
    description,
    record,
    index
  ) => {
    return (
      <Space
        className="custom-group w-full"
        data-testid="description"
        direction={isEmpty(description) ? 'horizontal' : 'vertical'}
        id={`field-description-${index}`}
        size={4}>
        <div>
          {description ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          )}
        </div>
        <div className="d-flex tw--mt-1.5">
          {!isReadOnly ? (
            <Fragment>
              {hasDescriptionEditAccess && (
                <>
                  <Button
                    className="p-0 tw-self-start flex-center w-7 h-7 d-flex-none hover-cell-icon"
                    data-testid="edit-button"
                    type="text"
                    onClick={() => setEditFieldDescription(record)}>
                    <EditIcon
                      height={14}
                      name={t('label.edit')}
                      style={{ color: DE_ACTIVE_COLOR }}
                      width={14}
                    />
                  </Button>
                </>
              )}
              {getRequestDescriptionElement(record)}
              {getFieldThreadElement(
                getColumnName(record),
                EntityField.DESCRIPTION,
                entityFieldThreads as EntityFieldThreads[],
                onThreadLinkSelect,
                EntityType.TOPIC,
                entityFqn,
                `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                  record
                )}${ENTITY_LINK_SEPARATOR}description`,
                Boolean(record)
              )}
              {getFieldThreadElement(
                getColumnName(record),
                EntityField.DESCRIPTION,
                entityFieldTasks as EntityFieldThreads[],
                onThreadLinkSelect,
                EntityType.TOPIC,
                entityFqn,
                `columns${ENTITY_LINK_SEPARATOR}${getColumnName(
                  record
                )}${ENTITY_LINK_SEPARATOR}description`,
                Boolean(record),
                ThreadType.Task
              )}
            </Fragment>
          ) : null}
        </div>
      </Space>
    );
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
        render: renderFieldDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
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
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: Field, index: number) => (
          <TableTags<Field>
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasTagEditAccess}
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
              <Col span={24}>
                <Radio.Group value={viewType} onChange={handleViewChange}>
                  <Radio.Button value={SchemaViewType.FIELDS}>
                    {t('label.field-plural')}
                  </Radio.Button>
                  <Radio.Button value={SchemaViewType.TEXT}>
                    {t('label.text')}
                  </Radio.Button>
                </Radio.Group>
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
                  defaultExpandAllRows,
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
