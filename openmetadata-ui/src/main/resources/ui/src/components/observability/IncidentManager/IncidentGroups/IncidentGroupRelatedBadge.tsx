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
import { useTranslation } from 'react-i18next';
import { IncidentGroupBy } from '../../../../generated/tests/testCaseIncidentGroup';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { IncidentGroupCellProps } from './IncidentGroups.types';

/**
 * What the group's incidents span, counted: the tables of a test definition
 * group, the test definitions (check types) of any other. A group with a single
 * test definition names it instead, as the design does.
 */
const IncidentGroupRelatedBadge = ({ group }: IncidentGroupCellProps) => {
  const { t } = useTranslation();
  const isTableCount = group.groupBy === IncidentGroupBy.TestDefinition;
  const count = isTableCount ? group.tableCount : group.testDefinitionCount;
  const onlyTestDefinition =
    !isTableCount && count === 1 ? group.testDefinitions?.[0] : undefined;

  if (count === undefined) {
    return null;
  }

  const countLabel = t(
    isTableCount ? 'label.table-count' : 'label.type-count',
    {
      count,
    }
  );

  return (
    <span data-testid="group-related">
      <Badge color="gray" size="sm" type="modern">
        {onlyTestDefinition ? getEntityName(onlyTestDefinition) : countLabel}
      </Badge>
    </span>
  );
};

export default IncidentGroupRelatedBadge;
