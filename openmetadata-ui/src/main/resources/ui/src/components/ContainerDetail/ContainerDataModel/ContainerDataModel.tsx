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
import { Button, Popover, Space, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TagsContainer from 'components/Tag/TagsContainer/tags-container';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { Column } from 'generated/entity/data/container';
import { cloneDeep, isEmpty, isUndefined, toLower } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from 'utils/ContainerDetailUtils';
import { getTableExpandableConfig } from 'utils/TableUtils';
import { fetchTagsAndGlossaryTerms } from 'utils/TagsUtils';
import {
  CellRendered,
  ContainerDataModelProps,
} from './ContainerDataModel.interface';

import { ReactComponent as EditIcon } from 'assets/svg/ic-edit.svg';
import { ModalWithMarkdownEditor } from 'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { getEntityName } from 'utils/CommonUtils';

const ContainerDataModel: FC<ContainerDataModelProps> = ({
  dataModel,
  hasDescriptionEditAccess,
  hasTagEditAccess,
  isReadOnly,
  onUpdate,
}) => {
  const { t } = useTranslation();

  const [editContainerColumnDescription, setEditContainerColumnDescription] =
    useState<Column>();
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

  const handleFieldTagsChange = async (selectedTags: EntityTags[] = []) => {
    if (!isUndefined(editContainerColumnTags)) {
      const newSelectedTags: TagOption[] = selectedTags.map((tag) => ({
        fqn: tag.tagFQN,
        source: tag.source,
      }));

      const containerDataModel = cloneDeep(dataModel);

      updateContainerColumnTags(
        containerDataModel?.columns,
        editContainerColumnTags?.name,
        newSelectedTags
      );

      await onUpdate(containerDataModel);
    }
    setEditContainerColumnTags(undefined);
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

  const handleContainerColumnDescriptionChange = async (
    updatedDescription: string
  ) => {
    if (!isUndefined(editContainerColumnDescription)) {
      const containerDataModel = cloneDeep(dataModel);
      updateContainerColumnDescription(
        containerDataModel?.columns,
        editContainerColumnDescription?.name,
        updatedDescription
      );
      await onUpdate(containerDataModel);
    }
    setEditContainerColumnDescription(undefined);
  };

  const renderContainerColumnDescription: CellRendered<Column, 'description'> =
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
              <Typography.Text className="tw-no-description">
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
              icon={<EditIcon width="16px" />}
              type="text"
              onClick={() => setEditContainerColumnDescription(record)}
            />
          )}
        </Space>
      );
    };

  const renderContainerColumnTags: CellRendered<Column, 'tags'> = (
    tags,
    record: Column
  ) => {
    const isSelectedField = editContainerColumnTags?.name === record.name;
    const styleFlag = isSelectedField || !isEmpty(tags);

    return (
      <>
        {isReadOnly ? (
          <Space wrap>
            <TagsViewer sizeCap={-1} tags={tags || []} />
          </Space>
        ) : (
          <Space
            align={styleFlag ? 'start' : 'center'}
            className="justify-between"
            data-testid="tags-wrapper"
            direction={styleFlag ? 'vertical' : 'horizontal'}
            onClick={() => handleAddTagClick(record)}>
            <TagsContainer
              editable={isSelectedField}
              isLoading={isTagLoading && isSelectedField}
              selectedTags={tags || []}
              showAddTagButton={hasTagEditAccess}
              size="small"
              tagList={tagList}
              type="label"
              onCancel={() => setEditContainerColumnTags(undefined)}
              onSelectionChange={handleFieldTagsChange}
            />
          </Space>
        )}
      </>
    );
  };

  const columns: ColumnsType<Column> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        accessor: 'name',
        width: 300,
        render: (_, record: Column) => (
          <Popover
            destroyTooltipOnHide
            content={getEntityName(record)}
            trigger="hover">
            <Typography.Text>{getEntityName(record)}</Typography.Text>
          </Popover>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'dataTypeDisplay',
        key: 'dataTypeDisplay',
        accessor: 'dataTypeDisplay',
        ellipsis: true,
        width: 220,
        render: (dataTypeDisplay: Column['dataTypeDisplay']) => {
          return (
            <Popover
              destroyTooltipOnHide
              content={toLower(dataTypeDisplay)}
              overlayInnerStyle={{
                maxWidth: '420px',
                overflowWrap: 'break-word',
                textAlign: 'center',
              }}
              trigger="hover">
              <Typography.Text ellipsis className="cursor-pointer">
                {dataTypeDisplay}
              </Typography.Text>
            </Popover>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        accessor: 'description',
        render: renderContainerColumnDescription,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        accessor: 'tags',
        width: 350,
        render: renderContainerColumnTags,
      },
    ],
    [
      dataModel,
      hasDescriptionEditAccess,
      hasTagEditAccess,
      editContainerColumnDescription,
      editContainerColumnTags,
      isReadOnly,
      isTagLoading,
    ]
  );

  return (
    <>
      <Table
        bordered
        columns={columns}
        data-testid="container-data-model-table"
        dataSource={dataModel?.columns}
        expandable={{
          ...getTableExpandableConfig<Column>(),
          rowExpandable: (record) => !isEmpty(record.children),
        }}
        pagination={false}
        size="small"
      />
      {editContainerColumnDescription && (
        <ModalWithMarkdownEditor
          header={`${t('label.edit-entity', {
            entity: t('label.column'),
          })}: "${editContainerColumnDescription.name}"`}
          placeholder={t('label.enter-field-description', {
            field: t('label.column'),
          })}
          value={editContainerColumnDescription.description ?? ''}
          visible={Boolean(editContainerColumnDescription)}
          onCancel={() => setEditContainerColumnDescription(undefined)}
          onSave={handleContainerColumnDescriptionChange}
        />
      )}
    </>
  );
};

export default ContainerDataModel;
