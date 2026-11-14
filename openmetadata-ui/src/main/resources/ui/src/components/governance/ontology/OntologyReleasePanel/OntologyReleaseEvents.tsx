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
  Alert,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { useInfiniteQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import {
  ApprovalBasis,
  EventType,
  OntologyReleaseEvent,
} from '../../../../generated/type/ontologyReleaseEvent';
import { getOntologyReleaseEvents } from '../../../../rest/ontologyAPI';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import Loader from '../../../common/Loader/Loader';

/** The marker colour of each event on the timeline. */
const EVENT_TONES: Record<EventType, string> = {
  [EventType.Captured]: 'tw:border-utility-gray-400 tw:text-utility-gray-500',
  [EventType.ReviewRequested]:
    'tw:border-utility-blue-500 tw:text-utility-blue-500',
  [EventType.ReviewWithdrawn]:
    'tw:border-utility-gray-400 tw:text-utility-gray-500',
  [EventType.Approved]:
    'tw:border-utility-success-500 tw:text-utility-success-500',
  [EventType.Rejected]: 'tw:border-utility-error-500 tw:text-utility-error-500',
  [EventType.Activated]:
    'tw:border-utility-success-500 tw:text-utility-success-500',
};

interface OntologyReleaseEventsProps {
  releaseId: string;
  /** Loaded releases, so an activation can name the release it replaced. */
  releases?: readonly OntologyRelease[];
  onOpenTask?: (taskId: string) => void;
}

const OntologyReleaseEvents = ({
  releaseId,
  releases = [],
  onOpenTask,
}: OntologyReleaseEventsProps) => {
  const { t } = useTranslation();
  const events = useInfiniteQuery({
    queryKey: ['ontology-release-events', releaseId],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const response = await getOntologyReleaseEvents(
        releaseId,
        { limit: 25, after: pageParam },
        signal
      );
      if (response.data.some((event) => event.releaseId !== releaseId)) {
        throw new Error('Ontology release event does not match the selection');
      }

      return response;
    },
    getNextPageParam: (last, pages) =>
      pages.length < 40 ? last.paging.after : undefined,
    retry: false,
    gcTime: 0,
  });
  const list = events.data?.pages.flatMap((page) => page.data) ?? [];
  const replacedVersion = (event: OntologyReleaseEvent) => {
    const previous = releases.find(({ id }) => id === event.previousReleaseId);

    return previous?.semanticVersion ? 'v' + previous.semanticVersion : '';
  };

  const renderTask = (taskId: string) =>
    onOpenTask ? (
      <Button
        className="tw:self-start"
        color="link-color"
        size="sm"
        onPress={() => onOpenTask(taskId)}>
        {t('label.open-task')}
      </Button>
    ) : (
      <Link to={`/tasks/${encodeURIComponent(taskId)}`}>
        {t('label.open-task')}
      </Link>
    );

  const renderEvent = (event: OntologyReleaseEvent, index: number) => (
    <li
      className="tw:relative tw:flex tw:gap-3 tw:pb-4 tw:last:pb-0"
      data-testid="ontology-release-event"
      key={event.id}>
      {index < list.length - 1 && (
        <span
          aria-hidden
          className="tw:absolute tw:top-5 tw:bottom-0 tw:left-2 tw:w-px tw:bg-border-tertiary"
        />
      )}
      <span
        aria-hidden
        className={classNames(
          'tw:relative tw:mt-0.5 tw:flex tw:size-4 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border-2 tw:bg-surface',
          EVENT_TONES[event.eventType]
        )}>
        <span className="tw:size-1.5 tw:rounded-full tw:bg-current" />
      </span>
      <Box className="tw:min-w-0" direction="col">
        <Typography size="text-sm" weight="semibold">
          {t(`label.ontology-event-${event.eventType.toLowerCase()}`)}
        </Typography>
        <Typography className="tw:font-mono" color="secondary" size="text-xs">
          {event.createdBy}
        </Typography>
        <Typography color="secondary" size="text-xs">
          {formatDateTimeLong(event.createdAt)}
        </Typography>
        {event.approvalBasis === ApprovalBasis.NoReviewersConfigured && (
          <Typography color="secondary" size="text-xs">
            {t('label.published-without-review')}
          </Typography>
        )}
        {event.voters?.length ? (
          <Typography color="secondary" size="text-xs">
            {t('label.reviewer-plural')}: {event.voters.join(', ')}
          </Typography>
        ) : null}
        {event.eventType === EventType.Activated && replacedVersion(event) ? (
          <Typography color="secondary" size="text-xs">
            {t('message.ontology-release-replaced-active', {
              version: replacedVersion(event),
            })}
          </Typography>
        ) : null}
        {event.resolution?.comment && (
          <Typography
            className="tw:whitespace-pre-wrap tw:break-words"
            color="secondary"
            data-testid="ontology-release-event-reason"
            size="text-xs">
            {t('label.reason')}: {event.resolution.comment}
          </Typography>
        )}
        {event.taskId && renderTask(event.taskId)}
      </Box>
    </li>
  );

  return (
    <Box direction="col" gap={3}>
      <Typography
        as="h4"
        className="not-prose tw:m-0"
        size="text-sm"
        weight="semibold">
        {t('label.release-events')}
      </Typography>
      {events.isPending && <Loader size="small" />}
      {events.isError && (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
          <Button
            color="secondary"
            size="sm"
            onPress={() => void events.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      )}
      <ol className="tw:m-0 tw:list-none tw:p-0">{list.map(renderEvent)}</ol>
      {events.hasNextPage && (
        <Button
          color="secondary"
          isLoading={events.isFetchingNextPage}
          size="sm"
          onPress={() => void events.fetchNextPage()}>
          {t('label.load-more-lowercase')}
        </Button>
      )}
    </Box>
  );
};

export default OntologyReleaseEvents;
