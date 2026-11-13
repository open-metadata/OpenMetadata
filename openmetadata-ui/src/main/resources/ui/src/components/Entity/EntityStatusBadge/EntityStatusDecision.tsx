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
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import Loader from '../../common/Loader/Loader';
import {
  getStatusChange,
  getStatusChangeLines,
  StatusChangeLine,
} from './EntityStatusDecision.utils';

interface EntityStatusDecisionProps {
  entityType: string;
  entityId: string;
  entityLink: string;
  status: string;
}

// A status rarely changes while someone reads the page; hovering again reuses the answer.
const STATUS_CHANGE_STALE_TIME_MS = 60_000;

/** Who set the entity's current status, looked up when the status badge is hovered. */
const EntityStatusDecision = ({
  entityType,
  entityId,
  entityLink,
  status,
}: EntityStatusDecisionProps) => {
  const { data: change, isLoading } = useQuery({
    // Keyed on the status too, so a status changed on this page is looked up again.
    queryKey: ['entityStatusChange', entityType, entityId, status],
    queryFn: () => getStatusChange(entityType, entityId, entityLink),
    staleTime: STATUS_CHANGE_STALE_TIME_MS,
  });
  const { t } = useTranslation();
  const [headline, ...details] = getStatusChangeLines(change);
  const read = (line: StatusChangeLine) =>
    line.text ?? t(line.key ?? '', line.values);

  return isLoading ? (
    <Loader size="small" />
  ) : (
    <Box
      className="tw:max-w-80"
      data-testid="entity-status-decision"
      direction="col"
      gap={1}>
      <Typography
        as="span"
        data-testid="entity-status-decision-outcome"
        size="text-sm"
        weight="medium">
        {read(headline)}
      </Typography>
      {details.map((line) => (
        <Typography
          as="span"
          color="secondary"
          data-testid="entity-status-decision-detail"
          key={line.key ?? line.text}
          size="text-xs">
          {read(line)}
        </Typography>
      ))}
      {change?.changedAt && (
        <Typography as="span" color="quaternary" size="text-xs">
          {getShortRelativeTime(change.changedAt)}
        </Typography>
      )}
    </Box>
  );
};

export default EntityStatusDecision;
