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

const OVERVIEW_ROWS = 6;

/**
 * Loading placeholder for the Inbox task detail (right) panel. Mirrors
 * {@link TaskDetailPanel}: id + title with two action buttons, the underline
 * tabs, the overview key/value card, and the comments header + editor.
 */
const TaskDetailSkeleton: React.FC = () => (
  <Box className="tw:h-full tw:w-full" direction="col" gap={4}>
    <Box align="start" className="tw:justify-between tw:gap-3">
      <Box direction="col" gap={2}>
        <Skeleton height={12} variant="text" width={70} />
        <Skeleton height={20} variant="text" width={220} />
      </Box>
      <Box align="center" className="tw:shrink-0" gap={2}>
        <Skeleton height={36} variant="rounded" width={110} />
        <Skeleton height={36} variant="rounded" width={100} />
      </Box>
    </Box>

    <Box align="center" gap={4}>
      <Skeleton height={14} variant="text" width={70} />
      <Skeleton height={14} variant="text" width={60} />
    </Box>

    <Box
      className="tw:rounded-lg tw:border tw:border-secondary tw:p-5"
      direction="col"
      gap={4}>
      {Array.from({ length: OVERVIEW_ROWS }).map((_, index) => (
        <Box className="tw:grid tw:grid-cols-[200px_1fr] tw:gap-3" key={index}>
          <Skeleton height={14} variant="text" width={120} />
          <Skeleton height={14} variant="text" width="60%" />
        </Box>
      ))}
    </Box>

    <Box direction="col" gap={3}>
      <Skeleton height={16} variant="text" width={120} />
      <Skeleton height={96} variant="rounded" width="100%" />
    </Box>
  </Box>
);

export default TaskDetailSkeleton;
