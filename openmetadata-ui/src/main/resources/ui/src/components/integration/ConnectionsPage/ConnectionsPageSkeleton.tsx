/*
 *  Copyright 2025 Collate.
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

import { Skeleton } from '@openmetadata/ui-core-components';
import React from 'react';

const SKELETON_GRID_CARDS = 8;
const SKELETON_LIST_ROWS = 8;

interface ConnectionsPageSkeletonProps {
  variant?: 'grid' | 'list';
}

const ConnectionsPageSkeleton: React.FC<ConnectionsPageSkeletonProps> = ({
  variant = 'grid',
}) => {
  if (variant === 'list') {
    return (
      <div
        className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary"
        data-testid="connections-list-skeleton">
        <div className="tw:border-b tw:border-secondary tw:p-4">
          <Skeleton height={20} variant="rounded" width="100%" />
        </div>
        {Array.from({ length: SKELETON_LIST_ROWS }).map((_, index) => (
          <div
            className="tw:border-b tw:border-secondary tw:p-4 last:tw:border-b-0"
            // eslint-disable-next-line react/no-array-index-key -- static fixed-length skeleton, never reordered
            key={index}>
            <Skeleton height={32} variant="rounded" width="100%" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary"
      data-testid="connections-grid-skeleton">
      <div className="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(268px,1fr))] tw:gap-4 tw:p-5">
        {Array.from({ length: SKELETON_GRID_CARDS }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key -- static fixed-length skeleton, never reordered
          <Skeleton height={196} key={index} variant="rounded" width="100%" />
        ))}
      </div>
      <div className="tw:border-t tw:border-secondary tw:p-4">
        <Skeleton height={34} variant="rounded" width="100%" />
      </div>
    </div>
  );
};

export default ConnectionsPageSkeleton;
