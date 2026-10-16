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

import type { BadgeColors } from '@openmetadata/ui-core-components';
import { Badge, Box } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { getIngestionStatusCountData } from '../../../../../../utils/IngestionConfigUtils';
import { IngestionStatusCountProps } from './IngestionStatusCount.interface';

const STATUS_BADGE_COLOR: Record<string, BadgeColors> = {
  success: 'success',
  failed: 'error',
  warning: 'warning',
};

function IngestionStatusCount({
  summary,
  runId,
}: Readonly<IngestionStatusCountProps>) {
  const records = useMemo(
    () => getIngestionStatusCountData(summary),
    [summary]
  );

  return (
    <Box align="center" gap={2} wrap="nowrap">
      {records.map((record) => (
        <Badge
          color={STATUS_BADGE_COLOR[record.type]}
          data-testid={`${record.type}-count`}
          key={`${record.label}-${runId}`}
          size="sm"
          type="pill-color">
          <span className="tw:font-semibold">{record.value}</span>&nbsp;
          {record.label}
        </Badge>
      ))}
    </Box>
  );
}

export default IngestionStatusCount;
