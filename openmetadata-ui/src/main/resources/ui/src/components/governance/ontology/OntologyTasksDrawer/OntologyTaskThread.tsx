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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyReleaseReview } from '../../../../generated/api/data/ontologyReleaseReview';
import { Task } from '../../../../generated/entity/tasks/task';
import {
  EventType,
  OntologyReleaseEvent,
} from '../../../../generated/type/ontologyReleaseEvent';
import {
  buildThreadEntries,
  reviewDecisionAppearance,
} from './OntologyTaskThread.utils';

type Props = {
  task: Task;
  review: OntologyReleaseReview;
  events: readonly OntologyReleaseEvent[];
};

const OntologyTaskThread = ({ task, review, events }: Props) => {
  const { t } = useTranslation();
  const entries = useMemo(
    () => buildThreadEntries(task, review, events),
    [task, review, events]
  );

  return (
    <Box direction="col" gap={3}>
      <Typography as="h3" size="text-md" weight="semibold">
        {t('label.conversation')}
      </Typography>
      <ol className="tw:m-0 tw:list-none tw:p-0">
        {entries.map((entry) => {
          let appearance: {
            color: 'gray' | 'blue' | 'success' | 'error' | 'warning';
            label: string;
          } = { color: 'gray', label: 'label.captured' };
          if (entry.source === 'comment') {
            appearance = { color: 'gray', label: 'label.comment' };
          }
          if (entry.event?.eventType === EventType.Activated) {
            appearance = { color: 'blue', label: 'label.published' };
          }
          if (entry.decision) {
            appearance = reviewDecisionAppearance(entry.decision);
          }

          return (
            <li data-testid={entry.id} key={entry.id}>
              <Box direction="col" gap={1}>
                <Box align="center" gap={2} wrap="wrap">
                  <Typography weight="medium">{entry.actor}</Typography>
                  <Badge color={appearance.color}>{t(appearance.label)}</Badge>
                  <time dateTime={new Date(entry.timestamp).toISOString()}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </time>
                </Box>
                {entry.message && (
                  <Typography className="tw:whitespace-pre-wrap">
                    {entry.message}
                  </Typography>
                )}
              </Box>
            </li>
          );
        })}
      </ol>
    </Box>
  );
};

export default OntologyTaskThread;
