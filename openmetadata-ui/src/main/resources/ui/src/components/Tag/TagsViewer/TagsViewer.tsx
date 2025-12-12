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

import { Tooltip as MuiTooltip } from '@mui/material';
import { Button, Popover, Tag, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, sortBy, uniqBy } from 'lodash';
import { EntityTags } from 'Models';
import { FunctionComponent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LIST_SIZE, NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { TagSource } from '../../../generated/type/tagLabel';
import {
  getTagName,
  getTagRedirectLink,
  getTagTooltip,
} from '../../../utils/TagsUtils';
import TagChip from '../../common/atoms/TagChip/TagChip';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import TagsV1 from '../TagsV1/TagsV1.component';
import './tags-viewer.less';
import { DisplayType, TagsViewerProps } from './TagsViewer.interface';

const TagsViewer: FunctionComponent<TagsViewerProps> = ({
  tags,
  sizeCap = LIST_SIZE,
  displayType = DisplayType.POPOVER,
  showNoDataPlaceholder = true,
  newLook = false,
}: TagsViewerProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  let muiTags = false;
  try {
    const context = useGenericContext();
    muiTags = context.muiTags || false;
  } catch {
    // Context not available, use default TagsV1
  }

  const getTagsElement = useCallback(
    (tag: EntityTags) => {
      if (muiTags) {
        const tagName = getTagName(tag, true);
        const redirectLink = getTagRedirectLink(tag);

        return (
          <MuiTooltip
            enterDelay={500}
            key={tag.tagFQN}
            placement="bottom-start"
            slotProps={{
              tooltip: {
                sx: {
                  bgcolor: 'common.black',
                  color: 'common.white',
                },
              },
            }}
            title={getTagTooltip(tag.tagFQN, tag.description) ?? ''}>
            <Link
              className={classNames(
                'w-full',
                { 'diff-added tw-mx-1': tag?.added },
                { 'diff-removed': tag?.removed }
              )}
              data-testid="tag-redirect-link"
              to={redirectLink}>
              <TagChip
                data-testid="tags"
                label={tagName}
                labelDataTestId={`tag-${tag.tagFQN}`}
                size="large"
                tagColor={tag.style?.color}
                variant="blueGray"
              />
            </Link>
          </MuiTooltip>
        );
      }

      return (
        <TagsV1
          className={classNames(
            { 'diff-added tw-mx-1': tag?.added },
            { 'diff-removed': tag?.removed }
          )}
          isVersionPage={tag?.added || tag?.removed}
          key={tag.tagFQN}
          newLook={newLook}
          showOnlyName={tag.source === TagSource.Glossary}
          startWith={TAG_START_WITH.SOURCE_ICON}
          tag={tag}
        />
      );
    },
    [muiTags, newLook]
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
            data-testid="read-button"
            size="small"
            type="link"
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
            <Tag
              className={classNames('cursor-pointer plus-more-tag', {
                'new-look': newLook,
              })}
              data-testid="plus-more-count">{`+${
              sortedTagsBySource.length - (sizeCap ?? 0)
            } more`}</Tag>
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
