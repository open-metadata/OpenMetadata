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

import { Popover, Space, Tag, Typography } from 'antd';
import classNames from 'classnames';
import Tags from 'components/Tag/Tags/tags';
import { TAG_START_WITH } from 'constants/Tag.constants';
import { isEmpty, sortBy, uniqBy } from 'lodash';
import { EntityTags } from 'Models';
import React, { FunctionComponent, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LIST_SIZE, NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TagSource } from '../../../generated/type/tagLabel';
import { TagsViewerProps } from './tags-viewer.interface';
import './tags-viewer.less';

const TagsViewer: FunctionComponent<TagsViewerProps> = ({
  tags,
  sizeCap = LIST_SIZE,
  type = 'label',
  isTextPlaceholder,
  showNoDataPlaceholder = true,
}: TagsViewerProps) => {
  const { t } = useTranslation();
  const tagChipStye = {
    margin: '0 0 8px 0',
    justifyContent: 'start',
  };

  const getTagsElement = useCallback(
    (tag: EntityTags, index: number, style?: React.CSSProperties) => (
      <Tags
        className={classNames(
          { 'diff-added tw-mx-1': tag?.added },
          { 'diff-removed': tag?.removed }
        )}
        key={index}
        showOnlyName={tag.source === TagSource.Glossary}
        startWith={TAG_START_WITH.SOURCE_ICON}
        style={style}
        tag={tag}
        type={type}
      />
    ),
    [type]
  );

  // sort tags by source so that "Glossary" tags always comes first
  const sortedTagsBySource = useMemo(
    () => sortBy(uniqBy(tags, 'tagFQN'), 'source'),
    [tags]
  );

  return (
    <Space wrap size={4}>
      {isEmpty(sortedTagsBySource) && showNoDataPlaceholder ? (
        <Typography.Text className="text-grey-muted m-r-xss">
          {isTextPlaceholder
            ? t('label.no-entity', {
                entity: t('label.tag-plural'),
              })
            : NO_DATA_PLACEHOLDER}
        </Typography.Text>
      ) : sizeCap > -1 ? (
        <>
          {sortedTagsBySource
            .slice(0, sizeCap)
            .map((tag, index) => getTagsElement(tag, index))}

          {sortedTagsBySource.slice(sizeCap).length > 0 && (
            <Popover
              content={
                <>
                  {sortedTagsBySource.slice(sizeCap).map((tag, index) => (
                    <p className="text-left" key={index}>
                      {getTagsElement(tag, index, tagChipStye)}
                    </p>
                  ))}
                </>
              }
              overlayClassName="tag-popover-container"
              placement="bottom"
              trigger="click">
              <Tag data-testid="plus-more-count">{`+${
                sortedTagsBySource.length - LIST_SIZE
              } more`}</Tag>
            </Popover>
          )}
        </>
      ) : (
        <>
          {sortedTagsBySource.map((tag, index) => getTagsElement(tag, index))}
        </>
      )}
    </Space>
  );
};

export default TagsViewer;
