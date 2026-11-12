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
  ButtonGroup,
  ButtonGroupItem,
  Divider,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowLeft, Search } from '@openmetadata/ui-core-components/icons';
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
    releases,
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

const statusLabel = (option: HistoryStatusFilter) =>
  `label.${option === 'inReview' ? 'ontology-in-review' : option}`;

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
            {t(statusLabel(option))}
          </Button>
        ))}
      </Box>
    </Box>
  );
};

/** The handoff's toolbar: status segments with counts, a wide search and Compare versions. */
const AiHistoryToolbar = ({
  counts,
  filter,
  search,
  onCompare,
  onFilter,
  onSearch,
}: {
  counts: Record<HistoryStatusFilter, number>;
  filter: HistoryStatusFilter;
  search: string;
  onCompare?: () => void;
  onFilter: (filter: HistoryStatusFilter) => void;
  onSearch: (search: string) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" gap={3} wrap="wrap">
      <ButtonGroup
        disallowEmptySelection
        aria-label={t('label.status')}
        selectedKeys={[filter]}
        size="sm"
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (next) {
            onFilter(next as HistoryStatusFilter);
          }
        }}>
        {HISTORY_STATUS_FILTERS.map((option) => (
          <ButtonGroupItem
            data-testid={`ontology-release-filter-${option}`}
            id={option}
            key={option}>
            {t(statusLabel(option))} · {counts[option]}
          </ButtonGroupItem>
        ))}
      </ButtonGroup>
      <Input
        aria-label={t('label.search-entity', {
          entity: t('label.release-plural'),
        })}
        className="tw:min-w-60 tw:flex-1"
        icon={Search}
        inputDataTestId="ontology-release-search"
        placeholder={t('label.search-entity', {
          entity: t('label.release-plural'),
        })}
        size="sm"
        value={search}
        onChange={onSearch}
      />
      {onCompare ? (
        <Button
          color="secondary"
          data-testid="ontology-release-compare-open"
          size="sm"
          onPress={onCompare}>
          {t('label.compare-versions')}
        </Button>
      ) : null}
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

type HistoryQuery = OntologyReleaseHistoryProps['history'];

const HistoryLoadStatus = ({ history }: { history: HistoryQuery }) => {
  const { t } = useTranslation();
  if (history.isPending) {
    return <Typography role="status">{t('label.loading')}</Typography>;
  }

  return history.isError ? (
    <Alert variant="error">
      {t('message.ontology-review-unavailable')}
      <Button
        color="secondary"
        size="sm"
        onPress={() => void history.refetch()}>
        {t('label.retry')}
      </Button>
    </Alert>
  ) : null;
};

const HistoryMore = ({ history }: { history: HistoryQuery }) => {
  const { t } = useTranslation();
  const pages = history.data?.pages ?? [];
  const isAtLimit = pages.length === 40 && Boolean(pages[39].paging.after);

  return (
    <>
      {history.hasNextPage && (
        <Button
          color="secondary"
          data-testid="ontology-release-load-more"
          isDisabled={history.isFetchingNextPage}
          isLoading={history.isFetchingNextPage}
          size="sm"
          onPress={() => void history.fetchNextPage()}>
          {t('label.load-more-lowercase')}
        </Button>
      )}
      {isAtLimit && (
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-history-limit')}
        </Typography>
      )}
    </>
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
  const [isComparing, setIsComparing] = useState(false);
  const {
    releases,
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

  const renderDelta = (release: OntologyRelease) => {
    const breakdown = releaseChangeBreakdown(release);

    return breakdown ? (
      <Typography
        as="span"
        data-testid={`ontology-release-count-${release.id}`}
        size="text-xs"
        weight="semibold">
        <span className="tw:text-utility-success-700">+{breakdown.added}</span>{' '}
        <span className="tw:text-utility-warning-700">
          ~{breakdown.changed}
        </span>{' '}
        <span className="tw:text-utility-error-700">−{breakdown.removed}</span>
      </Typography>
    ) : (
      <Typography
        as="span"
        color="secondary"
        data-testid={`ontology-release-count-${release.id}`}
        size="text-xs">
        {t('message.ontology-change-summary-unavailable')}
      </Typography>
    );
  };

  const renderAiKinds = (release: OntologyRelease) => {
    const kinds = releaseKindCounts(release);

    return kinds && kinds.total > 0 ? (
      <Typography
        as="span"
        color="secondary"
        data-testid={`ontology-release-kinds-${release.id}`}
        size="text-xs">
        {KIND_MESSAGES.filter(([kind]) => kinds[kind] > 0)
          .map(([kind, message]) => t(message, { count: kinds[kind] }))
          .join(' · ')}
      </Typography>
    ) : null;
  };

  const renderAiRelease = (release: OntologyRelease, index: number) => (
    <li
      className={classNames(
        'tw:flex tw:items-center tw:gap-4 tw:px-4 tw:py-3',
        index > 0 && 'tw:border-t tw:border-secondary',
        release.id === activeReleaseId &&
          'tw:border-l-3 tw:border-l-utility-success-500 tw:bg-utility-success-50'
      )}
      data-testid="ontology-release-row"
      key={release.id}>
      <div className="tw:w-24 tw:shrink-0">{renderVersionButton(release)}</div>
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
        <Box align="center" gap={2} wrap="wrap">
          {renderBadges(release)}
          {renderDelta(release)}
          {renderAiKinds(release)}
        </Box>
        {release.releaseNotes ? (
          <Typography className="tw:truncate" size="text-sm">
            {release.releaseNotes}
          </Typography>
        ) : null}
      </Box>
      <Box className="tw:w-40 tw:shrink-0" direction="col">
        <Typography color="secondary" size="text-xs">
          {release.sealedBy}
        </Typography>
        <Typography color="secondary" size="text-xs">
          {formatDateTimeLong(release.sealedAt)}
        </Typography>
      </Box>
      <div className="tw:w-48 tw:shrink-0">
        <ReleaseDecision release={release} />
      </div>
      <OntologyReleaseExport releaseId={release.id} />
    </li>
  );

  const renderAiReleases = () =>
    rows.length > 0 && (
      <ol className="tw:m-0 tw:list-none tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:p-0">
        {rows.map(renderAiRelease)}
      </ol>
    );

  const renderAiEmpty = () =>
    history.isSuccess &&
    matching.length === 0 && (
      <div
        className="tw:rounded-xl tw:border tw:border-dashed tw:border-secondary tw:px-6 tw:py-10 tw:text-center"
        data-testid="ontology-release-history-empty">
        <Typography color="secondary" size="text-sm">
          {releases.length === 0
            ? t('message.ontology-no-releases-yet')
            : t('message.no-data-available')}
        </Typography>
      </div>
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

  const statusCounts = Object.fromEntries(
    HISTORY_STATUS_FILTERS.map((option) => [
      option,
      filterHistoryReleases(releases, option, '').length,
    ])
  ) as Record<HistoryStatusFilter, number>;

  const renderControls = () =>
    isAiMode ? (
      <AiHistoryToolbar
        counts={statusCounts}
        filter={filter}
        search={search}
        onCompare={ontologyId ? () => setIsComparing(true) : undefined}
        onFilter={setFilter}
        onSearch={setSearch}
      />
    ) : (
      <>
        {ontologyId && <OntologyReleaseCompare ontologyId={ontologyId} />}
        <HistoryControls
          filter={filter}
          search={search}
          onFilter={setFilter}
          onSearch={setSearch}
        />
      </>
    );

  const renderEmpty = () => {
    if (isAiMode) {
      return renderAiEmpty();
    }

    return (
      history.isSuccess &&
      matching.length === 0 && (
        <Typography>{t('message.no-data-available')}</Typography>
      )
    );
  };

  if (isAiMode && isComparing && ontologyId) {
    return (
      <Box data-testid="ontology-release-history" direction="col" gap={4}>
        <Button
          className="tw:self-start"
          color="link-gray"
          data-testid="ontology-release-compare-back"
          iconLeading={ArrowLeft}
          size="sm"
          onPress={() => setIsComparing(false)}>
          {t('label.all-releases')}
        </Button>
        <OntologyReleaseCompare ontologyId={ontologyId} />
      </Box>
    );
  }

  return (
    <Box data-testid="ontology-release-history" direction="col" gap={4}>
      {renderControls()}
      <HistoryLoadStatus history={history} />
      {renderEmpty()}
      {isAiMode ? renderAiReleases() : renderClassicReleases()}
      <HistoryPager page={page} pageCount={pageCount} onPage={setPage} />
      <HistoryMore history={history} />
    </Box>
  );
};

export default OntologyReleaseHistory;
