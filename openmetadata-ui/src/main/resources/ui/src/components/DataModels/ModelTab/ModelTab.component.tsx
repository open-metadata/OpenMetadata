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
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { CellRendered } from 'components/ContainerDetail/ContainerDataModel/ContainerDataModel.interface';
import { ModalWithMarkdownEditor } from 'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from 'components/Tag/TagsContainer/tags-container';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { Column } from 'generated/entity/data/dashboardDataModel';
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  updateDataModelColumnDescription,
  updateDataModelColumnTags,
} from 'utils/DataModelsUtils';
import { fetchTagsAndGlossaryTerms } from 'utils/TagsUtils';
import { ReactComponent as EditIcon } from '../../../assets/svg/ic-edit.svg';
import { ModelTabProps } from './ModelTab.interface';

const ModelTab = ({
  data,
  isReadOnly,
  hasEditDescriptionPermission,
  hasEditTagsPermission,
  onUpdate,
}: ModelTabProps) => {
  console.log(hasEditTagsPermission);

  const { t } = useTranslation();
  const [editColumnDescription, setEditColumnDescription] = useState<Column>();
  const [editContainerColumnTags, setEditContainerColumnTags] =
    useState<Column>();

  const [tagList, setTagList] = useState<TagOption[]>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);

  const fetchTags = async () => {
    setIsTagLoading(true);
    try {
      const tagsAndTerms = await fetchTagsAndGlossaryTerms();
      setTagList(tagsAndTerms);
    } catch (error) {
      setTagList([]);
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
    }
  };

  const handleFieldTagsChange = async (
    selectedTags: EntityTags[] = [],
    selectedColumn: Column
  ) => {
    const newSelectedTags: TagOption[] = selectedTags.map((tag) => ({
      fqn: tag.tagFQN,
      source: tag.source,
    }));

    const dataModelData = cloneDeep(data);

    updateDataModelColumnTags(
      dataModelData,
      editContainerColumnTags?.name ?? selectedColumn.name,
      newSelectedTags
    );

    await onUpdate(dataModelData);

    setEditContainerColumnTags(undefined);
  };

  const handleColumnDescriptionChange = async (updatedDescription: string) => {
    if (!isUndefined(editColumnDescription)) {
      const dataModelColumns = cloneDeep(data);
      updateDataModelColumnDescription(
        dataModelColumns,
        editColumnDescription?.name,
        updatedDescription
      );
      await onUpdate(dataModelColumns);
    }
    setEditColumnDescription(undefined);
  };

  const handleAddTagClick = (record: Column) => {
    if (isUndefined(editContainerColumnTags)) {
      setEditContainerColumnTags(record);
      // Fetch tags and terms only once
      if (tagList.length === 0 || tagFetchFailed) {
        fetchTags();
      }
    }
  };

  const renderColumnDescription: CellRendered<Column, 'description'> = (
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
            <Typography.Text className="tw-no-description">
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
  };

  const renderColumnTags: CellRendered<Column, 'tags'> = (
    tags,
    record: Column
  ) => {
    const isSelectedField = editContainerColumnTags?.name === record.name;
    const isUpdatingTags = isSelectedField || !isEmpty(tags);

    return (
      <>
        {isReadOnly ? (
          <TagsViewer sizeCap={-1} tags={tags || []} />
        ) : (
          <Space
            align={isUpdatingTags ? 'start' : 'center'}
            className="justify-between"
            data-testid="tags-wrapper"
            direction={isUpdatingTags ? 'vertical' : 'horizontal'}
            onClick={() => handleAddTagClick(record)}>
            <TagsContainer
              editable={isSelectedField}
              isLoading={isTagLoading && isSelectedField}
              selectedTags={tags || []}
              showAddTagButton={hasEditTagsPermission}
              size="small"
              tagList={tagList}
              type="label"
              onCancel={() => setEditContainerColumnTags(undefined)}
              onSelectionChange={(tags) => handleFieldTagsChange(tags, record)}
            />
          </Space>
        )}
      </>
    );
  };

  const tableColumn: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        width: 250,
      },
      {
        title: t('label.type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        width: 100,
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        render: renderColumnDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 350,
        render: renderColumnTags,
      },
    ],
    [
      editColumnDescription,
      hasEditDescriptionPermission,
      hasEditTagsPermission,
      editContainerColumnTags,
      isReadOnly,
      isTagLoading,
    ]
  );

  return (
    <>
      <Table
        bordered
        className="p-t-xs"
        columns={tableColumn}
        data-testid="charts-table"
        dataSource={data}
        pagination={false}
        rowKey="name"
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
