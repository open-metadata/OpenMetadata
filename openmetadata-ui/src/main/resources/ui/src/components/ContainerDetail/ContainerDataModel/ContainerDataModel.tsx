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
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from 'components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TableTags from 'components/TableTags/TableTags.component';
import {
  GlossaryTermDetailsProps,
  TagsDetailsProps,
} from 'components/Tag/TagsContainerV1/TagsContainerV1.interface';
import { Column, TagLabel } from 'generated/entity/data/container';
import { TagSource } from 'generated/type/tagLabel';
import { cloneDeep, isEmpty, isUndefined, map, toLower } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  updateContainerColumnDescription,
  updateContainerColumnTags,
} from 'utils/ContainerDetailUtils';
import { getEntityName } from 'utils/EntityUtils';
import {
  getGlossaryTermHierarchy,
  getGlossaryTermsList,
} from 'utils/GlossaryUtils';
import { getTableExpandableConfig } from 'utils/TableUtils';
import { getAllTagsList, getTagsHierarchy } from 'utils/TagsUtils';
import {
  CellRendered,
  ContainerDataModelProps,
} from './ContainerDataModel.interface';

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

      if (newSelectedTags && editColumnTag) {
        const containerDataModel = cloneDeep(dataModel);

        updateContainerColumnTags(
          containerDataModel?.columns,
          editColumnTag.fullyQualifiedName ?? '',
          newSelectedTags
        );

        await onUpdate(containerDataModel);
      }
    },
    [dataModel, onUpdate]
  );

  const handleContainerColumnDescriptionChange = async (
    updatedDescription: string
  ) => {
    if (!isUndefined(editContainerColumnDescription)) {
      const containerDataModel = cloneDeep(dataModel);
      updateContainerColumnDescription(
        containerDataModel?.columns,
        editContainerColumnDescription.fullyQualifiedName ?? '',
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
              <Typography.Text className="text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.description'),
                })}
              </Typography.Text>
            )}
          </>
          {isReadOnly || !hasDescriptionEditAccess ? null : (
            <Button
              className="p-0 opacity-0 group-hover-opacity-100 flex-center"
              data-testid="edit-button"
              icon={<EditIcon width="16px" />}
              type="text"
              onClick={() => setEditContainerColumnDescription(record)}
            />
          )}
        </Space>
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
        render: (
          dataTypeDisplay: Column['dataTypeDisplay'],
          record: Column
        ) => {
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
                {dataTypeDisplay || record.dataType}
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
        width: 350,
        render: renderContainerColumnDescription,
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
        render: (tags: TagLabel[], record: Column, index: number) => (
          <TableTags<Column>
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
      classificationTags,
      tagFetchFailed,
      glossaryTags,
      fetchClassificationTags,
      fetchGlossaryTags,
      handleFieldTagsChange,
      hasDescriptionEditAccess,
      hasTagEditAccess,
      editContainerColumnDescription,
      isReadOnly,
      isTagLoading,
      isGlossaryLoading,
    ]
  );

  if (isEmpty(dataModel?.columns)) {
    return <ErrorPlaceHolder />;
  }

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
        rowKey="name"
        scroll={{ x: 1200 }}
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
