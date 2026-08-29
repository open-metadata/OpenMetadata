/*
 *  Copyright 2026 Collate.
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

import { Box, Skeleton } from '@openmetadata/ui-core-components';
import React from 'react';

export interface ActivitySkeletonProps {
  // Number of placeholder cards to render.
  count?: number;
}

const DEFAULT_CARD_COUNT = 5;

/**
 * Loading placeholder for the Inbox Activity list. Mirrors
 * {@link ActivityFeedItem}: a date-section header followed by cards with an
 * author row, an indented message block and a footer of action pills.
 */
const ActivityCardSkeleton: React.FC = () => (
  <Box className="tw:px-2 tw:py-3" direction="col" gap={4}>
    <Box align="center" className="tw:justify-between tw:gap-2">
      <Box align="center" gap={2}>
        <Skeleton height={32} variant="circular" width={32} />
        <Skeleton height={14} variant="text" width={110} />
        <Skeleton height={14} variant="text" width={60} />
        <Skeleton height={20} variant="rounded" width={90} />
      </Box>
      <Skeleton height={12} variant="text" width={60} />
    </Box>
    <Skeleton className="tw:ml-10" height={64} variant="rounded" width="100%" />
    <Box className="tw:ml-10" gap={2}>
      <Skeleton height={32} variant="rounded" width={56} />
      <Skeleton height={32} variant="rounded" width={56} />
      <Skeleton height={32} variant="rounded" width={110} />
    </Box>
  </Box>
);

const ActivitySkeleton: React.FC<ActivitySkeletonProps> = ({
  count = DEFAULT_CARD_COUNT,
}) => (
  <Box direction="col" gap={6}>
    <Box className="tw:relative" direction="col" gap={2}>
      {Array.from({ length: count }).map((_, index) => (
        // eslint-disable-next-line react/no-array-index-key -- static fixed-length skeleton, never reordered
        <ActivityCardSkeleton key={index} />
      ))}
    </Box>
  </Box>
);

export default ActivitySkeleton;
