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

import { Box } from '@openmetadata/ui-core-components';
import { isEmpty, isEqual } from 'lodash';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
    WidgetCommentButton,
    WidgetEditButton,
    WidgetPlusButton,
    WidgetRequestButton
} from '../../../components/common/WidgetActionButton/WidgetActionButton';
import { LIST_SIZE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { LabelType } from '../../../generated/entity/data/table';
import { State, TagLabel, TagSource } from '../../../generated/type/tagLabel';
import EntityLink from '../../../utils/EntityLink';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { stopPropagationIfInteractive } from '../../../utils/InteractiveTargetUtils';
import { getTierTags } from '../../../utils/TablePureUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import {
    getRequestTagsPath,
    getUpdateTagsPath
} from '../../../utils/TaskNavigationUtils';
import ClassificationTagPicker from '../../common/ClassificationTagPicker/ClassificationTagPicker';
import GlossaryTermPicker from '../../common/GlossaryTermPicker/GlossaryTermPicker';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import SuggestionsAlert from '../../Suggestions/SuggestionsAlert/SuggestionsAlert';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
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
  multiSelect,
}: TagsContainerV2Props) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    onThreadLinkSelect,
    activeTagDropdownKey,
    updateActiveTagDropdownKey,
  } = useGenericContext();
  const { selectedUserSuggestions } = useSuggestionsContext();
  const tags = useMemo(() => getFilterTags(selectedTags), [selectedTags]);
  const [internalIsEditTags, setInternalIsEditTags] = useState(false);

  const { isEditTags, dropdownKey } = useMemo(() => {
    const columnDifferentiator = columnData?.fqn || columnData?.name;
    const dropdownKey = `${columnDifferentiator ?? entityFqn}-${tagType}`;

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
    internalIsEditTags,
    useGenericControls,
  ]);

  const handleExternalControl = useCallback(
    (isOpen: boolean) => {
      if (!useGenericControls) {
        setInternalIsEditTags(isOpen);

        return;
      }
      if (isOpen) {
        updateActiveTagDropdownKey(dropdownKey);

        return;
      }
      // Clear only while the key is ours, so a sibling's open is not cancelled.
      if (isEditTags) {
        updateActiveTagDropdownKey(null);
      }
    },
    [useGenericControls, dropdownKey, isEditTags]
  );

  const {
    isGlossaryType,
    showAddTagButton,
    selectedTagsInternal,
    isHoriZontalLayout,
  } = useMemo(
    () => ({
      isGlossaryType: tagType === TagSource.Glossary,
      showAddTagButton: permission && isEmpty(tags?.[tagType]),
      selectedTagsInternal: tags?.[tagType]?.map(({ tagFQN }) => tagFQN),
      isHoriZontalLayout: layoutType === LayoutType.HORIZONTAL,
    }),
    [tagType, permission, tags?.[tagType], tags, layoutType]
  );

  const showNoDataPlaceholder = useMemo(
    () => !showAddTagButton && isEmpty(tags?.[tagType]),
    [showAddTagButton, tags?.[tagType]]
  );

  const handleAddClick = useCallback(() => {
    handleExternalControl(true);
  }, [handleExternalControl]);

  const handleGlossaryTermsChange = useCallback(
    async (terms: TagLabel[]) => {
      const updatedTags = terms.map((term) => ({
        ...term,
        source: TagSource.Glossary,
        labelType: term.labelType ?? defaultLabelType ?? LabelType.Manual,
        state: term.state ?? defaultState ?? State.Confirmed,
      }));

      if (
        onSelectionChange &&
        !isEqual(
          selectedTagsInternal,
          updatedTags.map(({ tagFQN }) => tagFQN)
        )
      ) {
        await onSelectionChange([
          ...updatedTags,
          ...(tags?.[TagSource.Classification] ?? []),
        ]);
      }

      handleExternalControl(false);
    },
    [
      onSelectionChange,
      selectedTagsInternal,
      tags,
      defaultLabelType,
      defaultState,
      handleExternalControl,
    ]
  );

  const handleClassificationTagsChange = useCallback(
    async (incomingTags: TagLabel[]) => {
      const updatedTags = incomingTags.map((tag) => ({
        ...tag,
        source: TagSource.Classification,
        labelType: tag.labelType ?? defaultLabelType ?? LabelType.Manual,
        state: tag.state ?? defaultState ?? State.Confirmed,
      }));

      if (
        onSelectionChange &&
        !isEqual(
          selectedTagsInternal,
          updatedTags.map(({ tagFQN }) => tagFQN)
        )
      ) {
        await onSelectionChange([
          ...updatedTags,
          ...(tags?.[TagSource.Glossary] ?? []),
        ]);
      }

      handleExternalControl(false);
    },
    [
      onSelectionChange,
      selectedTagsInternal,
      tags,
      defaultLabelType,
      defaultState,
      handleExternalControl,
    ]
  );

  // One anchor per layout, so two popovers can never open at once.
  const anchorSlot = newLook ? 'header' : 'body';

  // Both pickers open as popovers anchored to the add/edit button.
  const withSelectorPopover = useCallback(
    (trigger: ReactNode, slot: 'header' | 'body') => {
      if (!trigger || slot !== anchorSlot) {
        return trigger;
      }

      if (isGlossaryType) {
        return (
          <GlossaryTermPicker
            commitMode="staged"
            data-testid="glossary-term-picker"
            isOpen={isEditTags}
            multiple={multiSelect}
            renderTrigger={() => trigger}
            value={tags?.[TagSource.Glossary] ?? []}
            onChange={handleGlossaryTermsChange}
            onOpenChange={handleExternalControl}
          />
        );
      }

      return (
        <ClassificationTagPicker
          commitMode="staged"
          data-testid="classification-tag-picker"
          isOpen={isEditTags}
          multiple={multiSelect}
          renderTrigger={() => trigger}
          value={tags?.[TagSource.Classification] ?? []}
          onChange={handleClassificationTagsChange}
          onOpenChange={handleExternalControl}
        />
      );
    },
    [
      anchorSlot,
      isGlossaryType,
      isEditTags,
      multiSelect,
      tags,
      handleGlossaryTermsChange,
      handleClassificationTagsChange,
      handleExternalControl,
    ]
  );

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <WidgetPlusButton
          data-testid="add-tag"
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
        <TagsViewer
          displayType={displayType}
          entityFqn={columnData?.fqn ?? ''}
          showNoDataPlaceholder={showNoDataPlaceholder}
          sizeCap={sizeCap}
          tagType={tagType}
          tags={tags?.[tagType] ?? []}
        />
      ),
    [
      displayType,
      showNoDataPlaceholder,
      tags?.[tagType],
      layoutType,
      columnData?.fqn,
    ]
  );

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
      <WidgetRequestButton
        data-testid="request-entity-tags"
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
      <WidgetCommentButton
        data-testid="tag-thread"
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

  const headerExtra = useMemo(() => {
    if (!permission) {
      return null;
    }

    return (
      <Box align="center" gap={2}>
        {withSelectorPopover(
          addTagButton ?? (
            <WidgetEditButton
              data-testid="edit-button"
              title={t('label.edit-entity', {
                entity:
                  tagType === TagSource.Classification
                    ? t('label.tag-plural')
                    : t('label.glossary-term'),
              })}
              onClick={handleAddClick}
            />
          ),
          'header'
        )}
        {showTaskHandler && (
          <>
            {tagType === TagSource.Classification && requestTagElement}
            {conversationThreadElement}
          </>
        )}
      </Box>
    );
  }, [
    tags,
    tagType,
    isEditTags,
    permission,
    showTaskHandler,
    requestTagElement,
    conversationThreadElement,
    withSelectorPopover,
    addTagButton,
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
      <Box align="center" gap={2}>
        {withSelectorPopover(addTagButton, 'body')}
        <TagsViewer
          displayType={displayType}
          entityFqn={columnData?.fqn ?? ''}
          showNoDataPlaceholder={showNoDataPlaceholder}
          sizeCap={sizeCap}
          tags={tags?.[tagType] ?? []}
        />
        {showInlineEditButton
          ? withSelectorPopover(editTagButton, 'body')
          : null}
      </Box>
    );
  }, [
    addTagButton,
    editTagButton,
    withSelectorPopover,
    displayType,
    layoutType,
    showNoDataPlaceholder,
    tags?.[tagType],
    showInlineEditButton,
    columnData?.fqn,
  ]);

  const tagBody = useMemo(() => {
    if (isHoriZontalLayout) {
      return horizontalLayout;
    }

    const shouldShowVerticalLayout =
      showInlineEditButton || !isEmpty(renderTags) || !newLook;

    if (!shouldShowVerticalLayout) {
      return null;
    }

    return (
      <Box align="center" data-testid="entity-tags" gap={2} wrap="wrap">
        {addTagButton && (
          <div className="m-t-xss">
            {withSelectorPopover(addTagButton, 'body')}
          </div>
        )}
        {renderTags}
        {showInlineEditButton ? (
          <div>{withSelectorPopover(editTagButton, 'body')}</div>
        ) : null}
      </Box>
    );
  }, [
    addTagButton,
    isHoriZontalLayout,
    horizontalLayout,
    renderTags,
    editTagButton,
    withSelectorPopover,
    showInlineEditButton,
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

  const renderNewLookCard = () => (
    <WidgetCard
      dataTestId={isGlossaryType ? 'glossary-container' : 'tags-container'}
      headerExtra={headerExtra}
      isExpandDisabled={isEmpty(tags?.[tagType])}
      title={isGlossaryType ? t('label.glossary-term') : t('label.tag-plural')}>
      {/* Since WidgetCard is another component without onClick, wrapping the content in a
          div to stop propagation */}
      <div
        role="presentation"
        onClick={(e) => {
          e.stopPropagation();
        }}>
        {suggestionDataRender ?? tagBody}
      </div>
    </WidgetCard>
  );

  if (newLook) {
    return renderNewLookCard();
  }

  return (
    <div
      className="w-full tags-container"
      data-testid={isGlossaryType ? 'glossary-container' : 'tags-container'}
      // Narrowed from an unconditional stopPropagation: the tag links and the add/edit buttons
      // still keep their clicks to themselves, but the padding and the gaps between chips no
      // longer swallow them. On a clickable row or card those dead spots made the whole tags
      // column look unclickable.
      role="presentation"
      onClick={stopPropagationIfInteractive}>
      {suggestionDataRender ?? (
        <>
          {tagBody}
          {(children || showBottomEditButton) && (
            <div className="m-t-xs w-full d-flex items-baseline">
              {showBottomEditButton && !showInlineEditButton && (
                <p className="d-flex m-r-md">
                  {withSelectorPopover(editTagButton, 'body')}
                </p>
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
