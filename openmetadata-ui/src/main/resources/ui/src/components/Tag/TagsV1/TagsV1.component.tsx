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
import { Tag, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { ReactComponent as IconTag } from '../../../assets/svg/tag.svg';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { TagSource } from '../../../generated/type/tagLabel';
import { reduceColorOpacity } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getClassificationTagPath,
  getGlossaryPath,
} from '../../../utils/RouterUtils';
import { getTagDisplay, getTagTooltip } from '../../../utils/TagsUtils';
import { HighlightedTagLabel } from '../../Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import { TagsV1Props } from './TagsV1.interface';
import './tagsV1.less';

const TagsV1 = ({
  tag,
  startWith,
  className,
  showOnlyName = false,
  isVersionPage = false,
  tagProps,
  tooltipOverride,
  tagType,
  size,
  isEditTags,
}: TagsV1Props) => {
  const color = useMemo(
    () => (isVersionPage ? undefined : tag.style?.color),
    [tag]
  );

  const isGlossaryTag = useMemo(
    () => tag.source === TagSource.Glossary,
    [tag.source]
  );

  const startIcon = useMemo(
    () =>
      isGlossaryTag ? (
        <IconTerm
          className="flex-shrink m-r-xss"
          data-testid="glossary-icon"
          height={12}
          name="glossary-icon"
          width={12}
        />
      ) : (
        <IconTag
          className="flex-shrink m-r-xss"
          data-testid="tags-icon"
          height={12}
          name="tag-icon"
          width={12}
        />
      ),
    [isGlossaryTag]
  );

  const tagName = useMemo(
    () =>
      getEntityName(tag) ||
      getTagDisplay(
        showOnlyName
          ? tag.tagFQN
              .split(FQN_SEPARATOR_CHAR)
              .slice(-2)
              .join(FQN_SEPARATOR_CHAR)
          : tag.tagFQN
      ),
    [showOnlyName, tag]
  );

  const redirectLink = useMemo(
    () =>
      (tagType ?? tag.source) === TagSource.Glossary
        ? getGlossaryPath(tag.tagFQN)
        : getClassificationTagPath(tag.tagFQN),
    [tagType, tag.source, tag.tagFQN]
  );

  const tagColorBar = useMemo(
    () =>
      color ? (
        <div className="tag-color-bar" style={{ borderColor: color }} />
      ) : null,
    [color]
  );

  const tagContent = useMemo(
    () => (
      <div className="d-flex w-full h-full">
        {tagColorBar}
        <div className="d-flex items-center p-x-xs w-full">
          {tag.style?.iconURL ? (
            <img
              className="m-r-xss"
              data-testid="icon"
              height={12}
              src={tag.style.iconURL}
              width={12}
            />
          ) : (
            startIcon
          )}

          <Typography.Paragraph
            ellipsis
            className="m-0 tags-label"
            data-testid={`tag-${tag.tagFQN}`}
            style={{ color: tag.style?.color }}>
            {tagName}
          </Typography.Paragraph>
        </div>
      </div>
    ),
    [startIcon, tagName, tag, tagColorBar]
  );

  const tagChip = useMemo(
    () => (
      <Tag
        className={classNames(
          className,
          {
            'tag-highlight': Boolean(
              (tag as HighlightedTagLabel).isHighlighted
            ),
          },
          'tag-chip tag-chip-content',
          size,
          'cursor-pointer'
        )}
        data-testid="tags"
        style={
          color
            ? { backgroundColor: reduceColorOpacity(color, 0.05) }
            : undefined
        }
        {...tagProps}>
        {/* Wrap only content to avoid redirect on closeable icons  */}
        <Link
          className="no-underline h-full w-max-stretch"
          data-testid="tag-redirect-link"
          to={redirectLink}>
          {tagContent}
        </Link>
      </Tag>
    ),
    [color, tagContent, redirectLink]
  );

  const addTagChip = useMemo(
    () => (
      <Tag
        className="tag-chip tag-chip-add-button"
        icon={<PlusIcon height={16} name="plus" width={16} />}>
        <Typography.Paragraph
          className="m-0 text-xs font-medium text-primary"
          data-testid="add-tag">
          {getTagDisplay(tagName)}
        </Typography.Paragraph>
      </Tag>
    ),
    [tagName]
  );

  if (startWith === TAG_START_WITH.PLUS) {
    return addTagChip;
  }

  return (
    <>
      {isEditTags ? (
        tagChip
      ) : (
        <Tooltip
          mouseEnterDelay={0.5}
          placement="bottomLeft"
          title={tooltipOverride ?? getTagTooltip(tag.tagFQN, tag.description)}
          trigger="hover">
          {tagChip}
        </Tooltip>
      )}
    </>
  );
};

export default TagsV1;
