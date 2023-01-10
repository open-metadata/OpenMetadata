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

import { uniqueId } from 'lodash';
import React from 'react';
import LabelCountSkeleton from '../../CommonSkeletons/LabelCountSkeleton/LabelCountSkeleton.component';
import { EntityListSkeletonProps } from '../../Skeleton.interfaces';
import {
  DEFAULT_SKELETON_DATA_LENGTH,
  getSkeletonMockData,
} from '../../SkeletonUtils/Skeleton.utils';

const EntityListSkeleton = ({
  loading,
  children,
  dataLength = DEFAULT_SKELETON_DATA_LENGTH,
  ...props
}: EntityListSkeletonProps) => {
  return loading ? (
    <div className="m-t-md">
      {getSkeletonMockData(dataLength).map(() => (
        <LabelCountSkeleton
          active
          isLabel
          isSelect
          key={uniqueId()}
          {...props}
        />
      ))}
    </div>
  ) : (
    children
  );
};

export default EntityListSkeleton;
