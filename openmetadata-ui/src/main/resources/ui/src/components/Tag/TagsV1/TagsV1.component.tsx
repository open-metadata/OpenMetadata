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
import React, { useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { ROUTES } from '../../../constants/constants';
import { TagSource } from '../../../generated/type/tagLabel';
import { getTagDisplay, getTagTooltip } from '../../../utils/TagsUtils';

import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as IconTag } from '../../../assets/svg/classification.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { reduceColorOpacity } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import { getEncodedFqn } from '../../../utils/StringsUtils';
import { TagsV1Props } from './TagsV1.interface';
import './tagsV1.less';

const TagsV1 = ({
  tag,
  startWith,
  className,
  showOnlyName = false,
  isVersionPage = false,
  tagProps,
}: TagsV1Props) => {
  const history = useHistory();
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
    [showOnlyName, tag.tagFQN]
  );

  const redirectLink = useCallback(
    () =>
      tag.source === TagSource.Glossary
        ? history.push(`${ROUTES.GLOSSARY}/${getEncodedFqn(tag.tagFQN)}`)
        : history.push(
            `${ROUTES.TAGS}/${getEncodedFqn(Fqn.split(tag.tagFQN)[0])}`
          ),
    [tag.source, tag.tagFQN]
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
      <div className="d-flex w-full">
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
        className={classNames(className, 'tag-chip tag-chip-content')}
        data-testid="tags"
        style={
          color
            ? { backgroundColor: reduceColorOpacity(color, 0.05) }
            : undefined
        }
        onClick={redirectLink}
        {...tagProps}>
        {tagContent}
      </Tag>
    ),
    [color, tagContent, className]
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
    <Tooltip
      className="cursor-pointer"
      mouseEnterDelay={1.5}
      placement="bottomLeft"
      title={getTagTooltip(tag.tagFQN, tag.description)}
      trigger="hover">
      {tagChip}
    </Tooltip>
  );
};

export default TagsV1;
