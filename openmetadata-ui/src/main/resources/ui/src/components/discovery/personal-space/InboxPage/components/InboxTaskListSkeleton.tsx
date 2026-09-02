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

interface InboxTaskListSkeletonProps {
  /** Number of placeholder cards to render. */
  count?: number;
}

/**
 * Loading placeholder for the Inbox Tasks left column. Mirrors
 * {@link InboxTaskListItem} so the list does not shift when the real tasks
 * arrive: id + type chip, title line, requester/assignee row, date footer.
 */
const InboxTaskListSkeleton: React.FC<InboxTaskListSkeletonProps> = ({
  count = 6,
}) => (
  <div className="tw:divide-y tw:divide-utility-gray-blue-100">
    {Array.from({ length: count }).map((_, index) => (
      // eslint-disable-next-line react/no-array-index-key -- static fixed-length skeleton, never reordered
      <Box className="tw:px-4 tw:py-4" direction="col" gap={3} key={index}>
        <Box align="center" className="tw:gap-2">
          <Skeleton height={14} variant="text" width={90} />
          <Skeleton height={20} variant="rounded" width={56} />
        </Box>

        <Skeleton height={14} variant="text" width="70%" />

        <Box
          align="center"
          className="tw:gap-2 tw:border-t tw:border-dashed tw:border-utility-gray-blue-100 tw:pt-3">
          <Skeleton height={12} variant="text" width={70} />
          <Skeleton height={18} variant="circular" width={18} />
          <Skeleton height={12} variant="text" width={80} />
        </Box>

        <Box align="center" className="tw:justify-between">
          <Skeleton height={12} variant="text" width={120} />
          <Skeleton height={12} variant="text" width={24} />
        </Box>
      </Box>
    ))}
  </div>
);

export default InboxTaskListSkeleton;
