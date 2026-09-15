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

import { Box, Card, Skeleton } from '@openmetadata/ui-core-components';
import { FC } from 'react';

/**
 * Placeholder row for {@link AgentCard}. The outer chrome and the three column
 * widths are copied from the real card so the list does not reflow when the
 * agents arrive.
 */
const AgentCardSkeleton: FC = () => (
  <Card
    className="tw:rounded-2xl tw:border tw:border-secondary tw:bg-primary tw:px-4.5 tw:py-4 tw:shadow-xs"
    data-testid="agent-card-skeleton"
    variant="ghost">
    <Box align="center" className="tw:gap-3.5">
      {/* identity */}
      <Box
        align="start"
        className="tw:w-[30%] tw:min-w-[300px] tw:max-w-[520px] tw:shrink-0 tw:gap-3">
        <Skeleton
          className="tw:size-9.5 tw:shrink-0 tw:rounded-xl"
          variant="rectangular"
        />
        <div className="tw:min-w-0 tw:flex-1">
          <Skeleton height={14} width="60%" />
          <Skeleton className="tw:mt-1.5" height={10} width="35%" />
        </div>
      </Box>

      {/* live status zone */}
      <div className="tw:min-w-0 tw:flex-1">
        <Skeleton height={22} variant="rounded" width={96} />
        <Skeleton className="tw:mt-2" height={10} width={180} />
      </div>

      {/* actions */}
      <Box align="center" className="tw:shrink-0 tw:gap-2">
        <Skeleton height={32} variant="rounded" width={88} />
        <Skeleton className="tw:size-8" variant="rounded" />
      </Box>
    </Box>
  </Card>
);

export default AgentCardSkeleton;
