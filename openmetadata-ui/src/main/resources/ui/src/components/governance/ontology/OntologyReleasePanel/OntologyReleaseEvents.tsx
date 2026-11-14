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
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ApprovalBasis } from '../../../../generated/type/ontologyReleaseEvent';
import { getOntologyReleaseEvents } from '../../../../rest/ontologyAPI';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import Loader from '../../../common/Loader/Loader';

const OntologyReleaseEvents = ({ releaseId }: { releaseId: string }) => {
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

  return (
    <Box direction="col" gap={2}>
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
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
        {events.data?.pages
          .flatMap((page) => page.data)
          .map((event) => (
            <li data-testid="ontology-release-event" key={event.id}>
              <Box direction="col" gap={1}>
                <Typography size="text-sm" weight="semibold">
                  {t(`label.ontology-event-${event.eventType.toLowerCase()}`)}
                </Typography>
                <Typography color="secondary" size="text-xs">
                  {event.createdBy}
                </Typography>
                <Typography color="secondary" size="text-xs">
                  {formatDateTimeLong(event.createdAt)}
                </Typography>
                {event.approvalBasis ===
                  ApprovalBasis.NoReviewersConfigured && (
                  <Typography size="text-xs">
                    {t('label.published-without-review')}
                  </Typography>
                )}
                {event.voters?.length ? (
                  <Typography size="text-xs">
                    {t('label.reviewer-plural')}: {event.voters.join(', ')}
                  </Typography>
                ) : null}
                {event.resolution?.comment && (
                  <Typography
                    className="tw:whitespace-pre-wrap tw:break-words"
                    data-testid="ontology-release-event-reason"
                    size="text-xs">
                    {t('label.reason')}: {event.resolution.comment}
                  </Typography>
                )}
                {event.taskId && (
                  <Link to={`/tasks/${encodeURIComponent(event.taskId)}`}>
                    {t('label.approval')}
                  </Link>
                )}
              </Box>
            </li>
          ))}
      </ul>
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
