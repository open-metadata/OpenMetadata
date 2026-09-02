/*
 *  Copyright 2025 Collate.
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
  Popover,
  PopoverTrigger,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty, isEqual, sortBy, uniqBy } from 'lodash';
import { EntityTags } from 'Models';
import { FC, useCallback, useMemo, useState } from 'react';
import { Focusable } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { LIST_SIZE, NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { activateOnEnterOrSpace } from '../../../utils/InteractiveTargetUtils';
import { getTagName, getTagRedirectLink } from '../../../utils/TagsPureUtils';
import { getTagTooltip } from '../../../utils/TagsUtils';
import Tag from '../../common/atoms/Tag/Tag';
import { TagVariant } from '../../common/atoms/Tag/Tag.interface';
import TagSuggestion from '../../common/TagSuggestion/TagSuggestion';
import { DisplayType, TagsProps } from './Tags.interface';

const getVariantForSource = (source?: TagSource): TagVariant =>
  source === TagSource.Glossary ? 'glossary' : 'classification';

const Tags: FC<TagsProps> = ({
  tags,
  mode = 'display',
  tagType,
  onSelectionChange,
  sizeCap = LIST_SIZE,
  displayType = DisplayType.POPOVER,
  showNoDataPlaceholder = true,
  permission = false,
  className,
  defaultLabelType = LabelType.Manual,
  defaultState = State.Confirmed,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const filteredTags = useMemo(() => {
    const unique = sortBy(uniqBy(tags, 'tagFQN'), 'source');

    return tagType ? unique.filter((tag) => tag.source === tagType) : unique;
  }, [tags, tagType]);

  const otherSourceTags = useMemo(
    () => (tagType ? tags.filter((tag) => tag.source !== tagType) : []),
    [tags, tagType]
  );

  const selectedFqns = useMemo(
    () => filteredTags.map((t) => t.tagFQN),
    [filteredTags]
  );

  const handleSelectorChange = useCallback(
    async (updatedTags: EntityTags[]) => {
      if (!onSelectionChange) {
        return;
      }
      const newFqns = updatedTags.map((t) => t.tagFQN);

      if (!isEqual(selectedFqns, newFqns)) {
        await onSelectionChange([...updatedTags, ...otherSourceTags]);
      }
      setIsEditing(false);
    },
    [onSelectionChange, selectedFqns, otherSourceTags]
  );

  const handleTagDelete = useCallback(
    (tagFQN: string) => {
      const updatedTags = filteredTags.filter((t) => t.tagFQN !== tagFQN);
      handleSelectorChange(updatedTags);
    },
    [filteredTags, handleSelectorChange]
  );

  const renderTagChip = useCallback(
    (tag: EntityTags, deletable = false) => {
      const tagName = getTagName(tag, tag.source === TagSource.Glossary);
      const redirectLink = getTagRedirectLink(tag);
      const variant = getVariantForSource(tag.source);

      return (
        <Tooltip
          arrow
          delay={500}
          key={tag.tagFQN}
          placement="top"
          title={getTagTooltip(tag.tagFQN, tag.description) ?? ''}>
          <Focusable>
            <span
              className={classNames('tw:inline-flex', {
                'diff-added tw-mx-1': tag?.added,
                'diff-removed': tag?.removed,
              })}>
              <Tag
                color={tag.style?.color}
                data-testid="tags"
                href={deletable ? undefined : redirectLink}
                icon={tag.style?.iconURL}
                label={tagName}
                size="sm"
                variant={variant}
                onDelete={
                  deletable
                    ? (e) => {
                        e.stopPropagation();
                        handleTagDelete(tag.tagFQN);
                      }
                    : undefined
                }
              />
            </span>
          </Focusable>
        </Tooltip>
      );
    },
    [handleTagDelete]
  );

  const visibleTags = useMemo(
    () =>
      sizeCap < 0 || isOpen ? filteredTags : filteredTags.slice(0, sizeCap),
    [filteredTags, sizeCap, isOpen]
  );

  const overflowCount = useMemo(
    () => (sizeCap >= 0 ? Math.max(0, filteredTags.length - sizeCap) : 0),
    [filteredTags, sizeCap]
  );

  // Selector mode
  if (mode === 'selector') {
    if (isEditing) {
      return (
        <div className={classNames('w-full', className)}>
          <TagSuggestion
            tagType={tagType ?? TagSource.Classification}
            value={filteredTags.map((tag) => ({
              tagFQN: tag.tagFQN,
              source: tag.source,
              name: tag.name,
              displayName: tag.displayName,
              description: tag.description,
              style: tag.style,
              labelType: tag.labelType ?? defaultLabelType,
              state: tag.state ?? defaultState,
            }))}
            onChange={(newTags) => {
              const entityTags: EntityTags[] = newTags.map((t) => ({
                ...t,
                labelType: t.labelType ?? defaultLabelType,
                state: t.state ?? defaultState,
              }));
              handleSelectorChange(entityTags);
            }}
          />
        </div>
      );
    }

    return (
      <div
        className={classNames('w-full', className)}
        data-testid="tags-selector">
        <div className="d-flex flex-wrap gap-2 align-center">
          {filteredTags.map((tag) => renderTagChip(tag, true))}
          {permission && (
            <button
              className="tw:text-xs tw:text-primary tw:bg-transparent tw:border tw:border-dashed tw:border-primary tw:rounded-lg tw:px-2 tw:py-0.5 tw:cursor-pointer tw:h-[24px]"
              data-testid="add-tag"
              tabIndex={0}
              onClick={() => setIsEditing(true)}
              onKeyDown={activateOnEnterOrSpace}>
              {isEmpty(filteredTags)
                ? t('label.add-entity', {
                    entity:
                      tagType === TagSource.Glossary
                        ? t('label.glossary-term')
                        : t('label.tag-plural'),
                  })
                : t('label.edit-entity', {
                    entity:
                      tagType === TagSource.Glossary
                        ? t('label.glossary-term')
                        : t('label.tag-plural'),
                  })}
            </button>
          )}
          {isEmpty(filteredTags) && !permission && showNoDataPlaceholder && (
            <Typography className="tw:text-tertiary" size="text-sm">
              {NO_DATA_PLACEHOLDER}
            </Typography>
          )}
        </div>
      </div>
    );
  }

  // Display mode
  if (isEmpty(filteredTags) && showNoDataPlaceholder) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {NO_DATA_PLACEHOLDER}
      </Typography>
    );
  }

  const overflowPopover =
    overflowCount > 0 && displayType === DisplayType.POPOVER ? (
      <PopoverTrigger
        isOpen={popoverOpen}
        onOpenChange={setPopoverOpen}>
        <button
          className="tw:text-xs tw:text-primary tw:bg-transparent tw:border-0 tw:cursor-pointer tw:px-1"
          data-testid="plus-more-count"
          tabIndex={0}
          onKeyDown={activateOnEnterOrSpace}>
          {`+${overflowCount} ${t('label.more-lowercase')}`}
        </button>
        <Popover containerClassName="tw:flex tw:flex-wrap tw:gap-2 tw:p-2">
          {filteredTags.slice(sizeCap).map((tag) => renderTagChip(tag))}
        </Popover>
      </PopoverTrigger>
    ) : null;

  const readMoreButton =
    overflowCount > 0 && displayType === DisplayType.READ_MORE ? (
      <Button
        color="link-color"
        data-testid="read-button"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}>
        {isOpen
          ? t('label.less')
          : t('label.plus-count-more', { count: overflowCount })}
      </Button>
    ) : null;

  return (
    <div className={classNames('d-flex flex-wrap gap-2', className)}>
      {visibleTags.map((tag) => renderTagChip(tag))}
      {overflowPopover}
      {readMoreButton}
    </div>
  );
};

export default Tags;
