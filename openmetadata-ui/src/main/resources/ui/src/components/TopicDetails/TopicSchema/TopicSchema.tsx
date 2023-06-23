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
import {
  GlossaryTermDetailsProps,
  TagsDetailsProps,
} from 'components/Tag/TagsContainerV1/TagsContainerV1.interface';
import { TABLE_SCROLL_VALUE } from 'constants/Table.constants';
import { CSMode } from 'enums/codemirror.enum';
import { TagLabel, TagSource } from 'generated/type/tagLabel';
import { cloneDeep, isEmpty, isUndefined, map } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import {
  getGlossaryTermHierarchy,
  getGlossaryTermsList,
} from 'utils/GlossaryUtils';
import { getAllTagsList, getTagsHierarchy } from 'utils/TagsUtils';
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
}) => {
  const { t } = useTranslation();
  const [editFieldDescription, setEditFieldDescription] = useState<Field>();
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isGlossaryLoading, setIsGlossaryLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);
  const [viewType, setViewType] = useState<SchemaViewType>(
    SchemaViewType.FIELDS
  );

  const [glossaryTags, setGlossaryTags] = useState<GlossaryTermDetailsProps[]>(
    []
  );
  const [classificationTags, setClassificationTags] = useState<
    TagsDetailsProps[]
  >([]);

  const fetchGlossaryTags = async () => {
    setIsGlossaryLoading(true);
    try {
      const glossaryTermList = await getGlossaryTermsList();
      setGlossaryTags(glossaryTermList);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsGlossaryLoading(false);
    }
  };

  const fetchClassificationTags = async () => {
    setIsTagLoading(true);
    try {
      const tags = await getAllTagsList();
      setClassificationTags(tags);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
    }
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

  const renderFieldDescription: CellRendered<Field, 'description'> = (
    description,
    record,
    index
  ) => {
    return (
      <Space
        className="custom-group w-full"
        data-testid="description"
        id={`field-description-${index}`}
        size={4}>
        <>
          {description ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <Typography.Text className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </Typography.Text>
          )}
        </>
        {isReadOnly && !hasDescriptionEditAccess ? null : (
          <Button
            className="p-0 opacity-0 group-hover-opacity-100"
            data-testid="edit-button"
            icon={<EditIcon width={16} />}
            type="text"
            onClick={() => setEditFieldDescription(record)}
          />
        )}
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
            dataTestId="classification-tags"
            fetchTags={fetchClassificationTags}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            isTagLoading={isTagLoading}
            record={record}
            tagFetchFailed={tagFetchFailed}
            tagList={getTagsHierarchy(classificationTags)}
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
            dataTestId="glossary-tags"
            fetchTags={fetchGlossaryTags}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasTagEditAccess}
            index={index}
            isReadOnly={isReadOnly}
            isTagLoading={isGlossaryLoading}
            record={record}
            tagFetchFailed={tagFetchFailed}
            tagList={getGlossaryTermHierarchy(glossaryTags)}
            tags={tags}
            type={TagSource.Glossary}
          />
        ),
      },
    ],
    [
      handleFieldTagsChange,
      fetchGlossaryTags,
      isGlossaryLoading,
      messageSchema,
      hasDescriptionEditAccess,
      hasTagEditAccess,
      editFieldDescription,
      isReadOnly,
      isTagLoading,
      glossaryTags,
      tagFetchFailed,
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
