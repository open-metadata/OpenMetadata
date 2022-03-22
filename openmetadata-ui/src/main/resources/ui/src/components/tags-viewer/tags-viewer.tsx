/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isNil } from 'lodash';
import { EntityTags } from 'Models';
import React, { Fragment, FunctionComponent } from 'react';
import { LIST_SIZE } from '../../constants/constants';
import { Source } from '../../generated/type/tagLabel';
import PopOver from '../common/popover/PopOver';
import Tags from '../tags/tags';
import { TagsViewerProps } from './tags-viewer.interface';

const TagsViewer: FunctionComponent<TagsViewerProps> = ({
  tags,
  sizeCap = LIST_SIZE,
}: TagsViewerProps) => {
  const getTagsElement = (tag: EntityTags, index?: number) => {
    const otherProps: Record<string, string | number> = {};
    if (!isNil(index)) {
      otherProps.key = index;
    }

    return (
      <Tags
        className={classNames(
          { 'diff-added tw-mx-1': tag?.added },
          { 'diff-removed': tag?.removed }
        )}
        showOnlyName={tag.source === Source.Glossary}
        startWith="#"
        tag={tag}
        type="label"
        {...otherProps}
      />
    );
  };

  return sizeCap > -1 ? (
    <Fragment>
      {tags.slice(0, sizeCap).map((tag, index) => getTagsElement(tag, index))}

      {tags.slice(sizeCap).length > 0 && (
        <PopOver
          html={
            <>
              {tags.slice(sizeCap).map((tag, index) => (
                <p className="tw-text-left" key={index}>
                  {getTagsElement(tag)}
                </p>
              ))}
            </>
          }
          position="bottom"
          theme="light"
          trigger="click">
          <span className="tw-cursor-pointer tw-text-xs link-text v-align-sub tw--ml-1">
            •••
          </span>
        </PopOver>
      )}
    </Fragment>
  ) : (
    <Fragment>{tags.map((tag, index) => getTagsElement(tag, index))}</Fragment>
  );
};

export default TagsViewer;
