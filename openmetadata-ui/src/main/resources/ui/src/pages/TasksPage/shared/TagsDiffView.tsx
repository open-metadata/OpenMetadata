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

import { Tag } from 'antd';
import classNames from 'classnames';
import { ArrayChange } from 'diff';
import { uniqueId } from 'lodash';
import React from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';

export const TagsDiffView = ({
  diffArr,
  className,
}: {
  diffArr: ArrayChange<TagLabel>[];
  className?: string;
}) => {
  const elements = diffArr.map((diff) => {
    if (diff.added) {
      return (
        <div
          className="tw-my-2 tw-flex tw-flex-wrap tw-gap-y-1"
          data-testid="diff-added"
          key={uniqueId()}>
          {diff.value.map((tag) => (
            <Tag
              key={uniqueId()}
              style={{
                background: 'rgba(0, 131, 118, 0.2)',
                color: '#008376',
              }}>
              {tag.tagFQN}
            </Tag>
          ))}
        </div>
      );
    }
    if (diff.removed) {
      return (
        <div
          className="tw-my-2 tw-flex tw-flex-wrap tw-gap-y-1"
          data-testid="diff-removed"
          key={uniqueId()}>
          {diff.value.map((tag) => (
            <Tag
              key={uniqueId()}
              style={{ color: 'grey', textDecoration: 'line-through' }}>
              {tag.tagFQN}
            </Tag>
          ))}
        </div>
      );
    }

    return (
      <div
        className="tw-my-2 tw-flex tw-flex-wrap tw-gap-y-1"
        data-testid="diff-normal"
        key={uniqueId()}>
        {diff.value.length ? (
          diff.value.map((tag) => <Tag key={uniqueId()}>{tag.tagFQN}</Tag>)
        ) : (
          <div
            className="tw-text-grey-muted tw-text-center"
            data-testid="noDiff-placeholder">
            No diff available
          </div>
        )}
      </div>
    );
  });

  return (
    <div
      className={classNames('tw-w-full', className)}
      data-testid="diff-container">
      {elements}
    </div>
  );
};
