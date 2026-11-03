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
  Badge,
  Box,
  Button,
  Divider,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApprovalBasis,
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { EventType } from '../../../../generated/type/ontologyReleaseEvent';
import { useOntologyPublication } from '../../../../hooks/governance/ontology/useOntologyPublication';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getOntologyReleaseEvents } from '../../../../rest/ontologyAPI';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import { KIND_MESSAGES } from './OntologyReleaseChanges.utils';
import OntologyReleaseCompare from './OntologyReleaseCompare';
import OntologyReleaseExport from './OntologyReleaseExport';
import {
  filterHistoryReleases,
  HistoryStatusFilter,
  HISTORY_STATUS_FILTERS,
  releaseChangeBreakdown,
  releaseKindCounts,
  visibleHistoryReleases,
} from './OntologyReleasePanel.utils';

export const HISTORY_PAGE_SIZE = 10;

interface OntologyReleaseHistoryProps {
  history: ReturnType<typeof useOntologyPublication>['history'];
  ontologyId?: string;
  activeReleaseId?: string;
  latestReleaseId?: string;
  selectedReleaseId?: string;
  onSelect: (id: string) => void;
}

const ReleaseDecision = ({ release }: { release: OntologyRelease }) => {
  const { t } = useTranslation();
  const isDirect =
    release.approvalBasis === ApprovalBasis.NoReviewersConfigured;
  const decided = [EntityStatus.Approved, EntityStatus.Rejected].includes(
    release.entityStatus
  );
  const decision = useQuery({
    queryKey: ['ontology-release-decision', release.id],
    enabled: decided && !isDirect,
    retry: false,
    queryFn: async ({ signal }) => {
      const events = await getOntologyReleaseEvents(
        release.id,
        { limit: 50 },
        signal
      );
      const type =
        release.entityStatus === EntityStatus.Approved
          ? EventType.Approved
          : EventType.Rejected;

      return (
        events.data.filter((event) => event.eventType === type).pop() ?? null
      );
    },
  });

  if (isDirect) {
    return (
      <Typography
        data-testid={`ontology-release-decision-${release.id}`}
        size="text-xs">
        {t('label.published-without-review')}
      </Typography>
    );
  }
  const event = decision.data;
  if (!event) {
    return null;
  }
  const people = event.voters?.length
    ? event.voters.join(', ')
    : event.createdBy;

  return (
    <Typography
      data-testid={`ontology-release-decision-${release.id}`}
      size="text-xs">
      {t(
        release.entityStatus === EntityStatus.Approved
          ? 'message.ontology-release-approved-by'
          : 'message.ontology-release-rejected-by',
        { reviewers: people }
      )}
    </Typography>
  );
};

const useHistoryView = (
  pages: { data: OntologyRelease[] }[] | undefined,
  latestReleaseId: string | undefined
) => {
  const releases = visibleHistoryReleases(
    (pages ?? []).flatMap((entry) => entry.data),
    latestReleaseId
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HistoryStatusFilter>('all');
  const [requestedPage, setPage] = useState(0);
  const matching = filterHistoryReleases(releases, filter, search);
  const pageCount = Math.max(1, Math.ceil(matching.length / HISTORY_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [search, filter]);

  return {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    pageCount,
    matching,
    rows: matching.slice(
      page * HISTORY_PAGE_SIZE,
      (page + 1) * HISTORY_PAGE_SIZE
    ),
  };
};

const HistoryControls = ({
  filter,
  search,
  onFilter,
  onSearch,
}: {
  filter: HistoryStatusFilter;
  search: string;
  onFilter: (filter: HistoryStatusFilter) => void;
  onSearch: (search: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={2}>
      <Input
        aria-label={t('label.search-entity', {
          entity: t('label.release-plural'),
        })}
        icon={Search}
        inputDataTestId="ontology-release-search"
        placeholder={t('label.search-entity', {
          entity: t('label.release-plural'),
        })}
        size="sm"
        value={search}
        onChange={onSearch}
      />
      <Box aria-label={t('label.status')} gap={1} role="group" wrap="wrap">
        {HISTORY_STATUS_FILTERS.map((option) => (
          <Button
            aria-pressed={filter === option}
            color={filter === option ? 'primary' : 'secondary'}
            data-testid={`ontology-release-filter-${option}`}
            key={option}
            size="xs"
            onPress={() => onFilter(option)}>
            {t(`label.${option === 'inReview' ? 'in-review' : option}`)}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

const HistoryPager = ({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) => {
  const { t } = useTranslation();
  if (pageCount < 2) {
    return null;
  }

  return (
    <Box align="center" gap={2}>
      <Button
        color="secondary"
        data-testid="ontology-release-previous"
        isDisabled={page === 0}
        size="sm"
        onPress={() => onPage(page - 1)}>
        {t('label.previous')}
      </Button>
      <Typography
        color="secondary"
        data-testid="ontology-release-page"
        size="text-sm">
        {t('label.page')} {page + 1} / {pageCount}
      </Typography>
      <Button
        color="secondary"
        data-testid="ontology-release-next"
        isDisabled={page >= pageCount - 1}
        size="sm"
        onPress={() => onPage(page + 1)}>
        {t('label.next')}
      </Button>
    </Box>
  );
};

const OntologyReleaseHistory = ({
  history,
  ontologyId,
  activeReleaseId,
  latestReleaseId,
  selectedReleaseId,
  onSelect,
}: OntologyReleaseHistoryProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    pageCount,
    rows,
    matching,
  } = useHistoryView(history.data?.pages, latestReleaseId);
  const renderVersionButton = (release: OntologyRelease) => (
    <Button
      aria-expanded={selectedReleaseId === release.id}
      color={selectedReleaseId === release.id ? 'link-color' : 'link-gray'}
      data-testid={`ontology-release-select-${release.id}`}
      size="sm"
      onPress={() => onSelect(release.id)}>
      {release.semanticVersion ??
        t('label.ontology-release-revision', {
          revision: release.releaseRevision,
        })}
    </Button>
  );

  const renderBadges = (release: OntologyRelease) => (
    <>
      {release.id === activeReleaseId && (
        <Badge color="success">{t('label.active')}</Badge>
      )}
      {release.id === latestReleaseId && (
        <Badge color="blue">{t('label.latest')}</Badge>
      )}
      <Badge>
        {t(`label.${release.entityStatus.toLowerCase().replaceAll(' ', '-')}`)}
      </Badge>
    </>
  );

  const renderCounts = (release: OntologyRelease) => {
    const breakdown = releaseChangeBreakdown(release);
    const kinds = releaseKindCounts(release);

    return (
      <>
        <Typography
          color="secondary"
          data-testid={`ontology-release-count-${release.id}`}
          size="text-xs">
          {breakdown
            ? [
                `${breakdown.added} ${t('label.added-lowercase')}`,
                `${breakdown.changed} ${t('label.changed-lowercase')}`,
                `${breakdown.removed} ${t('label.removed-lowercase')}`,
              ].join(' · ')
            : t('message.ontology-change-summary-unavailable')}
        </Typography>
        {kinds && kinds.total > 0 && (
          <Typography
            color="secondary"
            data-testid={`ontology-release-kinds-${release.id}`}
            size="text-xs">
            {KIND_MESSAGES.filter(([kind]) => kinds[kind] > 0)
              .map(([kind, message]) => t(message, { count: kinds[kind] }))
              .join(' · ')}
          </Typography>
        )}
      </>
    );
  };

  const renderNotes = (release: OntologyRelease) =>
    release.releaseNotes && (
      <Typography
        className="tw:whitespace-pre-wrap tw:break-words"
        size="text-sm">
        {release.releaseNotes}
      </Typography>
    );

  const renderAiReleases = () =>
    rows.length > 0 && (
      <ol className="tw:m-0 tw:list-none tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:p-0">
        {rows.map((release, index) => (
          <li
            className={classNames(
              'tw:flex tw:items-start tw:gap-4 tw:px-4 tw:py-3',
              index > 0 && 'tw:border-t tw:border-secondary'
            )}
            data-testid="ontology-release-row"
            key={release.id}>
            <div className="tw:w-28 tw:shrink-0">
              {renderVersionButton(release)}
            </div>
            <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
              <Box align="center" gap={2} wrap="wrap">
                {renderBadges(release)}
              </Box>
              {renderCounts(release)}
              <ReleaseDecision release={release} />
              {renderNotes(release)}
            </Box>
            <Box className="tw:shrink-0" direction="col">
              <Typography color="secondary" size="text-xs">
                {release.sealedBy}
              </Typography>
              <Typography color="secondary" size="text-xs">
                {formatDateTimeLong(release.sealedAt)}
              </Typography>
            </Box>
            <OntologyReleaseExport releaseId={release.id} />
          </li>
        ))}
      </ol>
    );

  const renderClassicReleases = () => (
    <ol className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-3 tw:p-0">
      {rows.map((release) => (
        <li data-testid="ontology-release-row" key={release.id}>
          <Box align="start" gap={3} justify="between">
            <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
              <Box align="center" gap={2} wrap="wrap">
                {renderVersionButton(release)}
                {renderBadges(release)}
                <Typography color="secondary" size="text-xs">
                  {formatDateTimeLong(release.sealedAt)} · {release.sealedBy}
                </Typography>
              </Box>
              {renderCounts(release)}
              <ReleaseDecision release={release} />
              {renderNotes(release)}
            </Box>
            <OntologyReleaseExport releaseId={release.id} />
          </Box>
          <Divider className="tw:mt-3" />
        </li>
      ))}
    </ol>
  );

  return (
    <Box data-testid="ontology-release-history" direction="col" gap={4}>
      {ontologyId && <OntologyReleaseCompare ontologyId={ontologyId} />}
      <HistoryControls
        filter={filter}
        search={search}
        onFilter={setFilter}
        onSearch={setSearch}
      />
      {history.isPending && (
        <Typography role="status">{t('label.loading')}</Typography>
      )}
      {history.isError && (
        <Alert variant="error">
          {t('message.ontology-review-unavailable')}
          <Button
            color="secondary"
            size="sm"
            onPress={() => void history.refetch()}>
            {t('label.retry')}
          </Button>
        </Alert>
      )}
      {history.isSuccess && matching.length === 0 && (
        <Typography>{t('message.no-data-available')}</Typography>
      )}
      {isAiMode ? renderAiReleases() : renderClassicReleases()}
      <HistoryPager page={page} pageCount={pageCount} onPage={setPage} />
      {history.hasNextPage && (
        <Button
          color="secondary"
          data-testid="ontology-release-load-more"
          isDisabled={history.isFetchingNextPage}
          isLoading={history.isFetchingNextPage}
          size="sm"
          onPress={() => void history.fetchNextPage()}>
          {t('label.load-more')}
        </Button>
      )}
      {history.data?.pages.length === 40 &&
        history.data.pages[39].paging.after && (
          <Typography color="secondary" size="text-sm">
            {t('message.ontology-history-limit')}
          </Typography>
        )}
    </Box>
  );
};

export default OntologyReleaseHistory;
