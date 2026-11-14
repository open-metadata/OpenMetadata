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
  Avatar,
  Badge,
  Box,
  Button,
  ButtonUtility,
  Divider,
  Dropdown,
  Input,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowLeft,
  DotsHorizontal,
  Search,
} from '@openmetadata/ui-core-components/icons';
import { useQueries, useQuery } from '@tanstack/react-query';
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
import { useOntologyReleaseDownload } from '../../../../hooks/governance/ontology/useOntologyReleaseDownload';
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTimeLong,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Loader from '../../../common/Loader/Loader';
import { KIND_MESSAGES } from './OntologyReleaseChanges.utils';
import OntologyReleaseBadges from './OntologyReleaseBadges';
import OntologyReleaseCompare from './OntologyReleaseCompare';
import OntologyReleaseExport from './OntologyReleaseExport';
import {
  filterHistoryReleases,
  HistoryStatusFilter,
  HISTORY_STATUS_FILTERS,
  initialsOf,
  releaseBump,
  releaseChangeBreakdown,
  releaseDisplayStatus,
  releaseKindCounts,
  visibleHistoryReleases,
} from './OntologyReleasePanel.utils';

export const HISTORY_PAGE_SIZE = 10;

interface OntologyReleaseHistoryProps {
  history: ReturnType<typeof useOntologyPublication>['history'];
  ontologyId?: string;
  activeReleaseId?: string;
  /** The release in force, so older approved releases read as superseded. */
  activeRelease?: OntologyRelease;
  latestReleaseId?: string;
  selectedReleaseId?: string;
  onSelect: (id: string) => void;
  onOpenTask?: (taskId: string) => void;
  /** Set when the current user may withdraw this in-review release. */
  withdrawableReleaseId?: string;
  onWithdraw?: () => void;
}

/** Each release's semantic version by id, to name the baseline a row moved from. */
export const versionsById = (releases: readonly OntologyRelease[]) =>
  new Map(releases.map((release) => [release.id, release.semanticVersion]));

interface ReleaseRowMenuProps {
  release: OntologyRelease;
  canWithdraw: boolean;
  onOpen: () => void;
  onCompare: () => void;
  onOpenTask?: (taskId: string) => void;
  onWithdraw?: () => void;
}

/** The row's actions, chosen by where the release is in its lifecycle. */
export const ReleaseRowMenu = ({
  release,
  canWithdraw,
  onOpen,
  onCompare,
  onOpenTask,
  onWithdraw,
}: ReleaseRowMenuProps) => {
  const { t } = useTranslation();
  const { exportRelease } = useOntologyReleaseDownload(release.id);
  const isInReview = release.entityStatus === EntityStatus.InReview;
  const isApproved = release.entityStatus === EntityStatus.Approved;
  const items: { id: string; label: string; onAction: () => void }[] = [];
  if (isInReview) {
    if (release.reviewTask && onOpenTask) {
      const task = release.reviewTask;
      items.push({
        id: 'request',
        label: t('label.view-request'),
        onAction: () => onOpenTask(task),
      });
    }
    if (canWithdraw && onWithdraw) {
      items.push({
        id: 'withdraw',
        label: t('label.withdraw'),
        onAction: onWithdraw,
      });
    }
  } else {
    items.push({
      id: 'open',
      label: t(
        release.entityStatus === EntityStatus.Rejected
          ? 'label.view-feedback'
          : 'label.view-changes'
      ),
      onAction: onOpen,
    });
  }
  if (isApproved) {
    items.push(
      {
        id: 'compare',
        label: t('label.compare-with'),
        onAction: onCompare,
      },
      ...(
        [
          ['turtle', 'label.turtle-ttl'],
          ['rdfxml', 'label.rdf-xml-rdf'],
          ['jsonld', 'label.json-ld'],
        ] as const
      ).map(([format, type]) => ({
        id: format,
        label: t('label.export-as-type', { type: t(type) }),
        onAction: () => void exportRelease(format),
      }))
    );
  }

  return (
    <Dropdown.Root>
      <ButtonUtility
        aria-label={t('label.more-actions')}
        color="secondary"
        data-testid={`ontology-release-menu-${release.id}`}
        icon={DotsHorizontal}
        size="sm"
      />
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label={t('label.more-actions')}
          items={items}
          selectionMode="none"
          onAction={(key) => items.find((item) => item.id === key)?.onAction()}>
          {(item) => (
            <Dropdown.Item
              data-testid={`ontology-release-action-${item.id}`}
              id={item.id}
              label={item.label}
              textValue={item.label}
            />
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

const useReleaseDecision = (release: OntologyRelease) => {
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

  return { isDirect, event: decision.data ?? undefined };
};

const ReleaseDecision = ({ release }: { release: OntologyRelease }) => {
  const { t } = useTranslation();
  const { isDirect, event } = useReleaseDecision(release);

  if (isDirect) {
    return (
      <Typography
        data-testid={`ontology-release-decision-${release.id}`}
        size="text-xs">
        {t('label.published-without-review')}
      </Typography>
    );
  }
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

/** Whether a draft's last review was withdrawn; a withdrawal clears its review task. */
const withdrawnQuery = (release: OntologyRelease) => ({
  queryKey: ['ontology-release-withdrawn', release.id],
  enabled: release.entityStatus === EntityStatus.Draft,
  retry: false,
  queryFn: async ({ signal }: { signal: AbortSignal }) => {
    const events = await getOntologyReleaseEvents(
      release.id,
      { limit: 50 },
      signal
    );
    const lastReview = events.data
      .filter(({ eventType }) =>
        [EventType.ReviewRequested, EventType.ReviewWithdrawn].includes(
          eventType
        )
      )
      .pop();

    return lastReview?.eventType === EventType.ReviewWithdrawn;
  },
});

export const useIsReleaseWithdrawn = (release: OntologyRelease) =>
  useQuery(withdrawnQuery(release)).data ?? false;

/** The ids of the shown drafts whose review was withdrawn. */
const useWithdrawnIds = (releases: readonly OntologyRelease[]) => {
  const results = useQueries({ queries: releases.map(withdrawnQuery) });

  return new Set(
    releases
      .filter((_, index) => results[index]?.data)
      .map((release) => release.id)
  );
};

export const DECISION_COLORS = {
  pending: 'tw:text-brand-secondary',
  approved: 'tw:text-success-primary',
  rejected: 'tw:text-error-primary',
} as const;

/** Who decides or decided the release, and how it went; the name is unset when nobody does. */
export const useReleaseApproval = (release: OntologyRelease) => {
  const { isDirect, event } = useReleaseDecision(release);
  if (release.entityStatus === EntityStatus.InReview) {
    const pending = (release.reviewers ?? []).map((reviewer) =>
      getEntityName(reviewer)
    );

    return {
      isDirect,
      event,
      name: pending.length ? pending.join(', ') : undefined,
      decision: 'pending' as const,
    };
  }
  const name = event?.voters?.length
    ? event.voters.join(', ')
    : event?.createdBy;
  const decision =
    release.entityStatus === EntityStatus.Rejected
      ? ('rejected' as const)
      : ('approved' as const);

  return { isDirect, event, name, decision: name ? decision : undefined };
};

/** The row's approver column. */
export const ReleaseApprover = ({ release }: { release: OntologyRelease }) => {
  const { t } = useTranslation();
  const { isDirect, name, decision } = useReleaseApproval(release);

  if (isDirect) {
    return (
      <Typography
        color="secondary"
        data-testid={`ontology-release-decision-${release.id}`}
        size="text-sm">
        {t('label.published-without-review')}
      </Typography>
    );
  }

  return (
    <Box
      align="center"
      data-testid={`ontology-release-decision-${release.id}`}
      gap={2}>
      {name ? <Avatar initials={initialsOf(name)} size="sm" /> : null}
      <Box className="tw:min-w-0" direction="col">
        <Typography className="tw:truncate" size="text-sm">
          {name ?? t('label.no-approver')}
        </Typography>
        {decision ? (
          <Typography
            as="span"
            className={DECISION_COLORS[decision]}
            size="text-sm">
            {t(`label.${decision}`)}
          </Typography>
        ) : (
          <Typography aria-hidden as="span" color="quaternary" size="text-sm">
            —
          </Typography>
        )}
      </Box>
    </Box>
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

const STATUS_FILTER_LABELS: Record<HistoryStatusFilter, string> = {
  all: 'label.all',
  published: 'label.published',
  inReview: 'label.ontology-in-review',
  draft: 'label.drafts',
  rejected: 'label.rejected',
};

const statusLabel = (option: HistoryStatusFilter) =>
  STATUS_FILTER_LABELS[option];

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
      {/* The same segmented control as the Changes filter and the dialog's tabs. */}
      <Tabs
        className="tw:w-fit"
        selectedKey={filter}
        onSelectionChange={(key) => onFilter(key as HistoryStatusFilter)}>
        <Tabs.List
          aria-label={t('label.status')}
          size="sm"
          type="button-border">
          {HISTORY_STATUS_FILTERS.map((option) => (
            <Tabs.Item
              data-testid={`ontology-release-filter-${option}`}
              id={option}
              key={option}>
              {t(statusLabel(option))}
              <span className="tw:ms-1.5 tw:font-normal tw:text-quaternary">
                {counts[option]}
              </span>
            </Tabs.Item>
          ))}
        </Tabs.List>
      </Tabs>
      <Input
        aria-label={t('label.search-versions-or-notes')}
        className="tw:min-w-60 tw:flex-1"
        icon={Search}
        inputDataTestId="ontology-release-search"
        placeholder={t('label.search-versions-or-notes')}
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
    return <Loader size="small" />;
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
  activeRelease,
  latestReleaseId,
  selectedReleaseId,
  onSelect,
  onOpenTask,
  withdrawableReleaseId,
  onWithdraw,
}: OntologyReleaseHistoryProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [comparing, setComparing] = useState<{ to?: OntologyRelease }>();
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

  const versions = versionsById(releases);
  const withdrawnIds = useWithdrawnIds(rows);

  const renderAiRelease = (release: OntologyRelease, index: number) => {
    const status = releaseDisplayStatus(
      release,
      activeRelease,
      withdrawnIds.has(release.id)
    );
    const isMuted = status === 'withdrawn';
    const version = release.semanticVersion
      ? 'v' + release.semanticVersion
      : t('label.ontology-release-revision', {
          revision: release.releaseRevision,
        });

    return (
      <li
        className={classNames(
          index > 0 && 'tw:border-t tw:border-secondary',
          status === 'active' &&
            'tw:border-l-3 tw:border-l-utility-success-500 tw:bg-utility-success-50'
        )}
        data-testid="ontology-release-row"
        key={release.id}>
        {/* The whole row opens the release, as the task list's rows do. */}
        <Box
          align="center"
          aria-label={version}
          className="tw:cursor-pointer tw:px-5 tw:py-4 tw:transition-colors tw:hover:bg-primary_hover"
          data-testid={`ontology-release-select-${release.id}`}
          gap={4}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(release.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(release.id);
            }
          }}>
          <Typography
            as="span"
            className={classNames(
              'tw:w-28 tw:shrink-0',
              isMuted ? 'tw:text-quaternary' : 'tw:text-primary'
            )}
            size="text-md"
            weight="medium">
            {version}
          </Typography>
          <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
            <Box align="center" gap={2} wrap="wrap">
              <OntologyReleaseBadges
                bump={releaseBump(
                  release.semanticVersion,
                  release.baseReleaseId
                    ? versions.get(release.baseReleaseId)
                    : undefined
                )}
                isLatest={release.id === latestReleaseId}
                release={release}
                status={status}
              />
            </Box>
            {release.releaseNotes ? (
              <Typography
                className={classNames(
                  'tw:truncate',
                  isMuted ? 'tw:text-quaternary' : 'tw:text-secondary'
                )}
                size="text-sm">
                {release.releaseNotes}
              </Typography>
            ) : null}
          </Box>
          {/* One line each: the date never wraps onto a third line. */}
          <Box
            className="tw:w-56 tw:shrink-0 tw:whitespace-nowrap"
            direction="col">
            <Typography ellipsis color="secondary" size="text-sm">
              {release.sealedBy}
            </Typography>
            <Typography color="secondary" size="text-sm">
              {formatDateTimeLong(release.sealedAt, DATE_TIME_12_HOUR_FORMAT)}
            </Typography>
          </Box>
          <div className="tw:w-56 tw:shrink-0">
            <ReleaseApprover release={release} />
          </div>
          {/* The menu's own clicks and keys stay with the menu, not the row. */}
          <Box
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}>
            <ReleaseRowMenu
              canWithdraw={release.id === withdrawableReleaseId}
              release={release}
              onCompare={() => setComparing({ to: release })}
              onOpen={() => onSelect(release.id)}
              onOpenTask={onOpenTask}
              onWithdraw={onWithdraw}
            />
          </Box>
        </Box>
      </li>
    );
  };

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
        onCompare={ontologyId ? () => setComparing({}) : undefined}
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

  if (isAiMode && comparing && ontologyId) {
    return (
      <Box data-testid="ontology-release-history" direction="col" gap={4}>
        <Button
          className="tw:self-start"
          color="link-gray"
          data-testid="ontology-release-compare-back"
          iconLeading={ArrowLeft}
          size="sm"
          onPress={() => setComparing(undefined)}>
          {t('label.all-releases')}
        </Button>
        <OntologyReleaseCompare
          initialTo={comparing.to}
          ontologyId={ontologyId}
        />
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
