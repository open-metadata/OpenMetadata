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
  Box,
  ButtonGroup,
  ButtonGroupItem,
  PaginationCardWithControls,
  Typography,
} from '@openmetadata/ui-core-components';
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_BASE } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../../generated/entity/data/glossaryTerm';
import { useGlossaryProposals } from '../../../../hooks/governance/glossary/useGlossaryProposals';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
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
  filterProposals,
  getActiveFilter,
  hasProposalsFromBothSources,
} from '../../../../utils/GlossaryReview/GlossaryReview.utils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { useGlossaryStore } from '../../../Glossary/useGlossary.store';
import ProposalCard from './ProposalCard';

const FILTERS: ProposalFilter[] = ['all', 'ai', 'person'];

const FILTER_LABELS: Record<ProposalFilter, string> = {
  all: 'label.filter-all-count',
  ai: 'label.filter-ai-count',
  person: 'label.filter-people-count',
};

const ResolvedList = ({ resolved }: { resolved: ResolvedProposal[] }) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:border-t tw:border-secondary tw:px-4 tw:pt-3 tw:pb-4"
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

interface PanelHeaderProps {
  counts: ProposalCounts;
  filter: ProposalFilter;
  onFilterChange: (filter: ProposalFilter) => void;
}

const PanelHeader = ({ counts, filter, onFilterChange }: PanelHeaderProps) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:border-b tw:border-secondary tw:px-4 tw:pt-4 tw:pb-3"
      direction="col"
      gap={3}>
      <Box align="center" gap={1} justify="between" wrap="wrap">
        <Typography size="text-md" weight="semibold">
          {t('label.pending-review')}
        </Typography>
        <span className="tw:text-sm tw:whitespace-nowrap tw:text-tertiary">
          {t('label.pending-review-count', { count: counts.all })}
        </span>
      </Box>
      {hasProposalsFromBothSources(counts) && (
        <div className="tw:overflow-x-auto">
          <ButtonGroup
            disallowEmptySelection
            className="tw:w-full tw:min-w-max"
            selectedKeys={[filter]}
            selectionMode="single"
            size="sm"
            onSelectionChange={(keys) =>
              onFilterChange(FILTERS.find((key) => keys.has(key)) ?? 'all')
            }>
            {FILTERS.map((key) => (
              <ButtonGroupItem
                className="tw:flex-1 tw:justify-center"
                data-testid={`proposal-filter-${key}`}
                id={key}
                key={key}>
                {t(FILTER_LABELS[key], { count: counts[key] })}
              </ButtonGroupItem>
            ))}
          </ButtonGroup>
        </div>
      )}
    </Box>
  );
};

/** The proposals awaiting review under a glossary or a term: AI agents' and people's. */
const PendingReviewPanel = () => {
  const { t } = useTranslation();
  const { data, type, permissions } = useGenericContext<GlossaryTerm>();
  const { currentUser } = useApplicationStore();
  const {
    onEditGlossaryTerm,
    selectedProposalId,
    setGlossaryChildTerms,
    setSelectedProposalId,
  } = useGlossaryStore();
  const [filter, setFilter] = useState<ProposalFilter>('all');
  const [page, setPage] = useState(1);
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
  const { proposals, counts, isLoading, decide } = useGlossaryProposals(scope);
  const { canEditAll } = getDerivedPermissionFlags(permissions, data?.deleted);
  const activeFilter = getActiveFilter(counts, filter);
  const visible = useMemo(
    () => filterProposals(proposals, activeFilter),
    [proposals, activeFilter]
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE_BASE));
  const currentPage = Math.min(page, totalPages);
  const pageProposals = visible.slice(
    (currentPage - 1) * PAGE_SIZE_BASE,
    currentPage * PAGE_SIZE_BASE
  );
  const selectedIndex = visible.findIndex(
    ({ term }) => term.id === selectedProposalId
  );

  useEffect(() => setPage(1), [activeFilter, scope?.id]);
  useEffect(() => {
    if (selectedIndex >= 0) {
      setPage(Math.floor(selectedIndex / PAGE_SIZE_BASE) + 1);
    }
  }, [selectedIndex, selectedProposalId]);

  const expandedId =
    pageProposals.find((proposal) => proposal.term.id === selectedProposalId)
      ?.term.id ?? pageProposals[0]?.term.id;

  const decideProposal = async (
    proposal: GlossaryProposal,
    decision: ProposalDecision,
    comment?: string
  ) => {
    const isSettled = await decide(proposal, decision, comment);
    if (isSettled) {
      // Read the table's terms now: another decision or a load may have changed them meanwhile.
      setGlossaryChildTerms(
        updateGlossaryTermStatus(
          useGlossaryStore.getState().glossaryChildTerms,
          proposal.term.fullyQualifiedName ?? '',
          decision
        )
      );
      setResolved((previous) => [
        { term: proposal.term, decision },
        ...previous,
      ]);
    } else {
      showSuccessToast(t('message.vote-recorded'));
    }
  };

  if (isLoading || (proposals.length === 0 && resolved.length === 0)) {
    return null;
  }

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-surface"
      data-testid="pending-review-panel">
      <PanelHeader
        counts={counts}
        filter={activeFilter}
        onFilterChange={setFilter}
      />
      <Box className="tw:p-3" direction="col" gap={3}>
        {visible.length === 0 ? (
          <span className="tw:py-6 tw:text-center tw:text-sm tw:text-tertiary">
            {t('message.nothing-waiting-for-review')}
          </span>
        ) : (
          pageProposals.map((proposal) => (
            <ProposalCard
              canDecide={
                !data?.deleted &&
                canDecideProposal(proposal, currentUser, canEditAll)
              }
              isExpanded={proposal.term.id === expandedId}
              key={proposal.term.id}
              proposal={proposal}
              onDecide={(decision, comment) =>
                decideProposal(proposal, decision, comment)
              }
              onEdit={
                canEditAll ? () => onEditGlossaryTerm(proposal.term) : undefined
              }
              onExpand={() => setSelectedProposalId(proposal.term.id)}
            />
          ))
        )}
      </Box>
      {totalPages > 1 && (
        <PaginationCardWithControls
          minimal
          page={currentPage}
          total={totalPages}
          onPageChange={setPage}
        />
      )}
      {resolved.length > 0 && <ResolvedList resolved={resolved} />}
    </div>
  );
};

export default PendingReviewPanel;
