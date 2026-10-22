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
  Avatar,
  Box,
  Button,
  Card,
  Checkbox,
  Input,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AskCollateSparkle,
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare01,
  Search,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { groupBy } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../../generated/entity/data/glossaryTerm';
import { useDebouncedValue } from '../../../../hooks/common/useDebouncedValue';
import { useDecideProposal } from '../../../../hooks/governance/glossary/useGlossaryProposals';
import { useGlossaryReviewQueue } from '../../../../hooks/governance/glossary/useGlossaryReviewQueue';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useBulkEntityPermissions } from '../../../../hooks/useEntityPermissions/useBulkEntityPermissions';
import { getShortRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { updateGlossaryTermStatus } from '../../../../utils/GlossaryPureUtils';
import {
  GlossaryProposal,
  ProposalCounts,
  ProposalDecision,
  ProposalFilter,
  ResolvedProposal,
} from '../../../../utils/GlossaryReview/GlossaryReview.types';
import {
  canDecideProposal,
  getConfidencePercent,
  getProposalAuthor,
  getProposalLocation,
  hasProposalsFromBothSources,
} from '../../../../utils/GlossaryReview/GlossaryReview.utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { useGlossaryStore } from '../../../Glossary/useGlossary.store';
import {
  FILTERS,
  FILTER_LABELS,
  HIGH_CONFIDENCE_PERCENT,
  LOCATION_SEPARATOR,
  SEARCH_DEBOUNCE_MS,
} from './GlossaryReviewTab.constants';
import ProposalDetail from './ProposalDetail';

const SELECTED_ITEM_CLASS = {
  ai: 'tw:border-utility-purple-500 tw:bg-utility-purple-50',
  person: 'tw:border-utility-warning-500 tw:bg-utility-warning-50',
};

const SourceAvatar = ({ proposal }: { proposal: GlossaryProposal }) => {
  const author = getProposalAuthor(proposal) ?? '';

  return proposal.source === 'ai' ? (
    <span className="tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-utility-purple-100 tw:text-utility-purple-600">
      <AskCollateSparkle aria-hidden className="tw:size-3.5" />
    </span>
  ) : (
    <Avatar alt={author} initials={author.charAt(0).toUpperCase()} size="xs" />
  );
};

interface QueueItemProps {
  proposal: GlossaryProposal;
  isSelected: boolean;
  isChecked: boolean;
  canDecide: boolean;
  onSelect: () => void;
  onCheck: (isChecked: boolean) => void;
}

const QueueItem = ({
  proposal,
  isSelected,
  isChecked,
  canDecide,
  onSelect,
  onCheck,
}: QueueItemProps) => {
  const { t } = useTranslation();
  const { term, approvalTask, derivation, source } = proposal;
  const confidence = getConfidencePercent(derivation);
  const commentCount = approvalTask?.comments?.length ?? 0;
  const meta = [
    approvalTask?.taskId,
    source === 'ai'
      ? derivation?.evidence?.agent ?? t('label.ai-agent')
      : getProposalAuthor(proposal),
    getShortRelativeTime(term.updatedAt),
    confidence === undefined ? undefined : `${confidence}%`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      className={classNames(
        'tw:flex tw:items-start tw:gap-3 tw:border-l-3 tw:px-4 tw:py-3',
        isSelected
          ? SELECTED_ITEM_CLASS[source]
          : 'tw:border-transparent tw:hover:bg-primary_hover'
      )}
      data-testid="review-queue-item">
      <Checkbox
        aria-label={getEntityName(term)}
        className="tw:mt-1"
        isDisabled={!canDecide}
        isSelected={isChecked}
        onChange={onCheck}
      />
      <button
        aria-current={isSelected || undefined}
        className="tw:flex tw:min-w-0 tw:flex-1 tw:cursor-pointer tw:items-start tw:gap-3 tw:text-left"
        type="button"
        onClick={onSelect}>
        <SourceAvatar proposal={proposal} />
        <Box className="tw:min-w-0" direction="col" gap={1}>
          <span className="tw:text-xs tw:font-medium tw:uppercase tw:tracking-wide tw:text-tertiary">
            {term.parent ? t('label.new-child-term') : t('label.new-term')}
          </span>
          <Typography className="tw:truncate" size="text-sm" weight="semibold">
            {getEntityName(term)}
          </Typography>
          <Box align="center" gap={2}>
            <span className="tw:truncate tw:text-xs tw:text-tertiary">
              {meta}
            </span>
            {commentCount > 0 && (
              <span className="tw:inline-flex tw:items-center tw:gap-1 tw:text-xs tw:text-tertiary">
                <MessageSquare01 aria-hidden className="tw:size-3" />
                {commentCount}
              </span>
            )}
          </Box>
        </Box>
      </button>
    </li>
  );
};

interface QueueGroupProps {
  location: string;
  proposals: GlossaryProposal[];
  renderItem: (proposal: GlossaryProposal) => JSX.Element;
}

/** The proposals under one parent, which can be folded away. */
const QueueGroup = ({ location, proposals, renderItem }: QueueGroupProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const aiCount = proposals.filter(({ source }) => source === 'ai').length;
  const personCount = proposals.length - aiCount;
  const Chevron = isOpen ? ChevronDown : ChevronRight;

  return (
    <section data-testid="review-queue-group">
      <button
        aria-expanded={isOpen}
        className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:border-b tw:border-secondary tw:bg-secondary tw:px-4 tw:py-2 tw:text-left"
        type="button"
        onClick={() => setIsOpen(!isOpen)}>
        <Chevron aria-hidden className="tw:size-4 tw:text-fg-quaternary" />
        <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-xs tw:font-semibold tw:text-secondary">
          {location}
        </span>
        {aiCount > 0 && (
          <span className="tw:inline-flex tw:items-center tw:gap-1 tw:text-xs tw:font-medium tw:text-utility-purple-700">
            <AskCollateSparkle aria-hidden className="tw:size-3" />
            {aiCount}
          </span>
        )}
        {personCount > 0 && (
          <span className="tw:inline-flex tw:items-center tw:gap-1 tw:text-xs tw:font-medium tw:text-utility-warning-700">
            <span className="tw:size-2 tw:rounded-full tw:bg-utility-warning-500" />
            {personCount}
          </span>
        )}
      </button>
      {isOpen && (
        <ul className="tw:m-0 tw:list-none tw:p-0">
          {proposals.map(renderItem)}
        </ul>
      )}
    </section>
  );
};

const ResolvedList = ({ resolved }: { resolved: ResolvedProposal[] }) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:border-t tw:border-secondary tw:px-4 tw:py-3"
      data-testid="resolved-proposals"
      direction="col"
      gap={2}>
      <span className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-tertiary">
        {t('label.resolved')}
      </span>
      {resolved.map(({ term, decision }) => (
        <Box align="center" gap={2} key={term.id}>
          {decision === EntityStatus.Approved ? (
            <Check
              aria-hidden
              className="tw:size-3.5 tw:text-fg-success-primary"
            />
          ) : (
            <XClose
              aria-hidden
              className="tw:size-3.5 tw:text-fg-error-primary"
            />
          )}
          <Typography className="tw:truncate" color="secondary" size="text-sm">
            {`${getEntityName(term)} · ${
              decision === EntityStatus.Approved
                ? t('label.approved-by-you')
                : t('label.rejected-by-you')
            }`}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

interface SourceFilterProps {
  /** Unsearched counts: filtering by who proposed only helps while both have proposals. */
  totals: ProposalCounts;
  counts: ProposalCounts;
  filter: ProposalFilter;
  onChange: (filter: ProposalFilter) => void;
}

const SourceFilter = ({
  totals,
  counts,
  filter,
  onChange,
}: SourceFilterProps) => {
  const { t } = useTranslation();
  if (!hasProposalsFromBothSources(totals)) {
    return null;
  }

  return (
    <Tabs
      selectedKey={filter}
      onSelectionChange={(key) =>
        onChange(FILTERS.find((item) => item === key) ?? 'all')
      }>
      <Tabs.List fullWidth size="xs" type="button-border">
        {FILTERS.map((key) => (
          <Tabs.Item data-testid={`proposal-filter-${key}`} id={key} key={key}>
            {t(FILTER_LABELS[key], { count: counts[key] })}
          </Tabs.Item>
        ))}
      </Tabs.List>
    </Tabs>
  );
};

interface BulkActionsProps {
  checkedCount: number;
  isBusy: boolean;
  onSelectConfident: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onDecide: (decision: ProposalDecision) => void;
}

/** Picks proposals to decide together, then approves or rejects them. */
const BulkActions = ({
  checkedCount,
  isBusy,
  onSelectConfident,
  onSelectAll,
  onClear,
  onDecide,
}: BulkActionsProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:border-b tw:border-secondary tw:px-4 tw:py-2"
      data-testid="review-bulk-actions"
      gap={2}
      wrap="wrap">
      {checkedCount === 0 ? (
        <>
          <span className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-tertiary">
            {t('label.bulk')}
          </span>
          <Button
            color="secondary"
            data-testid="select-high-confidence"
            iconLeading={AskCollateSparkle}
            size="xs"
            onPress={onSelectConfident}>
            {t('label.select-ai-above-confidence', {
              percent: HIGH_CONFIDENCE_PERCENT,
            })}
          </Button>
          <Button
            color="secondary"
            data-testid="select-all-shown"
            size="xs"
            onPress={onSelectAll}>
            {t('label.select-all-shown')}
          </Button>
        </>
      ) : (
        <>
          <span className="tw:text-sm tw:font-semibold tw:text-primary">
            {t('label.n-selected', { count: checkedCount })}
          </span>
          <Button
            color="link-gray"
            isDisabled={isBusy}
            size="sm"
            onPress={onClear}>
            {t('label.clear')}
          </Button>
          <span className="tw:flex-1" />
          <Button
            color="secondary-destructive"
            data-testid="bulk-reject"
            isDisabled={isBusy}
            size="sm"
            onPress={() => onDecide(EntityStatus.Rejected)}>
            {t('label.reject')}
          </Button>
          <Button
            color="primary"
            data-testid="bulk-approve"
            iconLeading={Check}
            isLoading={isBusy}
            size="sm"
            onPress={() => onDecide(EntityStatus.Approved)}>
            {t('label.approve-count', { count: checkedCount })}
          </Button>
        </>
      )}
    </Box>
  );
};

interface QueueFooterProps {
  shown: number;
  total: number;
  hasMore: boolean;
  onLoadMore: () => void;
}

const QueueFooter = ({
  shown,
  total,
  hasMore,
  onLoadMore,
}: QueueFooterProps) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:px-4 tw:py-3" gap={2} justify="between">
      <span className="tw:text-xs tw:text-tertiary">
        {t('label.showing-shown-of-total', { shown, total })}
      </span>
      {hasMore && (
        <Button
          color="secondary"
          data-testid="review-queue-load-more"
          size="sm"
          onPress={onLoadMore}>
          {t('label.load-more')}
        </Button>
      )}
    </Box>
  );
};

const EmptyQueue = () => {
  const { t } = useTranslation();

  return (
    <span className="tw:block tw:py-6 tw:text-center tw:text-sm tw:text-tertiary">
      {t('message.nothing-waiting-for-review')}
    </span>
  );
};

/** Every proposal under a glossary or term, AI agents' and people's, to review one by one or in bulk. */
const GlossaryReviewTab = () => {
  const { t } = useTranslation();
  const { data, type } = useGenericContext<GlossaryTerm>();
  const { currentUser } = useApplicationStore();
  const {
    onEditGlossaryTerm,
    selectedProposalId,
    setGlossaryChildTerms,
    setSelectedProposalId,
  } = useGlossaryStore();
  const [query, setQuery] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [resolved, setResolved] = useState<ResolvedProposal[]>([]);
  const scope = useMemo(
    () =>
      data?.id
        ? {
            fullyQualifiedName: data.fullyQualifiedName ?? '',
            id: data.id,
            isGlossary: type === EntityType.GLOSSARY,
          }
        : undefined,
    [data?.id, data?.fullyQualifiedName, type]
  );
  const {
    activeFilter,
    counts,
    totals,
    hasMore,
    isLoading,
    loadMore,
    proposals,
    setFilter,
    setSearch,
  } = useGlossaryReviewQueue(scope);
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const decide = useDecideProposal();
  const proposalFqns = useMemo(
    () => proposals.map(({ term }) => term.fullyQualifiedName ?? ''),
    [proposals]
  );
  const { flagsByFqn } = useBulkEntityPermissions(
    ResourceEntity.GLOSSARY_TERM,
    proposalFqns
  );

  useEffect(() => setSearch(debouncedQuery), [debouncedQuery, setSearch]);

  const canEdit = (proposal: GlossaryProposal) =>
    !data?.deleted &&
    !proposal.term.deleted &&
    Boolean(flagsByFqn[proposal.term.fullyQualifiedName ?? '']?.canEditAll);
  const canDecide = (proposal: GlossaryProposal) =>
    !data?.deleted && canDecideProposal(proposal, currentUser);
  const isConfident = (proposal: GlossaryProposal) =>
    proposal.source === 'ai' &&
    (getConfidencePercent(proposal.derivation) ?? 0) >=
      HIGH_CONFIDENCE_PERCENT &&
    canDecide(proposal);

  const groups = useMemo(
    () =>
      Object.entries(
        groupBy(proposals, ({ term }) =>
          getProposalLocation(term).join(LOCATION_SEPARATOR)
        )
      ),
    [proposals]
  );
  const current =
    proposals.find(({ term }) => term.id === selectedProposalId) ??
    proposals[0];
  // A proposal's request can close after it is ticked; only those still open to the user count.
  const checked = proposals.filter(
    (proposal) => checkedIds.has(proposal.term.id) && canDecide(proposal)
  );

  const settle = async (
    proposal: GlossaryProposal,
    decision: ProposalDecision,
    comment?: string
  ) => {
    const isSettled = await decide(proposal, decision, comment);
    if (!isSettled) {
      showSuccessToast(t('message.vote-recorded'));

      return;
    }
    // Read the table's terms now: another decision or a load may have changed them meanwhile.
    setGlossaryChildTerms(
      updateGlossaryTermStatus(
        useGlossaryStore.getState().glossaryChildTerms,
        proposal.term.fullyQualifiedName ?? '',
        decision
      )
    );
    setResolved((previous) => [{ term: proposal.term, decision }, ...previous]);
  };

  // One at a time: each decision can start a workflow on the term, and they must not race.
  const settleChecked = async (decision: ProposalDecision) => {
    setIsBulkBusy(true);
    try {
      for (const proposal of checked) {
        await settle(proposal, decision);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setCheckedIds(new Set());
      setIsBulkBusy(false);
    }
  };

  const check = (ids: string[]) => setCheckedIds(new Set(ids));
  const toggleChecked = (id: string, isChecked: boolean) =>
    setCheckedIds((previous) => {
      const next = new Set(previous);
      isChecked ? next.add(id) : next.delete(id);

      return next;
    });

  if (!isLoading && totals.all === 0 && resolved.length === 0) {
    return (
      <Card className="tw:flex-1" data-testid="glossary-review-tab" size="sm">
        <Card.Content>
          <EmptyQueue />
        </Card.Content>
      </Card>
    );
  }

  return (
    <div
      className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] tw:gap-3"
      data-testid="glossary-review-tab">
      <Card
        className="tw:flex tw:min-h-0 tw:flex-col"
        data-testid="review-queue"
        size="sm">
        <Box
          className="tw:border-b tw:border-secondary tw:p-4"
          direction="col"
          gap={3}>
          <Input
            aria-label={t('label.search')}
            icon={Search}
            inputDataTestId="review-queue-search"
            placeholder={t('label.search-this-queue')}
            value={query}
            onChange={setQuery}
          />
          <SourceFilter
            counts={counts}
            filter={activeFilter}
            totals={totals}
            onChange={(filter) => {
              setCheckedIds(new Set());
              setFilter(filter);
            }}
          />
        </Box>
        <BulkActions
          checkedCount={checked.length}
          isBusy={isBulkBusy}
          onClear={() => setCheckedIds(new Set())}
          onDecide={settleChecked}
          onSelectAll={() =>
            check(proposals.filter(canDecide).map(({ term }) => term.id))
          }
          onSelectConfident={() =>
            check(proposals.filter(isConfident).map(({ term }) => term.id))
          }
        />
        <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto">
          {proposals.length === 0 && !isLoading && <EmptyQueue />}
          {groups.map(([location, items]) => (
            <QueueGroup
              key={location}
              location={location}
              proposals={items}
              renderItem={(proposal) => (
                <QueueItem
                  canDecide={canDecide(proposal)}
                  isChecked={
                    checkedIds.has(proposal.term.id) && canDecide(proposal)
                  }
                  isSelected={proposal.term.id === current?.term.id}
                  key={proposal.term.id}
                  proposal={proposal}
                  onCheck={(isChecked) =>
                    toggleChecked(proposal.term.id, isChecked)
                  }
                  onSelect={() => setSelectedProposalId(proposal.term.id)}
                />
              )}
            />
          ))}
          <QueueFooter
            hasMore={hasMore}
            shown={proposals.length}
            total={counts[activeFilter]}
            onLoadMore={loadMore}
          />
          {resolved.length > 0 && <ResolvedList resolved={resolved} />}
        </div>
      </Card>
      <div className="tw:min-h-0 tw:overflow-y-auto">
        {current && (
          <ProposalDetail
            canDecide={canDecide(current)}
            key={current.term.id}
            proposal={current}
            onDecide={(decision, comment) => settle(current, decision, comment)}
            onEdit={
              canEdit(current)
                ? () => onEditGlossaryTerm(current.term)
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
};

export default GlossaryReviewTab;
