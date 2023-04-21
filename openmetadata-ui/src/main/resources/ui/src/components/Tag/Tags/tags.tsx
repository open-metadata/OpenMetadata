/*
 *  Copyright 2022 Collate.
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

import { CloseOutlined } from '@ant-design/icons';
import { Tag, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { ROUTES } from 'constants/constants';
import { TagSource } from 'generated/type/tagLabel';
import React, { FunctionComponent, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { getTagDisplay, getTagTooltip } from 'utils/TagsUtils';
import { ReactComponent as IconPage } from '../../../assets/svg/ic-flat-doc.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { ReactComponent as IconTag } from '../../../assets/svg/tag-grey.svg';

import { TAG_START_WITH } from 'constants/Tag.constants';
import { TagProps } from './tags.interface';
import './Tags.less';

const Tags: FunctionComponent<TagProps> = ({
  className,
  editable,
  tag,
  startWith,
  type = 'contained',
  showOnlyName = false,
  removeTag,
  isRemovable,
}: TagProps) => {
  const history = useHistory();

  const getTagString = (tag: string) => {
    return tag.startsWith('#') ? tag.slice(1) : tag;
  };

  const isGlossaryTag = useMemo(
    () => tag.source === TagSource.Glossary,
    [tag.source]
  );

  const startIcon = useMemo(() => {
    switch (startWith) {
      case TAG_START_WITH.PLUS:
        return (
          <PlusIcon
            className="flex-shrink"
            height={16}
            name="plus"
            width={16}
          />
        );
      case TAG_START_WITH.SOURCE_ICON:
        return isGlossaryTag ? (
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
        );
      default:
        return startWith;
    }
  }, [startWith, isGlossaryTag]);

  const tagChip = useMemo(() => {
    const tagName = showOnlyName
      ? tag.tagFQN.split(FQN_SEPARATOR_CHAR).slice(-2).join(FQN_SEPARATOR_CHAR)
      : tag.tagFQN;

    return (
      <Tag
        className={classNames('tag-container-style', type, className)}
        closable={editable && isRemovable}
        closeIcon={<CloseOutlined className="tw-text-primary" />}
        data-testid="tags"
        icon={startIcon}
        onClick={() => {
          if (tag.source && startWith !== TAG_START_WITH.PLUS) {
            tag.source === TagSource.Glossary
              ? history.push(`${ROUTES.GLOSSARY}/${tag.tagFQN}`)
              : history.push(`${ROUTES.TAGS}/${tag.tagFQN.split('.')[0]}`);
          }
        }}
        onClose={(e: React.MouseEvent<HTMLElement, MouseEvent>) => {
          e.preventDefault();
          e.stopPropagation();
          removeTag && removeTag(e, getTagString(tag.tagFQN));
        }}>
        <Typography.Paragraph
          className="m-0"
          data-testid={
            startWith === TAG_START_WITH.PLUS ? 'add-tag' : `tag-${tag.tagFQN}`
          }
          style={{
            display: 'inline-block',
            whiteSpace: 'normal',
            wordBreak: 'break-all',
          }}>
          {getTagDisplay(tagName)}
        </Typography.Paragraph>
      </Tag>
    );
  }, [startIcon, tag, editable]);

  return (
    <div className="tags-component-container">
      {startWith === TAG_START_WITH.PLUS ? (
        tagChip
      ) : (
        <Tooltip
          className="cursor-pointer"
          mouseEnterDelay={1.5}
          placement="bottomLeft"
          title={getTagTooltip(tag.tagFQN, tag.description)}
          trigger="hover">
          {tagChip}
        </Tooltip>
      )}
    </div>
  );
};

export default Tags;
