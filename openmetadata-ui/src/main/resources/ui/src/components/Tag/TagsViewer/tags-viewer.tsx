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

import { Popover, Tag, Typography } from 'antd';
import classNames from 'classnames';
import { TAG_START_WITH } from 'constants/Tag.constants';
import { isEmpty, sortBy, uniqBy } from 'lodash';
import { EntityTags } from 'Models';
import React, { FunctionComponent, useCallback, useMemo } from 'react';
import { LIST_SIZE, NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TagSource } from '../../../generated/type/tagLabel';
import TagsV1 from '../TagsV1/TagsV1.component';
import { TagsViewerProps } from './tags-viewer.interface';
import './tags-viewer.less';

const TagsViewer: FunctionComponent<TagsViewerProps> = ({
  tags,
  sizeCap = LIST_SIZE,
  type = 'label',
  showNoDataPlaceholder = true,
}: TagsViewerProps) => {
  const getTagsElement = useCallback(
    (tag: EntityTags, index: number) => (
      <TagsV1
        className={classNames(
          { 'diff-added tw-mx-1': tag?.added },
          { 'diff-removed': tag?.removed }
        )}
        key={index}
        showOnlyName={tag.source === TagSource.Glossary}
        startWith={TAG_START_WITH.SOURCE_ICON}
        tag={tag}
      />
    ),
    [type]
  );

  // sort tags by source so that "Glossary" tags always comes first
  const sortedTagsBySource = useMemo(
    () => sortBy(uniqBy(tags, 'tagFQN'), 'source'),
    [tags]
  );

  if (isEmpty(sortedTagsBySource) && showNoDataPlaceholder) {
    return (
      <Typography.Text className="text-grey-muted m-r-xss">
        {NO_DATA_PLACEHOLDER}
      </Typography.Text>
    );
  }

  return (
    <div>
      {sizeCap > -1 ? (
        <>
          {sortedTagsBySource.slice(0, sizeCap).map(getTagsElement)}

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
              overlayClassName="tag-popover-container"
              placement="bottom"
              trigger="click">
              <Tag
                className="cursor-pointer plus-more-tag"
                data-testid="plus-more-count">{`+${
                sortedTagsBySource.length - sizeCap
              } more`}</Tag>
            </Popover>
          )}
        </>
      ) : (
        sortedTagsBySource.map(getTagsElement)
      )}
    </div>
  );
};

export default TagsViewer;
