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
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Severities } from '../../../../generated/tests/testCaseIncidentGroup';
import { INCIDENT_GROUP_SEVERITY_COLOR } from './IncidentGroups.constants';

/**
 * A severity as a read-only label, for a group (the worst of its incidents) and
 * for an incident that cannot be edited where it is listed. Takes either
 * generated `Severities` enum: they come from two schema files but name the
 * same values.
 */
const IncidentSeverityBadge = ({
  severity,
}: {
  severity?: `${Severities}`;
}) => {
  const { t } = useTranslation();

  return (
    <Badge
      color={
        severity
          ? INCIDENT_GROUP_SEVERITY_COLOR[severity as Severities]
          : 'gray'
      }
      size="sm"
      type="pill-color">
      {severity
        ? startCase(severity)
        : t('label.no-entity', { entity: t('label.severity') })}
    </Badge>
  );
};

export default IncidentSeverityBadge;
