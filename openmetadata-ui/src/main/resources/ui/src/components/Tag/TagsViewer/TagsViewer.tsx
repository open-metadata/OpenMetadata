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

import { Button, Tooltip } from '@openmetadata/ui-core-components';
import { Popover, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, sortBy, uniqBy } from 'lodash';
import { EntityTags } from 'Models';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import { Focusable } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { LIST_SIZE, NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { LabelType, TagSource } from '../../../generated/type/tagLabel';
import EntityLink from '../../../utils/EntityLink';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagName, getTagRedirectLink } from '../../../utils/TagsPureUtils';
import { getTagTooltip } from '../../../utils/TagsUtils';
import AutoClassificationTag from '../../common/atoms/Tag/AutoClassificationTag';
import ClassificationTag from '../../common/atoms/Tag/ClassificationTag';
import GlossaryTag from '../../common/atoms/Tag/GlossaryTag';
import './tags-viewer.less';
import { DisplayType, TagsViewerProps } from './TagsViewer.interface';

const TagsViewer: FunctionComponent<TagsViewerProps> = ({
  tags,
  sizeCap = LIST_SIZE,
  displayType = DisplayType.POPOVER,
  showNoDataPlaceholder = true,
  entityFqn,
  maxWidth,
}: TagsViewerProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const getTagsElement = useCallback(
    (tag: EntityTags) => {
      const tagName = getTagName(tag, tag.source === TagSource.Glossary);
      const redirectLink = getTagRedirectLink(tag);

      // Auto-classification (Generated) tags get a distinct brand-blue badge
      if (tag.labelType === LabelType.Generated && entityFqn) {
        const autoChip = (
          <AutoClassificationTag
            data-testid={`tag-${tag.tagFQN}`}
            href={redirectLink}
            label={tagName}
          />
        );

        // Column-level tags may show a Collate recognizer feedback popup
        const columnName = EntityLink.getTableColumnNameFromColumnFqn(
          entityFqn,
          false
        );
        if (columnName) {
          const popup = tagClassBase.getRecognizerFeedbackPopup(
            tag,
            entityFqn,
            autoChip
          );
          if (popup) {
            return popup;
          }
        }

        return (
          <Tooltip
            arrow
            delay={500}
            key={tag.tagFQN}
            placement="top"
            title={getTagTooltip(tag.tagFQN, tag.description) ?? ''}>
            <Focusable>{autoChip}</Focusable>
          </Tooltip>
        );
      }

      // Regular tags
      const isGlossary = tag.source === TagSource.Glossary;
      const TagComponent = isGlossary ? GlossaryTag : ClassificationTag;

      return (
        <Tooltip
          arrow
          delay={500}
          key={tag.tagFQN}
          placement="top"
          title={getTagTooltip(tag.tagFQN, tag.description) ?? ''}>
          <Focusable>
            <span
              className={classNames('tw:inline-flex')}>
              <TagComponent
                color={tag.style?.color}
                data-testid="tags"
                href={redirectLink}
                icon={tag.style?.iconURL}
                label={tagName}
                maxWidth={maxWidth ?? 130}
                size="sm"
              />
            </span>
          </Focusable>
        </Tooltip>
      );
    },
    [entityFqn]
  );

  // sort tags by source so that "Glossary" tags always comes first
  const sortedTagsBySource = useMemo(
    () => sortBy(uniqBy(tags, 'tagFQN'), 'source'),
    [tags]
  );

  const hasMoreElement = useMemo(
    () => sortedTagsBySource.length > (sizeCap ?? 0),
    [sizeCap, sortedTagsBySource]
  );

  const readMoreRenderElement = useMemo(
    () => (
      <div data-testid="read-more-element">
        {hasMoreElement && (
          <Button
            className="show-more-tags-button"
            color="link-color"
            data-testid="read-button"
            size="xs"
            onClick={() => setIsOpen(!isOpen)}>
            {isOpen
              ? t('label.less')
              : t('label.plus-count-more', {
                  count: sortedTagsBySource.length - sizeCap,
                })}
          </Button>
        )}
      </div>
    ),
    [sizeCap, isOpen, hasMoreElement, sortedTagsBySource]
  );

  const popoverRenderElement = useMemo(
    () =>
      sortedTagsBySource.slice(sizeCap).length > 0 && (
        <div data-testid="popover-element">
          <Popover
            content={
              <div className="d-flex flex-column flex-wrap gap-2">
                {sortedTagsBySource
                  .slice(sizeCap)
                  .map((tag) => getTagsElement(tag))}
              </div>
            }
            overlayClassName="tag-popover-container"
            placement="bottom"
            trigger="click">
            <Button
              color="link-color"
              data-testid="plus-more-count"
              size="xs">
              {`+${sortedTagsBySource.length - (sizeCap ?? 0)} more`}
            </Button>
          </Popover>
        </div>
      ),

    [sizeCap, sortedTagsBySource]
  );

  if (isEmpty(sortedTagsBySource) && showNoDataPlaceholder) {
    return (
      <Typography.Text className="text-grey-muted m-r-xss">
        {NO_DATA_PLACEHOLDER}
      </Typography.Text>
    );
  }

  if (sizeCap < 0) {
    return <>{sortedTagsBySource.map(getTagsElement)}</>;
  }

  // Display tags based on open state
  const displayedTags = isOpen
    ? sortedTagsBySource
    : sortedTagsBySource.slice(0, sizeCap);

  return (
    <>
      <div className="d-flex flex-wrap gap-2">
        {displayedTags.map(getTagsElement)}
        {displayType === DisplayType.POPOVER && popoverRenderElement}
      </div>
      {displayType === DisplayType.READ_MORE && readMoreRenderElement}
    </>
  );
};

export default TagsViewer;
