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

import { reduceColorOpacity } from 'utils/CommonUtils';
import { ReactComponent as IconPage } from '../../../assets/svg/ic-flat-doc.svg';
import { ReactComponent as IconTag } from '../../../assets/svg/tag-grey.svg';
import { TagsV1Props } from './TagsV1.interface';
import './tagsV1.less';

const color = '';

const TagsV1 = ({ tag, showOnlyName = false }: TagsV1Props) => {
  const history = useHistory();

  const isGlossaryTag = useMemo(
    () => tag.source === TagSource.Glossary,
    [tag.source]
  );

  const startIcon = useMemo(
    () =>
      isGlossaryTag ? (
        <IconPage
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
        ? history.push(`${ROUTES.GLOSSARY}/${tag.tagFQN}`)
        : history.push(`${ROUTES.TAGS}/${tag.tagFQN.split('.')[0]}`),
    [tag.source, tag.tagFQN]
  );

  const tagColorBar = useMemo(
    () =>
      color ? (
        <div className="tag-color-bar" style={{ background: color }} />
      ) : null,
    []
  );

  const tagContent = useMemo(
    () => (
      <div className="d-flex">
        {tagColorBar}
        <span className="d-flex items-center p-x-xs">
          <span className="m-r-xss">{startIcon}</span>
          <Typography.Paragraph
            className="m-0 tags-label"
            data-testid={`tag-${tag.tagFQN}`}>
            {getTagDisplay(tagName)}
          </Typography.Paragraph>
        </span>
      </div>
    ),
    [startIcon, tagName, tag.tagFQN]
  );

  const tagChip = useMemo(
    () => (
      <Tag
        className={classNames('tag-container-style-v1')}
        data-testid="tags"
        style={{ backgroundColor: reduceColorOpacity(color, 0.1) }}
        onClick={() => redirectLink()}>
        {tagContent}
      </Tag>
    ),
    []
  );

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
