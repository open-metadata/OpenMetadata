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
import { useTranslation } from 'react-i18next';

const LINEAGE_SKELETON_NODE_COUNT = 3;

export const LineageSkeleton = () => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      aria-label={t('label.loading')}
      className="loading-card tw:min-h-80 tw:justify-center"
      data-testid="lineage-skeleton"
      role="status">
      <Box className="tw:w-full" gap={6} justify="center" wrap="wrap">
        {Array.from({ length: LINEAGE_SKELETON_NODE_COUNT }, (_, index) => (
          <Box
            className="tw:min-w-44 tw:bg-primary tw:rounded-lg tw:border tw:border-secondary tw:p-4"
            data-testid="lineage-skeleton-node"
            direction="col"
            gap={3}
            key={index}>
            <Skeleton height={16} variant="rounded" width="60%" />
            <Skeleton height={14} variant="rounded" width="80%" />
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default LineageSkeleton;
