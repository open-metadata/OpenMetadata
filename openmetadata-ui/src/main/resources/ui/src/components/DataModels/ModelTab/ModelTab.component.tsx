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
import { Button, Space, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { CellRendered } from 'components/ContainerDetail/ContainerDataModel/ContainerDataModel.interface';
import { ModalWithMarkdownEditor } from 'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TableTags from 'components/TableTags/TableTags.component';
import {
  GlossaryTermDetailsProps,
  TagsDetailsProps,
} from 'components/Tag/TagsContainerV1/TagsContainerV1.interface';
import { Column } from 'generated/entity/data/dashboardDataModel';
import { TagLabel, TagSource } from 'generated/type/tagLabel';
import { cloneDeep, isUndefined, map } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  updateDataModelColumnDescription,
  updateDataModelColumnTags,
} from 'utils/DataModelsUtils';
import { getEntityName } from 'utils/EntityUtils';
import {
  getGlossaryTermHierarchy,
  getGlossaryTermsList,
} from 'utils/GlossaryUtils';
import { getAllTagsList, getTagsHierarchy } from 'utils/TagsUtils';
import { ModelTabProps } from './ModelTab.interface';

const ModelTab = ({
  data,
  isReadOnly,
  hasEditDescriptionPermission,
  hasEditTagsPermission,
  onUpdate,
}: ModelTabProps) => {
  const { t } = useTranslation();
  const [editColumnDescription, setEditColumnDescription] = useState<Column>();
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isGlossaryLoading, setIsGlossaryLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);

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

  const handleFieldTagsChange = useCallback(
    async (selectedTags: EntityTags[], editColumnTag: Column) => {
      const newSelectedTags: TagOption[] = map(selectedTags, (tag) => ({
        fqn: tag.tagFQN,
        source: tag.source,
      }));

      const dataModelData = cloneDeep(data);

      updateDataModelColumnTags(
        dataModelData,
        editColumnTag.fullyQualifiedName ?? '',
        newSelectedTags
      );

      await onUpdate(dataModelData);
    },
    [data, updateDataModelColumnTags]
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
        await onUpdate(dataModelColumns);
      }
      setEditColumnDescription(undefined);
    },
    [editColumnDescription, data]
  );

  const renderColumnDescription: CellRendered<Column, 'description'> =
    useCallback(
      (description, record, index) => {
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
            {isReadOnly && !hasEditDescriptionPermission ? null : (
              <Button
                className="p-0 opacity-0 group-hover-opacity-100"
                data-testid="edit-button"
                icon={<EditIcon width="16px" />}
                type="text"
                onClick={() => setEditColumnDescription(record)}
              />
            )}
          </Space>
        );
      },
      [isReadOnly, hasEditDescriptionPermission]
    );

  const tableColumn: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 250,
        render: (_, record) => (
          <Typography.Text>{getEntityName(record)}</Typography.Text>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataType',
        key: 'dataType',
        width: 100,
        render: (dataType, record) => (
          <Typography.Text>
            {record.dataTypeDisplay || dataType}
          </Typography.Text>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        width: 350,
        render: renderColumnDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 300,
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            dataTestId="classification-tags"
            fetchTags={fetchClassificationTags}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditTagsPermission}
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
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
            dataTestId="glossary-tags"
            fetchTags={fetchGlossaryTags}
            handleTagSelection={handleFieldTagsChange}
            hasTagEditAccess={hasEditTagsPermission}
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
      fetchClassificationTags,
      fetchGlossaryTags,
      handleFieldTagsChange,
      glossaryTags,
      classificationTags,
      tagFetchFailed,
      hasEditTagsPermission,
      editColumnDescription,
      hasEditDescriptionPermission,
      isReadOnly,
      isTagLoading,
      isGlossaryLoading,
    ]
  );

  return (
    <>
      <Table
        bordered
        className="p-t-xs"
        columns={tableColumn}
        data-testid="data-model-column-table"
        dataSource={data}
        pagination={false}
        rowKey="name"
        scroll={{ x: 1200 }}
        size="small"
      />

      {editColumnDescription && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.column'),
          })}: "${editColumnDescription.name}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.column'),
          })}
          value={editColumnDescription.description || ''}
          visible={Boolean(editColumnDescription)}
          onCancel={() => setEditColumnDescription(undefined)}
          onSave={handleColumnDescriptionChange}
        />
      )}
    </>
  );
};

export default ModelTab;
