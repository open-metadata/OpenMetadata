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
import { Box } from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import {
  getStatusChange,
  getStatusChangeLines,
  StatusChangeLine,
} from './EntityStatusDecision.utils';

export interface EntityStatusDecisionProps {
  entityType: string;
  entityId: string;
  entityLink: string;
  status: string;
}

// A status rarely changes while someone reads the page; hovering again reuses the answer.
const STATUS_CHANGE_STALE_TIME_MS = 60_000;

// The tooltip's title and description both read the status change; they share one query, so
// opening the tooltip makes one lookup.
const useStatusChange = ({
  entityType,
  entityId,
  entityLink,
  status,
}: EntityStatusDecisionProps) => {
  const { t } = useTranslation();
  const { data: change, isLoading } = useQuery({
    // Keyed on the status too, so a status changed on this page is looked up again.
    queryKey: ['entityStatusChange', entityType, entityId, status],
    queryFn: () => getStatusChange(entityType, entityId, entityLink),
    staleTime: STATUS_CHANGE_STALE_TIME_MS,
  });
  const read = (line: StatusChangeLine) =>
    line.text ?? t(line.key ?? '', line.values);
  const [headline, ...details] = getStatusChangeLines(change).map(read);

  return { isLoading, headline, details, changedAt: change?.changedAt };
};

/** The status tooltip's title: how the entity's current status was set. */
export const EntityStatusDecisionTitle = (props: EntityStatusDecisionProps) => {
  const { t } = useTranslation();
  const { isLoading, headline } = useStatusChange(props);

  return isLoading ? (
    <span>{t('label.loading')}</span>
  ) : (
    <span data-testid="entity-status-decision-outcome">{headline}</span>
  );
};

/** The status tooltip's description: who or what led to it, then when. */
export const EntityStatusDecisionDescription = (
  props: EntityStatusDecisionProps
) => {
  const { isLoading, details, changedAt } = useStatusChange(props);

  return isLoading ? null : (
    <Box data-testid="entity-status-decision" direction="col" gap={1}>
      {details.map((line) => (
        <span data-testid="entity-status-decision-detail" key={line}>
          {line}
        </span>
      ))}
      {changedAt && <span>{getShortRelativeTime(changedAt)}</span>}
    </Box>
  );
};
