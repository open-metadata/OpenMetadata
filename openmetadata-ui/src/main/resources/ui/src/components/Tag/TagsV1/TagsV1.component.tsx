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
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { ROUTES } from 'constants/constants';
import { TagSource } from 'generated/type/tagLabel';
import React, { useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { getTagDisplay, getTagTooltip } from 'utils/TagsUtils';

import { ReactComponent as IconTag } from 'assets/svg/classification.svg';
import { TAG_START_WITH } from 'constants/Tag.constants';
import { reduceColorOpacity } from 'utils/CommonUtils';
import { getEncodedFqn } from 'utils/StringsUtils';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import Fqn from '../../../utils/Fqn';
import { TagsV1Props } from './TagsV1.interface';
import './tagsV1.less';

const color = '';

const TagsV1 = ({
  tag,
  startWith,
  className,
  showOnlyName = false,
}: TagsV1Props) => {
  const history = useHistory();

  const isGlossaryTag = useMemo(
    () => tag.source === TagSource.Glossary,
    [tag.source]
  );

  const startIcon = useMemo(
    () =>
      isGlossaryTag ? (
        <IconTerm
          className="flex-shrink"
          data-testid="glossary-icon"
          height={12}
          name="glossary-icon"
          width={12}
        />
      ) : (
        <IconTag
          className="flex-shrink"
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
      showOnlyName
        ? tag.tagFQN
            .split(FQN_SEPARATOR_CHAR)
            .slice(-2)
            .join(FQN_SEPARATOR_CHAR)
        : tag.tagFQN,
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
        <div className="tag-color-bar" style={{ background: color }} />
      ) : null,
    [color]
  );

  const tagContent = useMemo(
    () => (
      <div className="d-flex w-full">
        {tagColorBar}
        <div className="d-flex items-center p-x-xs w-full">
          <span className="m-r-xss">{startIcon}</span>
          <Typography.Paragraph
            ellipsis
            className="m-0 tags-label"
            data-testid={`tag-${tag.tagFQN}`}>
            {getTagDisplay(tagName)}
          </Typography.Paragraph>
        </div>
      </div>
    ),
    [startIcon, tagName, tag.tagFQN, tagColorBar]
  );

  const tagChip = useMemo(
    () => (
      <Tag
        className={classNames(className, 'tag-chip tag-chip-content')}
        data-testid="tags"
        style={{ backgroundColor: reduceColorOpacity(color, 0.1) }}
        onClick={() => redirectLink()}>
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
