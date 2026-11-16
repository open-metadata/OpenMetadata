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

import {
  Box,
  Card,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

const SKELETON_ROW_KEYS = ['row-1', 'row-2', 'row-3', 'row-4'];

/** Body placeholder while a member's profile loads (header skeleton is separate). */
const MembersUserDetailSkeleton: FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:px-8 tw:pb-8"
      data-testid="user-detail-skeleton"
      direction="col"
      gap={3}>
      <Skeleton height={10} variant="rounded" width={90} />
      <Card
        className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary"
        variant="muted">
        {SKELETON_ROW_KEYS.map((key) => (
          <Box align="center" className="tw:p-5" justify="between" key={key}>
            <Box direction="col" gap={2}>
              <Skeleton height={12} variant="rounded" width={140} />
              <Skeleton height={10} variant="rounded" width={260} />
            </Box>
            <Skeleton height={24} variant="rounded" width={180} />
          </Box>
        ))}
      </Card>
      <Typography color="secondary" size="text-xs">
        {t('message.loading-user-details')}
      </Typography>
    </Box>
  );
};

export default MembersUserDetailSkeleton;
