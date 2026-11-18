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

import { Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useMemo } from 'react';
import { getIngestionStatusCountData } from '../../../../../../utils/IngestionConfigUtils';
import { STATUS_TILE_CLASS } from './IngestionStatusCount.constants';
import { IngestionStatusCountProps } from './IngestionStatusCount.interface';

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
        <div
          className={classNames(
            'tw:flex tw:h-12 tw:min-w-15.5 tw:flex-col tw:items-center tw:justify-center tw:rounded-xl tw:px-3 tw:py-1.5',
            STATUS_TILE_CLASS[record.type]
          )}
          data-testid={`${record.type}-count`}
          key={`${record.label}-${runId}`}>
          <span className="tw:text-sm tw:font-bold">{record.value}</span>
          <span className="tw:text-xs tw:font-medium tw:leading-4">
            {record.label}
          </span>
        </div>
      ))}
    </Box>
  );
}

export default IngestionStatusCount;
