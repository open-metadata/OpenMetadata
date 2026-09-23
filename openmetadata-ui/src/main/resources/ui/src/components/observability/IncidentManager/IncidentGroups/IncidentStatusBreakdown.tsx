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
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import {
  INCIDENT_GROUP_SEPARATOR,
  INCIDENT_GROUP_STATUS_COLORS,
  INCIDENT_GROUP_STATUS_LABELS,
} from './IncidentGroups.constants';
import { IncidentStatusBreakdownProps } from './IncidentGroups.types';
import { getIncidentGroupStatusSegments } from './IncidentGroups.utils';

/**
 * Where a group's open incidents currently sit. A single chip could only name
 * the most actionable status, which reads as though the whole group were in it;
 * the bar gives every occupied status a slice of its own, sized by how many
 * incidents are in it, with the counts spelled out underneath.
 *
 * Pure — the slices come from the counts the groups endpoint already returns.
 */
const IncidentStatusBreakdown = ({
  statusCounts,
}: IncidentStatusBreakdownProps) => {
  const { t } = useTranslation();

  const segments = getIncidentGroupStatusSegments(statusCounts);

  if (isEmpty(segments)) {
    return <span data-testid="group-status">{NO_DATA_PLACEHOLDER}</span>;
  }

  return (
    <Box
      className="tw:w-32 tw:gap-1.5"
      data-testid="group-status"
      direction="col">
      <Box aria-hidden className="tw:h-1.5 tw:gap-0.5">
        {segments.map(({ status, share }) => (
          <span
            className="tw:rounded-full"
            data-testid={`group-status-segment-${status}`}
            key={status}
            style={{
              width: `${share}%`,
              backgroundColor: INCIDENT_GROUP_STATUS_COLORS[status],
            }}
          />
        ))}
      </Box>
      <Typography
        as="span"
        className="tw:text-tertiary"
        data-testid="group-status-counts"
        size="text-xs">
        {segments
          .map(
            ({ status, count }) =>
              `${count} ${t(INCIDENT_GROUP_STATUS_LABELS[status] ?? status)}`
          )
          .join(INCIDENT_GROUP_SEPARATOR)}
      </Typography>
    </Box>
  );
};

export default IncidentStatusBreakdown;
