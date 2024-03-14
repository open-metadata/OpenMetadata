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
import { DefaultOptionType } from 'antd/lib/select';
import { isEmpty, isEqual } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconComments } from '../../../assets/svg/comment.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconRequest } from '../../../assets/svg/request-icon.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import {
  GLOSSARY_CONSTANT,
  TAG_CONSTANT,
  TAG_START_WITH,
} from '../../../constants/Tag.constants';
import { LabelType } from '../../../generated/entity/data/table';
import { TagSource } from '../../../generated/type/tagLabel';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import tagClassBase from '../../../utils/TagClassBase';
import { fetchGlossaryList, getTagPlaceholder } from '../../../utils/TagsUtils';
import {
  getRequestTagsPath,
  getUpdateTagsPath,
} from '../../../utils/TasksUtils';
import { SelectOption } from '../../common/AsyncSelectList/AsyncSelectList.interface';
import { TableTagsProps } from '../../Database/TableTags/TableTags.interface';
import TagSelectForm from '../TagsSelectForm/TagsSelectForm.component';
import TagsV1 from '../TagsV1/TagsV1.component';
import TagsViewer from '../TagsViewer/TagsViewer';
import { LayoutType } from '../TagsViewer/TagsViewer.interface';
import './tags-container.style.less';
import { TagsContainerV2Props } from './TagsContainerV2.interface';

const TagsContainerV2 = ({
  permission,
  showTaskHandler = true,
  selectedTags,
  entityType,
  entityFqn,
  tagType,
  displayType,
  layoutType,
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

  const {
    isGlossaryType,
    showAddTagButton,
    selectedTagsInternal,
    isHoriZontalLayout,
    initialOptions,
  } = useMemo(
    () => ({
      isGlossaryType: tagType === TagSource.Glossary,
      showAddTagButton: permission && isEmpty(tags?.[tagType]),
      selectedTagsInternal: tags?.[tagType].map(({ tagFQN }) => tagFQN),
      initialOptions: tags?.[tagType].map((data) => ({
        label: data.tagFQN,
        value: data.tagFQN,
        data,
      })) as SelectOption[],
      isHoriZontalLayout: layoutType === LayoutType.HORIZONTAL,
    }),
    [tagType, permission, tags?.[tagType], tags, layoutType]
  );

  const fetchAPI = useCallback(
    (searchValue: string, page: number) => {
      if (tagType === TagSource.Classification) {
        return tagClassBase.getTags(searchValue, page);
      } else {
        return fetchGlossaryList(searchValue, page);
      }
    },
    [tagType]
  );

  const showNoDataPlaceholder = useMemo(
    () => !showAddTagButton && isEmpty(tags?.[tagType]),
    [showAddTagButton, tags?.[tagType]]
  );

  const handleSave = async (data: DefaultOptionType | DefaultOptionType[]) => {
    const updatedTags = (data as DefaultOptionType[]).map((tag) => {
      let tagData: EntityTags = {
        tagFQN: typeof tag === 'string' ? tag : tag.value,
        source: tagType,
        labelType: LabelType.Manual,
      };

      if (tag.data) {
        tagData = {
          ...tagData,
          name: tag.data?.name,
          displayName: tag.data?.displayName,
          description: tag.data?.description,
          style: tag.data?.style ?? {},
          labelType: tag.data?.labelType ?? LabelType.Manual,
        };
      }

      return tagData;
    });

    const newTags = updatedTags.map((t) => t.tagFQN);

    if (onSelectionChange && !isEqual(selectedTagsInternal, newTags)) {
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
        <Col className="m-t-xss" onClick={handleAddClick}>
          <TagsV1
            startWith={TAG_START_WITH.PLUS}
            tag={isGlossaryType ? GLOSSARY_CONSTANT : TAG_CONSTANT}
            tagType={tagType}
          />
        </Col>
      ) : null,
    [showAddTagButton]
  );

  const renderTags = useMemo(
    () => (
      <Col span={24}>
        <TagsViewer
          displayType={displayType}
          showNoDataPlaceholder={showNoDataPlaceholder}
          tagType={tagType}
          tags={tags?.[tagType] ?? []}
        />
      </Col>
    ),
    [displayType, showNoDataPlaceholder, tags?.[tagType], layoutType]
  );

  const tagsSelectContainer = useMemo(() => {
    return (
      <TagSelectForm
        defaultValue={selectedTagsInternal ?? []}
        fetchApi={fetchAPI}
        placeholder={getTagPlaceholder(isGlossaryType)}
        tagData={initialOptions}
        tagType={tagType}
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
    initialOptions,
  ]);

  const handleTagsTask = (hasTags: boolean) => {
    history.push(
      (hasTags ? getUpdateTagsPath : getRequestTagsPath)(
        entityType as string,
        entityFqn as string
      )
    );
  };

  const requestTagElement = useMemo(() => {
    const hasTags = !isEmpty(tags?.[tagType]);

    return (
      <Col>
        <Tooltip
          title={
            hasTags
              ? t('label.update-request-tag-plural')
              : t('label.request-tag-plural')
          }>
          <IconRequest
            className="cursor-pointer align-middle"
            data-testid="request-entity-tags"
            height={14}
            name="request-tags"
            style={{ color: DE_ACTIVE_COLOR }}
            width={14}
            onClick={() => handleTagsTask(hasTags)}
          />
        </Tooltip>
      </Col>
    );
  }, [tags?.[tagType], handleTagsTask]);

  const conversationThreadElement = useMemo(
    () => (
      <Col>
        <Tooltip
          title={t('label.list-entity', {
            entity: t('label.conversation'),
          })}>
          <IconComments
            className="cursor-pointer align-middle"
            data-testid="tag-thread"
            height={14}
            name="comments"
            style={{ color: DE_ACTIVE_COLOR }}
            width={14}
            onClick={() =>
              onThreadLinkSelect?.(
                getEntityFeedLink(entityType, entityFqn, 'tags')
              )
            }
          />
        </Tooltip>
      </Col>
    ),
    [entityType, entityFqn, onThreadLinkSelect]
  );

  const header = useMemo(() => {
    return (
      showHeader && (
        <Space align="center" className="m-b-xss w-full" size="middle">
          <Typography.Text className="right-panel-label">
            {isGlossaryType ? t('label.glossary-term') : t('label.tag-plural')}
          </Typography.Text>
          {permission && (
            <Row gutter={12}>
              {!isEmpty(tags?.[tagType]) && !isEditTags && (
                <Col>
                  <Tooltip
                    title={t('label.edit-entity', {
                      entity: t('label.tag-plural'),
                    })}>
                    <EditIcon
                      className="cursor-pointer align-middle"
                      color={DE_ACTIVE_COLOR}
                      data-testid="edit-button"
                      width="14px"
                      onClick={handleAddClick}
                    />
                  </Tooltip>
                </Col>
              )}
              {showTaskHandler && (
                <>
                  {tagType === TagSource.Classification && requestTagElement}
                  {onThreadLinkSelect && conversationThreadElement}
                </>
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
    showTaskHandler,
    isGlossaryType,
    requestTagElement,
    conversationThreadElement,
  ]);

  const editTagButton = useMemo(
    () =>
      permission && !isEmpty(tags?.[tagType]) ? (
        <Tooltip
          title={t('label.edit-entity', {
            entity: t('label.tag-plural'),
          })}>
          <Button
            className="hover-cell-icon cursor-pointer align-middle p-0"
            data-testid="edit-button"
            style={{
              color: DE_ACTIVE_COLOR,
            }}
            type="text"
            onClick={handleAddClick}>
            <EditIcon {...ICON_DIMENSION} />
          </Button>
        </Tooltip>
      ) : null,
    [permission, tags, tagType, handleAddClick]
  );

  const horizontalLayout = useMemo(() => {
    return (
      <Space>
        {showAddTagButton ? (
          <div onClick={handleAddClick}>
            <TagsV1
              startWith={TAG_START_WITH.PLUS}
              tag={isGlossaryType ? GLOSSARY_CONSTANT : TAG_CONSTANT}
              tagType={tagType}
            />
          </div>
        ) : null}
        <TagsViewer
          displayType={displayType}
          showNoDataPlaceholder={showNoDataPlaceholder}
          tags={tags?.[tagType] ?? []}
        />
        {showInlineEditButton ? editTagButton : null}
      </Space>
    );
  }, [
    showAddTagButton,
    displayType,
    layoutType,
    showNoDataPlaceholder,
    tags?.[tagType],
    showInlineEditButton,
    handleAddClick,
  ]);

  const tagBody = useMemo(() => {
    if (isEditTags) {
      return tagsSelectContainer;
    } else {
      return isHoriZontalLayout ? (
        horizontalLayout
      ) : (
        <Row data-testid="entity-tags">
          {addTagButton}
          {renderTags}
          {showInlineEditButton && <Col>{editTagButton}</Col>}
        </Row>
      );
    }
  }, [
    isEditTags,
    tagsSelectContainer,
    addTagButton,
    isHoriZontalLayout,
    horizontalLayout,
    renderTags,
    editTagButton,
  ]);

  useEffect(() => {
    setTags(getFilterTags(selectedTags));
  }, [selectedTags]);

  return (
    <div
      className="w-full tags-container"
      data-testid={isGlossaryType ? 'glossary-container' : 'tags-container'}>
      {header}
      {tagBody}

      {(children || showBottomEditButton) && (
        <Space align="baseline" className="m-t-xs w-full" size="middle">
          {showBottomEditButton && !showInlineEditButton && editTagButton}
          {children}
        </Space>
      )}
    </div>
  );
};

export default TagsContainerV2;
