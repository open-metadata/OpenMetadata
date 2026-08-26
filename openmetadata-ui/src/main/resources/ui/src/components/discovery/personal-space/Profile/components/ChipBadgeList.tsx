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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { EntityReference } from '../../../../../generated/entity/teams/user';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import React from 'react';

type ChipColor = 'blue' | 'purple' | 'gray';

interface ChipBadgeListProps {
  values: EntityReference[];
  color: ChipColor;
  noDataPlaceholder: string;
}

/** Right-aligned coloured pill chips for a Membership row, or a placeholder. */
const ChipBadgeList: React.FC<ChipBadgeListProps> = ({
  values,
  color,
  noDataPlaceholder,
}) =>
  values.length === 0 ? (
    <Typography className="tw:text-secondary" size="text-sm">
      {noDataPlaceholder}
    </Typography>
  ) : (
    <Box align="center" className="tw:flex-wrap tw:justify-end tw:gap-2">
      {values.map((value) => (
        <Badge color={color} key={value.id} size="sm" type="pill-color">
          {getEntityName(value)}
        </Badge>
      ))}
    </Box>
  );

export default ChipBadgeList;
