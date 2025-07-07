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

import { Col, Form, Row, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import classNames from 'classnames';
import { isEmpty, isEqual } from 'lodash';
import { EntityTags } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LIST_SIZE } from '../../../constants/constants';
import {
  GLOSSARY_CONSTANT,
  TAG_CONSTANT,
  TAG_START_WITH,
} from '../../../constants/Tag.constants';
import { EntityType } from '../../../enums/entity.enum';
import { LabelType } from '../../../generated/entity/data/table';
import { State, TagSource } from '../../../generated/type/tagLabel';
import EntityLink from '../../../utils/EntityLink';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import { getTierTags } from '../../../utils/TableUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { fetchGlossaryList, getTagPlaceholder } from '../../../utils/TagsUtils';
import {
  getRequestTagsPath,
  getUpdateTagsPath,
} from '../../../utils/TasksUtils';
import { SelectOption } from '../../common/AsyncSelectList/AsyncSelectList.interface';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import {
  CommentIconButton,
  EditIconButton,
  PlusIconButton,
  RequestIconButton,
} from '../../common/IconButtons/EditIconButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { TableTagsProps } from '../../Database/TableTags/TableTags.interface';
import SuggestionsAlert from '../../Suggestions/SuggestionsAlert/SuggestionsAlert';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
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
  showBottomEditButton,
  showInlineEditButton,
  columnData,
  onSelectionChange,
  children,
  defaultLabelType,
  defaultState,
  newLook = false,
  sizeCap = LIST_SIZE,
  useGenericControls,
}: TagsContainerV2Props) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const {
    onThreadLinkSelect,
    activeTagDropdownKey,
    updateActiveTagDropdownKey,
  } = useGenericContext();
  const { selectedUserSuggestions } = useSuggestionsContext();
  const [tags, setTags] = useState<TableTagsProps>();
  const [internalIsEditTags, setInternalIsEditTags] = useState(false);

  const { isEditTags, dropdownKey } = useMemo(() => {
    const dropdownKey = `${columnData?.fqn ?? entityFqn}-${tagType}`;

    return {
      dropdownKey,
      isEditTags: useGenericControls
        ? activeTagDropdownKey === dropdownKey
        : internalIsEditTags,
    };
  }, [
    tagType,
    entityFqn,
    columnData?.fqn,
    activeTagDropdownKey,
    updateActiveTagDropdownKey,
    internalIsEditTags,
    useGenericControls,
  ]);

  // Helper function to handle external/internal control
  const handleExternalControl = useCallback(
    (isOpen: boolean) => {
      if (useGenericControls) {
        isOpen
          ? updateActiveTagDropdownKey(dropdownKey)
          : updateActiveTagDropdownKey(null);
      } else {
        setInternalIsEditTags(isOpen);
      }
    },
    [useGenericControls, dropdownKey]
  );

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
      selectedTagsInternal: tags?.[tagType]?.map(({ tagFQN }) => tagFQN),
      initialOptions: tags?.[tagType]?.map((data) => ({
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
          labelType:
            tag.data?.labelType ?? defaultLabelType ?? LabelType.Manual,
          state: tag.data?.state ?? defaultState ?? State.Confirmed,
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
    handleExternalControl(false);
  };

  const handleCancel = useCallback(() => {
    handleExternalControl(false);
    form.resetFields();
  }, [form, handleExternalControl]);

  const handleAddClick = useCallback(() => {
    handleExternalControl(true);
  }, [handleExternalControl]);

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <PlusIconButton
          className="m-t-xss"
          data-testid="add-tag"
          size="small"
          title={t('label.add-entity', {
            entity: isGlossaryType
              ? t('label.glossary-term')
              : t('label.tag-plural'),
          })}
          onClick={handleAddClick}
        />
      ) : null,
    [showAddTagButton, handleAddClick, t, isGlossaryType]
  );

  const renderTags = useMemo(
    () =>
      isEmpty(tags?.[tagType]) && !showNoDataPlaceholder ? null : (
        <Col span={24}>
          <TagsViewer
            displayType={displayType}
            showNoDataPlaceholder={showNoDataPlaceholder}
            sizeCap={sizeCap}
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
    navigate(
      (hasTags ? getUpdateTagsPath : getRequestTagsPath)(
        entityType as string,
        entityFqn as string
      )
    );
  };

  const requestTagElement = useMemo(() => {
    const hasTags = !isEmpty(tags?.[tagType]);

    return (
      <RequestIconButton
        data-testid="request-entity-tags"
        newLook={newLook}
        size="small"
        title={
          hasTags
            ? t('label.update-request-tag-plural')
            : t('label.request-tag-plural')
        }
        onClick={() => handleTagsTask(hasTags)}
      />
    );
  }, [tags?.[tagType], handleTagsTask]);

  const conversationThreadElement = useMemo(
    () => (
      <CommentIconButton
        data-testid="tag-thread"
        newLook={newLook}
        size="small"
        title={t('label.list-entity', {
          entity: t('label.conversation'),
        })}
        onClick={() =>
          onThreadLinkSelect?.(getEntityFeedLink(entityType, entityFqn, 'tags'))
        }
      />
    ),
    [entityType, entityFqn, onThreadLinkSelect]
  );

  const header = useMemo(() => {
    return (
      <Space>
        <Typography.Text
          className={classNames({
            'text-sm font-medium': newLook,
            'right-panel-label': !newLook,
          })}>
          {isGlossaryType ? t('label.glossary-term') : t('label.tag-plural')}
        </Typography.Text>
        {permission && (
          <>
            {addTagButton ?? (
              <EditIconButton
                data-testid="edit-button"
                newLook={newLook}
                size="small"
                title={t('label.edit-entity', {
                  entity:
                    tagType === TagSource.Classification
                      ? t('label.tag-plural')
                      : t('label.glossary-term'),
                })}
                onClick={handleAddClick}
              />
            )}
            {showTaskHandler && (
              <>
                {tagType === TagSource.Classification && requestTagElement}
                {conversationThreadElement}
              </>
            )}
          </>
        )}
      </Space>
    );
  }, [
    tags,
    tagType,
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
        <EditIconButton
          className="hover-cell-icon"
          data-testid="edit-button"
          newLook={newLook}
          size="small"
          title={t('label.edit-entity', {
            entity:
              tagType === TagSource.Classification
                ? t('label.tag-plural')
                : t('label.glossary-term'),
          })}
          onClick={handleAddClick}
        />
      ) : null,
    [permission, tags, tagType, handleAddClick, newLook]
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
          sizeCap={sizeCap}
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
      ) : showInlineEditButton || !isEmpty(renderTags) || !newLook ? (
        <Row data-testid="entity-tags">
          {showAddTagButton && (
            <Col className="m-t-xss" onClick={handleAddClick}>
              <TagsV1
                startWith={TAG_START_WITH.PLUS}
                tag={isGlossaryType ? GLOSSARY_CONSTANT : TAG_CONSTANT}
                tagType={tagType}
              />
            </Col>
          )}
          {renderTags}
          {showInlineEditButton ? <Col>{editTagButton}</Col> : null}
        </Row>
      ) : null;
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

  const suggestionDataRender = useMemo(() => {
    if (!isGlossaryType && entityType === EntityType.TABLE) {
      const entityLink = EntityLink.getTableEntityLink(
        entityFqn ?? '',
        EntityLink.getTableColumnNameFromColumnFqn(columnData?.fqn ?? '', false)
      );

      const activeSuggestion = selectedUserSuggestions?.tags.find(
        (suggestion) =>
          suggestion.entityLink === entityLink &&
          !getTierTags(suggestion.tagLabels ?? [])
      );

      if (activeSuggestion) {
        return (
          <SuggestionsAlert
            hasEditAccess={permission}
            showSuggestedBy={!entityLink.includes('columns')}
            suggestion={activeSuggestion}
          />
        );
      }
    }

    return null;
  }, [permission, entityType, isGlossaryType, selectedUserSuggestions]);

  useEffect(() => {
    setTags(getFilterTags(selectedTags));
  }, [selectedTags]);

  if (newLook) {
    return (
      <ExpandableCard
        cardProps={{
          title: header,
        }}
        dataTestId={isGlossaryType ? 'glossary-container' : 'tags-container'}
        isExpandDisabled={isEmpty(tags?.[tagType])}>
        {suggestionDataRender ?? tagBody}
      </ExpandableCard>
    );
  }

  return (
    <div
      className="w-full tags-container"
      data-testid={isGlossaryType ? 'glossary-container' : 'tags-container'}>
      {suggestionDataRender ?? (
        <>
          {tagBody}
          {(children || showBottomEditButton) && (
            <div className="m-t-xs w-full d-flex items-baseline">
              {showBottomEditButton && !showInlineEditButton && (
                <p className="d-flex m-r-md">{editTagButton}</p>
              )}
              {children}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TagsContainerV2;
