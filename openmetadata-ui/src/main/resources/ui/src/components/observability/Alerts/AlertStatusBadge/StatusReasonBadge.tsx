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

import {
  Badge,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import AlertStatusReasons, {
  AlertStatusReasonSection,
} from './AlertStatusReasons';

interface StatusReasonBadgeProps {
  color: 'error' | 'gray' | 'success';
  label: string;
  sections: AlertStatusReasonSection[];
}

/** A status badge; with reasons, it says them on hover and focus, under the first section's title. */
function StatusReasonBadge({
  color,
  label,
  sections,
}: Readonly<StatusReasonBadgeProps>) {
  const badge = (
    <Badge color={color} data-testid="alert-status" size="sm" type="pill-color">
      {label}
    </Badge>
  );

  if (sections.length === 0) {
    return badge;
  }

  return (
    <Tooltip
      description={<AlertStatusReasons sections={sections} />}
      title={sections[0].title}>
      <TooltipTrigger
        aria-label={[
          label,
          ...sections.map(
            (section) => `${section.title}: ${section.reasons.join(' ')}`
          ),
        ].join('. ')}
        data-testid="alert-status-reason">
        {badge}
      </TooltipTrigger>
    </Tooltip>
  );
}

export default StatusReasonBadge;
