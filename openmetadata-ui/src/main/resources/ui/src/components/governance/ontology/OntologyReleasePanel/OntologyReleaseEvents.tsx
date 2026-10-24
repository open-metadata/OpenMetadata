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
import { getOntologyReleaseEvents } from '../../../../rest/ontologyAPI';

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
      <Typography as="h4" size="text-sm" weight="semibold">
        {t('label.release-events')}
      </Typography>
      {events.isPending && (
        <Typography role="status">{t('label.loading')}</Typography>
      )}
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
      <ul className="tw:m-0 tw:list-none tw:p-0">
        {events.data?.pages
          .flatMap((page) => page.data)
          .map((event) => (
            <li key={event.id}>
              <Typography size="text-sm">
                {t(`label.ontology-event-${event.eventType.toLowerCase()}`)} ·{' '}
                {event.createdBy} · {new Date(event.createdAt).toLocaleString()}
              </Typography>
              {event.voters?.length ? (
                <Typography size="text-xs">
                  {t('label.reviewer-plural')}: {event.voters.join(', ')}
                </Typography>
              ) : null}
              {event.taskId && (
                <Link to={`/tasks/${encodeURIComponent(event.taskId)}`}>
                  {t('label.approval')}
                </Link>
              )}
            </li>
          ))}
      </ul>
      {events.hasNextPage && (
        <Button
          color="secondary"
          isLoading={events.isFetchingNextPage}
          size="sm"
          onPress={() => void events.fetchNextPage()}>
          {t('label.load-more')}
        </Button>
      )}
    </Box>
  );
};

export default OntologyReleaseEvents;
