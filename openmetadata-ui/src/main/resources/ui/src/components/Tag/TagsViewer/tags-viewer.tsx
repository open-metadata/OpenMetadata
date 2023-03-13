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

import { Popover, Space } from 'antd';
import classNames from 'classnames';
import Tags from 'components/Tag/Tags/tags';
import { sortBy, uniqBy } from 'lodash';
import { EntityTags } from 'Models';
import React, { FunctionComponent, useCallback, useMemo } from 'react';
import { ELLIPSES, LIST_SIZE } from '../../../constants/constants';
import { TagSource } from '../../../generated/type/tagLabel';
import { TagsViewerProps } from './tags-viewer.interface';

const TagsViewer: FunctionComponent<TagsViewerProps> = ({
  tags,
  sizeCap = LIST_SIZE,
  type = 'label',
  showStartWith = true,
}: TagsViewerProps) => {
  const getTagsElement = useCallback(
    (tag: EntityTags, index: number) => {
      // only show hasTag is tagSource is type of "Tag" and showStartWith is true
      const showHasTag =
        tag.source === TagSource.Classification && showStartWith;

      return (
        <Tags
          className={classNames(
            { 'diff-added tw-mx-1': tag?.added },
            { 'diff-removed': tag?.removed }
          )}
          key={index}
          showOnlyName={tag.source === TagSource.Glossary}
          startWith={showHasTag ? '#' : undefined}
          tag={tag}
          type={type}
        />
      );
    },
    [showStartWith, type]
  );

  // sort tags by source so that "Glossary" tags always comes first
  const sortedTagsBySource = useMemo(
    () => sortBy(uniqBy(tags, 'tagFQN'), 'source'),
    [tags]
  );

  return (
    <Space wrap>
      {sizeCap > -1 ? (
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
                      {getTagsElement(tag, index)}
                    </p>
                  ))}
                </>
              }
              placement="bottom"
              trigger="click">
              <span className="cursor-pointer text-xs link-text v-align-sub">
                {ELLIPSES}
              </span>
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
