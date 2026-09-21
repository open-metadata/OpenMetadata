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

export interface PermissionSectionSkeletonProps {
  // Number of placeholder cards to render.
  rows?: number;
}

/**
 * Loading placeholder for a permission section (Direct Roles / Team
 * Permissions / Other Inherited) shown while the debug info is fetched.
 */
const PermissionSectionSkeleton: React.FC<PermissionSectionSkeletonProps> = ({
  rows = 1,
}) => (
  <Box direction="col" gap={4}>
    {Array.from({ length: rows }).map((_, index) => (
      <Box
        className="tw:rounded-xl tw:border tw:border-secondary tw:p-4"
        direction="col"
        gap={3}
        // eslint-disable-next-line react/no-array-index-key -- static skeleton, never reordered
        key={index}>
        <Skeleton height={16} variant="text" width={220} />
        <Skeleton height={64} variant="rounded" width="100%" />
      </Box>
    ))}
  </Box>
);

export default PermissionSectionSkeleton;
