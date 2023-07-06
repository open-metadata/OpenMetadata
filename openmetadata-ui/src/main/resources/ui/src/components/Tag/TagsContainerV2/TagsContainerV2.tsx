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

import { Button, Col, Form, Row, Space, Tooltip, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { TableTagsProps } from 'components/TableTags/TableTags.interface';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { TAG_CONSTANT, TAG_START_WITH } from 'constants/Tag.constants';
import { EntityType } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { Paging } from 'generated/type/paging';
import { TagSource } from 'generated/type/tagLabel';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getGlossaryTerms } from 'rest/glossaryAPI';
import { searchQuery } from 'rest/searchAPI';
import { formatSearchGlossaryTermResponse } from 'utils/APIUtils';
import { getEntityFeedLink } from 'utils/EntityUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { fetchTagsElasticSearch, getTagPlaceholder } from 'utils/TagsUtils';
import {
  getRequestTagsPath,
  getUpdateTagsPath,
  TASK_ENTITIES,
} from 'utils/TasksUtils';
import { ReactComponent as IconComments } from '../../../assets/svg/comment.svg';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import TagSelectForm from '../TagsSelectForm/TagsSelectForm.component';
import TagsV1 from '../TagsV1/TagsV1.component';
import TagsViewer from '../TagsViewer/tags-viewer';
import { TagsContainerV2Props } from './TagsContainerV2.interface';

const TagsContainerV2 = ({
  permission,
  isVersionView,
  selectedTags,
  entityType,
  entityThreadLink,
  entityFqn,
  tagType,
  showHeader = true,
  showBottomEditButton,
  showInlineEditButton,
  onSelectionChange,
  onThreadLinkSelect,
  children,
}: TagsContainerV2Props) => {
  const history = useHistory();
  const [form] = Form.useForm();
  const { t } = useTranslation();

  const [isEditTags, setIsEditTags] = useState(false);
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
    () => tags?.[tagType].map(({ tagFQN }) => tagFQN),
    [tags, tagType]
  );

  const fetchGlossaryList = useCallback(
    async (
      searchQueryParam: string,
      page: number
    ): Promise<{
      data: {
        label: string;
        value: string;
      }[];
      paging: Paging;
    }> => {
      const glossaryResponse = await searchQuery({
        query: searchQueryParam ? searchQueryParam : '*',
        pageNumber: page,
        pageSize: 10,
        queryFilter: {},
        searchIndex: SearchIndex.GLOSSARY,
      });

      return {
        data: formatSearchGlossaryTermResponse(
          glossaryResponse.hits.hits ?? []
        ).map((item) => ({
          label: item.fullyQualifiedName ?? '',
          value: item.fullyQualifiedName ?? '',
        })),
        paging: {
          total: glossaryResponse.hits.total.value,
        },
      };
    },
    [searchQuery, getGlossaryTerms, formatSearchGlossaryTermResponse]
  );

  const fetchAPI = useCallback(
    (searchValue: string, page: number) => {
      if (tagType === TagSource.Classification) {
        return fetchTagsElasticSearch(searchValue, page);
      } else {
        return fetchGlossaryList(searchValue, page);
      }
    },
    [tagType, fetchGlossaryList]
  );

  const showNoDataPlaceholder = useMemo(
    () => !showAddTagButton && isEmpty(tags?.[tagType]),
    [showAddTagButton, tags?.[tagType]]
  );

  const handleSave = async (data: string[]) => {
    const updatedTags = data.map((t) => ({
      tagFQN: t,
      source: tagType,
    }));

    if (onSelectionChange) {
      await onSelectionChange([
        ...updatedTags,
        ...((isGlossaryType
          ? tags?.[TagSource.Classification]
          : tags?.[TagSource.Glossary]) ?? []),
      ]);
    }

    form.resetFields();
    setIsEditTags(false);
  };

  const handleCancel = useCallback(() => {
    setIsEditTags(false);
    form.resetFields();
  }, [form]);

  const handleAddClick = useCallback(() => {
    setIsEditTags(true);
  }, [isGlossaryType]);

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <span onClick={handleAddClick}>
          <TagsV1 startWith={TAG_START_WITH.PLUS} tag={TAG_CONSTANT} />
        </span>
      ) : null,
    [showAddTagButton]
  );

  const renderTags = useMemo(
    () => (
      <TagsViewer
        showNoDataPlaceholder={showNoDataPlaceholder}
        tags={tags?.[tagType] ?? []}
        type="border"
      />
    ),
    [showNoDataPlaceholder, tags?.[tagType]]
  );

  const tagsSelectContainer = useMemo(() => {
    return (
      <TagSelectForm
        defaultValue={selectedTagsInternal ?? []}
        fetchApi={fetchAPI}
        placeholder={getTagPlaceholder(isGlossaryType)}
        onCancel={handleCancel}
        onSubmit={handleSave}
      />
    );
  }, [
    isGlossaryType,
    selectedTagsInternal,
    getTagPlaceholder,
    fetchAPI,
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
          <Tooltip
            placement="left"
            title={
              hasTags
                ? t('label.update-request-tag-plural')
                : t('label.request-tag-plural')
            }>
            <IconRequest
              className="anticon"
              height={14}
              name="request-tags"
              style={{ color: DE_ACTIVE_COLOR }}
              width={14}
            />
          </Tooltip>
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
            onThreadLinkSelect?.(
              entityThreadLink ??
                getEntityFeedLink(entityType, entityFqn, 'tags')
            )
          }>
          <Tooltip
            placement="left"
            title={t('label.list-entity', {
              entity: t('label.conversation'),
            })}>
            <IconComments
              height={14}
              name="comments"
              style={{ color: DE_ACTIVE_COLOR }}
              width={14}
            />
          </Tooltip>
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

  const header = useMemo(() => {
    return (
      showHeader && (
        <Space align="center" className="m-b-xss w-full" size="middle">
          <Typography.Text className="right-panel-label">
            {isGlossaryType ? t('label.glossary-term') : t('label.tag-plural')}
          </Typography.Text>
          {permission && (
            <Row gutter={8}>
              {!isEmpty(tags?.[tagType]) && !isEditTags && (
                <Button
                  className="cursor-pointer flex-center"
                  data-testid="edit-button"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                  onClick={handleAddClick}
                />
              )}
              {permission && !isVersionView && (
                <Row gutter={8}>
                  {tagType === TagSource.Classification && requestTagElement}
                  {onThreadLinkSelect && conversationThreadElement}
                </Row>
              )}
            </Row>
          )}
        </Space>
      )
    );
  }, [
    tags,
    tagType,
    showHeader,
    isEditTags,
    permission,
    isVersionView,
    isGlossaryType,
    requestTagElement,
    conversationThreadElement,
  ]);

  const editTagButton = useMemo(
    () =>
      permission && !isEmpty(tags?.[tagType]) ? (
        <Button
          className="p-0 w-7 h-7 flex-center text-primary hover-cell-icon"
          data-testid="edit-button"
          icon={
            <EditIcon
              height={14}
              name={t('label.edit')}
              style={{ color: DE_ACTIVE_COLOR }}
              width={14}
            />
          }
          size="small"
          type="text"
          onClick={handleAddClick}
        />
      ) : null,
    [permission, tags, tagType, handleAddClick]
  );

  useEffect(() => {
    setTags(getFilterTags(selectedTags));
  }, [selectedTags]);

  return (
    <div
      className="w-full"
      data-testid={isGlossaryType ? 'glossary-container' : 'tags-container'}>
      {header}

      {!isEditTags && (
        <Space wrap align="center" data-testid="entity-tags" size={4}>
          {addTagButton}
          {renderTags}
          {showInlineEditButton && editTagButton}
        </Space>
      )}
      {isEditTags && tagsSelectContainer}

      <div className="m-t-xss d-flex items-center">
        {showBottomEditButton && !showInlineEditButton && editTagButton}
        {children}
      </div>
    </div>
  );
};

export default TagsContainerV2;
