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

import { Badge } from '@openmetadata/ui-core-components';
import { getDataTypeBadgeColor } from '../../../../utils/TableUtils';

interface DataTypeBadgeProps {
  /** The `DataType` enum value; drives the colour. */
  dataType?: string;
  /** What to show, e.g. `varchar(50)`; falls back to `dataType`. */
  displayName?: string;
}

/** A column data type as a badge, coloured by type family. */
const DataTypeBadge = ({ dataType, displayName }: DataTypeBadgeProps) => {
  const label = displayName || dataType;
  if (!label) {
    return null;
  }

  return (
    <Badge
      color={getDataTypeBadgeColor(dataType || label)}
      data-testid="data-type-badge"
      size="sm"
      type="color">
      {label}
    </Badge>
  );
};

export default DataTypeBadge;
