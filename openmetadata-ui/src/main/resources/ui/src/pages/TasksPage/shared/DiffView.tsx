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
import { Change } from 'diff';
import { uniqueId } from 'lodash';
import React from 'react';

export const DiffView = ({
  diffArr,
  className,
}: {
  diffArr: Change[];
  className?: string;
}) => {
  const elements = diffArr.map((diff) => {
    if (diff.added) {
      return (
        <ins className="diff-added" key={uniqueId()}>
          {diff.value}
        </ins>
      );
    }
    if (diff.removed) {
      return (
        <del
          key={uniqueId()}
          style={{ color: 'grey', textDecoration: 'line-through' }}>
          {diff.value}
        </del>
      );
    }

    return <span key={uniqueId()}>{diff.value}</span>;
  });

  return (
    <div
      className={classNames(
        'tw-w-full tw-max-h-52 tw-overflow-y-auto',
        className
      )}>
      <pre className="tw-whitespace-pre-wrap tw-mb-0">
        {diffArr.length ? (
          elements
        ) : (
          <span className="tw-text-grey-muted">No diff available</span>
        )}
      </pre>
    </div>
  );
};
