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

import { Box, Skeleton } from '@openmetadata/ui-core-components';
import React from 'react';

interface RowSkeletonProps {
  /** Number of caption + chips groups to render (e.g. Persona has 2). */
  blocks?: number;
  /** Number of chip placeholders per group. */
  chips?: number;
}

/**
 * Placeholder for the inline-edit cards (Persona / Domains / Teams / Roles)
 * shown while the user's profile fields are still being fetched. Mirrors the
 * card chrome so there is no layout shift once the real content arrives.
 */
const RowSkeleton: React.FC<RowSkeletonProps> = ({ blocks = 1, chips = 2 }) => (
  <Box
    className="ai-profile-page__edit-card tw:w-full tw:p-5"
    direction="col"
    gap={5}>
    {Array.from({ length: blocks }).map((_, blockIndex) => (
      <Box direction="col" gap={2} key={blockIndex}>
        <Skeleton height={14} variant="text" width={120} />
        <Box gap={2}>
          {Array.from({ length: chips }).map((__, chipIndex) => (
            <Skeleton
              height={28}
              key={chipIndex}
              variant="rounded"
              width={110}
            />
          ))}
        </Box>
      </Box>
    ))}
  </Box>
);

export default RowSkeleton;
