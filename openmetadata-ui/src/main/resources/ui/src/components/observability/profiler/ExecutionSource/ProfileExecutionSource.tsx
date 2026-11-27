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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { maxBy } from 'lodash';
import { TableProfile } from '../../../../generated/entity/data/table';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import { ExecutionSource } from './ExecutionSource';

export interface ProfileExecutionSourceProps {
  profiles?: Pick<TableProfile, 'timestamp' | 'executionSource'>[];
  timestamp?: number;
  isSharded?: boolean;
}

export const ProfileExecutionSource = ({
  profiles,
  timestamp,
  isSharded,
}: ProfileExecutionSourceProps) => {
  const profile =
    timestamp === undefined
      ? maxBy(profiles, 'timestamp')
      : profiles?.find((entry) => entry.timestamp === timestamp);

  if (!profile || (!profile.executionSource && !isSharded)) {
    return null;
  }

  return (
    <Box
      data-testid={
        timestamp === undefined
          ? 'latest-profile-execution-source'
          : 'historical-profile-execution-source'
      }
      direction="col"
      gap={1}>
      <ExecutionSource
        copyable={timestamp === undefined}
        isSharded={isSharded}
        source={profile.executionSource}
      />
      {timestamp === undefined && (
        <Typography color="secondary" size="text-xs">
          {formatDateTimeLong(profile.timestamp)}
        </Typography>
      )}
    </Box>
  );
};
