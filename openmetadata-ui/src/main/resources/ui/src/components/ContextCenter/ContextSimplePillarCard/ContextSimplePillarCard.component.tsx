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
import { ContextSimplePillarCardProps } from './ContextSimplePillarCard.interface';

const ContextSimplePillarCard: FC<ContextSimplePillarCardProps> = ({
  title,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  dataTestId,
  children,
}) => {
  return (
    <Card
      className="tw:h-full tw:flex tw:flex-col tw:p-4"
      data-testid={dataTestId}>
      <div className="tw:mb-3 tw:shrink-0">
        <Typography
          className="tw:text-quaternary tw:uppercase"
          size="text-xs"
          weight="semibold">
          {title}
        </Typography>
      </div>

      <div className="tw:flex-1 tw:min-h-0 tw:overflow-y-auto">
        {isLoading ? (
          <Box direction="col" gap={2}>
            <Skeleton height="14px" variant="rounded" width="80%" />
            <Skeleton height="14px" variant="rounded" width="60%" />
            <Skeleton height="14px" variant="rounded" width="70%" />
          </Box>
        ) : isEmpty ? (
          <Typography className="tw:text-quaternary" size="text-sm">
            {emptyMessage}
          </Typography>
        ) : (
          children
        )}
      </div>
    </Card>
  );
};

export default ContextSimplePillarCard;
