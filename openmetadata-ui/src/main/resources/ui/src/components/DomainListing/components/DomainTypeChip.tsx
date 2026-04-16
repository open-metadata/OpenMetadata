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

import { BadgeWithIcon, Typography } from '@openmetadata/ui-core-components';
import { Cube01, Database01, Users01 } from '@untitledui/icons';

const EMPTY_VALUE_INDICATOR = '-';

interface DomainTypeChipProps {
  domainType: string;
}

export const DomainTypeChip = ({ domainType }: DomainTypeChipProps) => {
  switch (domainType) {
    case 'Consumer-aligned':
      return (
        <BadgeWithIcon
          color="brand"
          iconLeading={Users01}
          size="sm"
          type="color">
          Consumer-aligned
        </BadgeWithIcon>
      );
    case 'Source-aligned':
      return (
        <BadgeWithIcon
          color="brand"
          iconLeading={Cube01}
          size="sm"
          type="color">
          Source-aligned
        </BadgeWithIcon>
      );
    case 'Aggregate':
      return (
        <BadgeWithIcon
          color="brand"
          iconLeading={Database01}
          size="sm"
          type="color">
          Aggregate
        </BadgeWithIcon>
      );
    default:
      return (
        <Typography className="tw:text-gray-700" size="text-xs">
          {EMPTY_VALUE_INDICATOR}
        </Typography>
      );
  }
};
