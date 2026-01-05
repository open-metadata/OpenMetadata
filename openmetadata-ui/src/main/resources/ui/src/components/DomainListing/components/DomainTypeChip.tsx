/*
 *  Copyright 2023 Collate.
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

import { Chip, Typography } from '@mui/material';
import { Cube01, Database01, Users01 } from '@untitledui/icons';

const EMPTY_VALUE_INDICATOR = '-';

interface DomainTypeChipProps {
  domainType: string;
}

export const DomainTypeChip = ({ domainType }: DomainTypeChipProps) => {
  switch (domainType) {
    case 'Consumer-aligned':
      return (
        <Chip
          color="primary"
          icon={<Users01 size={12} />}
          label="Consumer-aligned"
          size="small"
          variant="outlined"
        />
      );
    case 'Source-aligned':
      return (
        <Chip
          color="primary"
          icon={<Cube01 size={12} />}
          label="Source-aligned"
          size="small"
          variant="outlined"
        />
      );
    case 'Aggregate':
      return (
        <Chip
          color="primary"
          icon={<Database01 size={12} />}
          label="Aggregate"
          size="small"
          variant="outlined"
        />
      );
    default:
      return (
        <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
          {EMPTY_VALUE_INDICATOR}
        </Typography>
      );
  }
};
