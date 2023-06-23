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

import { Button, Col, Form, Popover, Row, Space, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import Loader from 'components/Loader/Loader';
import { TableTagsProps } from 'components/TableTags/TableTags.interface';
import Tags from 'components/Tag/Tags/tags';
import {
  API_RES_MAX_SIZE,
  DE_ACTIVE_COLOR,
  PAGE_SIZE_LARGE,
} from 'constants/constants';
import { TAG_CONSTANT, TAG_START_WITH } from 'constants/Tag.constants';
import { EntityType } from 'enums/entity.enum';
import { TagSource } from 'generated/type/tagLabel';
import { isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getGlossariesList, getGlossaryTerms } from 'rest/glossaryAPI';
import { getEntityFeedLink } from 'utils/EntityUtils';
import { getGlossaryTermHierarchy } from 'utils/GlossaryUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import {
  getAllTagsForOptions,
  getTagPlaceholder,
  getTagsHierarchy,
} from 'utils/TagsUtils';
import {
  getRequestTagsPath,
  getUpdateTagsPath,
  TASK_ENTITIES,
} from 'utils/TasksUtils';
import { ReactComponent as IconComments } from '../../../assets/svg/comment.svg';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import TagTree from '../TagsTree/TagsTreeForm.component';
import TagsViewer from '../TagsViewer/tags-viewer';
import {
  GlossaryDetailsProps,
  GlossaryTermDetailsProps,
  TagDetailsProps,
  TagsContainerV1Props,
} from './TagsContainerV1.interface';

const TagsContainerV1 = ({
  permission,
  selectedTags,
  entityType,
  entityThreadLink,
  entityFqn,
  tagType,
  onSelectionChange,
  onThreadLinkSelect,
}: TagsContainerV1Props) => {
  const history = useHistory();
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const [isEditTags, setIsEditTags] = useState(false);
  const [tagDetails, setTagDetails] = useState<TagDetailsProps>({
    isLoading: false,
    isError: false,
    options: [],
  });

  const [glossaryDetails, setGlossaryDetails] = useState<GlossaryDetailsProps>({
    isLoading: false,
    isError: false,
    options: [],
  });

  const [tags, setTags] = useState<TableTagsProps>();

  const isGlossaryType = useMemo(
    () => tagType === TagSource.Glossary,
    [tagType]
  );

  const showAddTagButton = useMemo(
    () => permission && isEmpty(tags?.[tagType]),
    [permission, tags?.[tagType]]
  );

  const selectedTagsInternal = useMemo(
    () => tags?.[tagType].map(({ tagFQN }) => tagFQN as string),
    [tags, tagType]
  );

  const treeData = useMemo(() => {
    const tags = getTagsHierarchy(tagDetails.options);
    const glossary = getGlossaryTermHierarchy(glossaryDetails.options);

    return [...tags, ...glossary];
  }, [tagDetails.options, glossaryDetails.options]);

  const fetchTags = async () => {
    if (isEmpty(tagDetails.options) || tagDetails.isError) {
      setTagDetails((pre) => ({ ...pre, isLoading: true }));
      try {
        const tags = await getAllTagsForOptions();
        setTagDetails((pre) => ({
          ...pre,
          options: tags.map((tag) => {
            return {
              name: tag.name,
              fqn: tag.fullyQualifiedName ?? '',
              classification: tag.classification,
              source: TagSource.Classification,
            };
          }),
        }));
        setIsEditTags(true);
      } catch (_error) {
        setTagDetails((pre) => ({ ...pre, isError: true, options: [] }));
      } finally {
        setTagDetails((pre) => ({ ...pre, isLoading: false }));
      }
    }
  };

  const fetchGlossaryList = async () => {
    if (isEmpty(glossaryDetails.options) || glossaryDetails.isError) {
      setGlossaryDetails((pre) => ({ ...pre, isLoading: true }));
      try {
        const glossaryTermList: GlossaryTermDetailsProps[] = [];
        const { data } = await getGlossariesList({
          limit: PAGE_SIZE_LARGE,
        });

        const promises = data.map((item) =>
          getGlossaryTerms({
            glossary: item.id,
            limit: API_RES_MAX_SIZE,
            fields: 'children,parent',
          })
        );
        const response = await Promise.allSettled(promises);

        response.forEach((res) => {
          if (res.status === 'fulfilled') {
            glossaryTermList.push(
              ...res.value.data.map((data) => ({
                name: data.name,
                fqn: data.fullyQualifiedName ?? '',
                children: data.children,
                parent: data.parent,
                glossary: data.glossary,
                source: TagSource.Glossary,
              }))
            );
          }
        });

        setGlossaryDetails((pre) => ({ ...pre, options: glossaryTermList }));
      } catch (error) {
        setGlossaryDetails((pre) => ({ ...pre, isError: true, options: [] }));
      } finally {
        setGlossaryDetails((pre) => ({ ...pre, isLoading: false }));
      }
    }
  };

  const showNoDataPlaceholder = useMemo(
    () => !showAddTagButton && isEmpty(tags?.[tagType]),
    [showAddTagButton, tags?.[tagType]]
  );

  const getUpdatedTags = (selectedTag: string[]): EntityTags[] => {
    const updatedTags = selectedTag.map((t) => ({
      tagFQN: t,
      source: [...tagDetails.options, ...glossaryDetails.options].find(
        (tag) => tag.fqn === t
      )?.source,
    }));

    return updatedTags;
  };

  const handleSave = (data: string[]) => {
    const updatedTags = getUpdatedTags(data);
    onSelectionChange([
      ...updatedTags,
      ...((isGlossaryType
        ? tags?.[TagSource.Classification]
        : tags?.[TagSource.Glossary]) ?? []),
    ]);
    form.resetFields();
    setIsEditTags(false);
  };

  const handleCancel = useCallback(() => {
    setIsEditTags(false);
    form.resetFields();
  }, [form]);

  const handleAddClick = useCallback(() => {
    if (isGlossaryType) {
      fetchGlossaryList();
    } else {
      fetchTags();
    }
    setIsEditTags(true);
  }, [isGlossaryType, fetchGlossaryList, fetchTags]);

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <span onClick={handleAddClick}>
          <Tags
            className="tw-font-semibold tw-text-primary"
            startWith={TAG_START_WITH.PLUS}
            tag={TAG_CONSTANT}
            type="border"
          />
        </span>
      ) : null,
    [showAddTagButton, fetchTags, fetchGlossaryList]
  );

  const renderTags = useMemo(
    () => (
      <TagsViewer
        isTextPlaceholder
        showNoDataPlaceholder={showNoDataPlaceholder}
        tags={tags?.[tagType] ?? []}
        type="border"
      />
    ),
    [showNoDataPlaceholder, tags?.[tagType]]
  );

  const tagsSelectContainer = useMemo(() => {
    return tagDetails.isLoading || glossaryDetails.isLoading ? (
      <Loader size="small" />
    ) : (
      <TagTree
        defaultValue={selectedTagsInternal ?? []}
        placeholder={getTagPlaceholder(isGlossaryType)}
        treeData={treeData}
        onCancel={handleCancel}
        onSubmit={handleSave}
      />
    );
  }, [
    isGlossaryType,
    selectedTagsInternal,
    glossaryDetails,
    tagDetails,
    treeData,
    handleCancel,
    handleSave,
  ]);

  const handleRequestTags = () => {
    history.push(getRequestTagsPath(entityType as string, entityFqn as string));
  };
  const handleUpdateTags = () => {
    history.push(getUpdateTagsPath(entityType as string, entityFqn as string));
  };

  const requestTagElement = useMemo(() => {
    const hasTags = !isEmpty(tags?.[tagType]);

    return TASK_ENTITIES.includes(entityType as EntityType) ? (
      <Col>
        <Button
          className="p-0 flex-center"
          data-testid="request-entity-tags"
          size="small"
          type="text"
          onClick={hasTags ? handleUpdateTags : handleRequestTags}>
          <Popover
            destroyTooltipOnHide
            content={
              hasTags
                ? t('label.update-request-tag-plural')
                : t('label.request-tag-plural')
            }
            overlayClassName="ant-popover-request-description"
            placement="topLeft"
            trigger="hover"
            zIndex={9999}>
            <IconRequest
              className="anticon"
              height={16}
              name="request-tags"
              width={16}
            />
          </Popover>
        </Button>
      </Col>
    ) : null;
  }, [tags?.[tagType], handleUpdateTags, handleRequestTags]);

  const conversationThreadElement = useMemo(
    () => (
      <Col>
        <Button
          className="p-0 flex-center"
          data-testid="tag-thread"
          size="small"
          type="text"
          onClick={() =>
            onThreadLinkSelect(
              entityThreadLink ??
                getEntityFeedLink(entityType, entityFqn, 'tags')
            )
          }>
          <Space align="center" className="w-full h-full" size={2}>
            <IconComments height={16} name="comments" width={16} />
          </Space>
        </Button>
      </Col>
    ),
    [
      entityType,
      entityFqn,
      entityThreadLink,
      getEntityFeedLink,
      onThreadLinkSelect,
    ]
  );

  useEffect(() => {
    setTags(getFilterTags(selectedTags));
  }, [selectedTags]);

  return (
    <div data-testid={isGlossaryType ? 'glossary-container' : 'tags-container'}>
      <div className="d-flex justify-between m-b-xs">
        <div className="d-flex items-center">
          <Typography.Text className="right-panel-label">
            {isGlossaryType ? t('label.glossary-term') : t('label.tag-plural')}
          </Typography.Text>
          {permission && !isEmpty(tags?.[tagType]) && (
            <Button
              className="cursor-pointer flex-center m-l-xss"
              data-testid="edit-button"
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
              size="small"
              type="text"
              onClick={handleAddClick}
            />
          )}
        </div>
        {permission && (
          <Row gutter={8}>
            {requestTagElement}
            {conversationThreadElement}
          </Row>
        )}
      </div>

      {!isEditTags && (
        <Space wrap align="center" data-testid="entity-tags" size={4}>
          {addTagButton}
          {renderTags}
        </Space>
      )}
      {isEditTags && tagsSelectContainer}
    </div>
  );
};

export default TagsContainerV1;
