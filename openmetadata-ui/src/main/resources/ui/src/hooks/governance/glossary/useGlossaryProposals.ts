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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chunk } from 'lodash';
import { useCallback, useMemo } from 'react';
import { PAGE_SIZE_BASE, PAGE_SIZE_LARGE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { MemoryDerivation } from '../../../generated/entity/context/memoryDerivation';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../generated/entity/data/glossaryTerm';
import { queryClient } from '../../../queryClient';
import {
  getMemoryDerivations,
  MAX_DERIVATION_ENTITIES,
} from '../../../rest/contextMemoryAPI';
import {
  getGlossaryTermsById,
  patchGlossaryTerm,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import { postExactAggregateFieldOptions } from '../../../rest/miscAPI';
import {
  listTasks,
  resolveTask,
  Task,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from '../../../rest/tasksAPI';
import {
  GlossaryProposal,
  ProposalCounts,
  ProposalDecision,
  ProposalFilter,
  ProposalSlice,
  ProposalSource,
} from '../../../utils/GlossaryReview/GlossaryReview.types';
import {
  getPageSlices,
  getProposalSource,
  PENDING_REVIEW_STATUSES,
  toProposals,
} from '../../../utils/GlossaryReview/GlossaryReview.utils';
import { isTaskPendingFurtherApproval } from '../../../utils/TaskNavigationUtils';

export const GLOSSARY_PROPOSALS_QUERY_KEY = ['governance', 'glossaryProposals'];

/** Refreshes every review view after a term is created, edited or decided outside the panel. */
export const refreshGlossaryProposals = () =>
  queryClient.invalidateQueries({ queryKey: GLOSSARY_PROPOSALS_QUERY_KEY });

/** A glossary's proposals are all its pending terms; a term's, its pending children. */
export interface ProposalScope {
  id: string;
  fullyQualifiedName: string;
  isGlossary: boolean;
}

/** Settles a proposal; false when the approval still waits for other reviewers. */
export type DecideProposal = (
  proposal: GlossaryProposal,
  decision: ProposalDecision,
  comment?: string
) => Promise<boolean>;

/** How many proposals the review panel shows at a time. */
export const PROPOSALS_PAGE_SIZE = PAGE_SIZE_BASE;

const NO_PROPOSALS: GlossaryProposal[] = [];
const NO_DERIVATIONS: MemoryDerivation[] = [];
const NO_COUNTS: ProposalCounts = { all: 0, ai: 0, person: 0 };
const PENDING_STATUSES = PENDING_REVIEW_STATUSES.join(',');

const scopeParams = (scope: ProposalScope) =>
  scope.isGlossary ? { glossary: scope.id } : { parent: scope.id };

// An AI agent's proposal carries the automation provider; any other pending term is a person's.
const sourceParams = (source: ProposalSource) =>
  source === 'ai'
    ? { provider: ProviderType.Automation }
    : { excludeProvider: ProviderType.Automation };

const countPendingTerms = async (
  scope: ProposalScope,
  source?: ProposalSource
) => {
  const { paging } = await searchGlossaryTermsPaginated({
    ...scopeParams(scope),
    ...(source ? sourceParams(source) : {}),
    entityStatus: PENDING_STATUSES,
    limit: 1,
  });

  return paging?.total ?? 0;
};

const fetchProposalCounts = async (
  scope: ProposalScope
): Promise<ProposalCounts> => {
  const [all, ai] = await Promise.all([
    countPendingTerms(scope),
    countPendingTerms(scope, 'ai'),
  ]);

  return { all, ai, person: all - ai };
};

// Only a person's proposal in review has an approval request, and one request reads them all.
const getApprovalTasks = async (terms: GlossaryTerm[]) => {
  const inReview = terms
    .filter((term) => term.entityStatus === EntityStatus.InReview)
    .map((term) => term.id);
  if (inReview.length === 0) {
    return [];
  }
  const { data } = await listTasks({
    status: TaskEntityStatus.Open,
    category: TaskCategory.Approval,
    type: TaskEntityType.RequestApproval,
    aboutEntityIds: inReview.join(','),
    limit: PAGE_SIZE_LARGE,
    fields: 'about,assignees,createdBy',
  });

  return data;
};

// The evidence is an extra: a caller who may not read memories still reviews the terms.
const getTermDerivations = (termIds: string[]) =>
  Promise.all(
    chunk(termIds, MAX_DERIVATION_ENTITIES).map((ids) =>
      getMemoryDerivations(EntityType.GLOSSARY_TERM, ids).catch(() => [])
    )
  ).then((derivations) => derivations.flat());

const toExplainedProposals = async (terms: GlossaryTerm[]) => {
  // Without its approval request a person's proposal names who decides it, and AI drafts stay.
  const [derivations, approvalTasks] = await Promise.all([
    getTermDerivations(
      terms
        .filter((term) => getProposalSource(term) === 'ai')
        .map((term) => term.id)
    ),
    getApprovalTasks(terms).catch((): Task[] => []),
  ]);

  return toProposals(terms, derivations, approvalTasks);
};

const fetchProposalPage = async (
  scope: ProposalScope,
  slices: ProposalSlice[]
) => {
  const pages = await Promise.all(
    slices.map((slice) =>
      searchGlossaryTermsPaginated({
        ...scopeParams(scope),
        ...sourceParams(slice.source),
        entityStatus: PENDING_STATUSES,
        fields: 'reviewers,parent',
        limit: slice.limit,
        offset: slice.offset,
      })
    )
  );

  return toExplainedProposals(pages.flatMap(({ data }) => data));
};

// A term read on its own carries the reviewers it inherits, as the listing does.
const fetchProposal = async (termId: string) => {
  const term = await getGlossaryTermsById(termId, {
    fields: 'reviewers,parent',
  });
  const [proposal] = await toExplainedProposals([term]);

  return proposal ?? null;
};

const settle = async (
  proposal: GlossaryProposal,
  decision: ProposalDecision,
  comment?: string
) => {
  if (!proposal.approvalTask) {
    await patchGlossaryTerm(proposal.term.id, [
      { op: 'replace', path: '/entityStatus', value: decision },
    ]);

    return true;
  }
  const isApproval = decision === EntityStatus.Approved;
  const task = await resolveTask(String(proposal.approvalTask.id), {
    comment,
    newValue: isApproval ? 'approved' : 'rejected',
    resolutionType: isApproval
      ? TaskResolutionType.Approved
      : TaskResolutionType.Rejected,
  });

  return !isTaskPendingFurtherApproval(task);
};

/** How many proposals a glossary or a term awaits, and how many of them AI agents made. */
export const useGlossaryProposalCounts = (scope?: ProposalScope) => {
  const { data, isPending } = useQuery({
    enabled: Boolean(scope?.id),
    queryFn: () => fetchProposalCounts(scope as ProposalScope),
    queryKey: [...GLOSSARY_PROPOSALS_QUERY_KEY, 'counts', scope?.id],
  });

  return {
    counts: data ?? NO_COUNTS,
    isLoading: Boolean(scope?.id) && isPending,
  };
};

const PAGE_QUERY_KEY = [...GLOSSARY_PROPOSALS_QUERY_KEY, 'page'];

/** One page of the review queue, read from the server: AI agents' proposals, then people's. */
export const useGlossaryProposalPage = (
  scope: ProposalScope | undefined,
  filter: ProposalFilter,
  page: number,
  counts: ProposalCounts
) => {
  const slices = useMemo(
    () => getPageSlices(filter, page, counts, PROPOSALS_PAGE_SIZE),
    [filter, page, counts]
  );
  const isEnabled = Boolean(scope?.id) && slices.length > 0;
  const { data, isPending } = useQuery({
    enabled: isEnabled,
    queryFn: () => fetchProposalPage(scope as ProposalScope, slices),
    queryKey: [...PAGE_QUERY_KEY, scope?.id, slices],
    // The page on show stays until the next arrives, unless it is another glossary's or term's.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[PAGE_QUERY_KEY.length] === scope?.id
        ? previous
        : undefined,
  });

  return {
    proposals: (isEnabled && data) || NO_PROPOSALS,
    isLoading: isEnabled && isPending,
  };
};

/** One proposal wherever its page is, such as the one selected in the terms table. */
export const useGlossaryProposal = (termId?: string) => {
  const { data } = useQuery({
    enabled: Boolean(termId),
    queryFn: () => fetchProposal(termId ?? ''),
    queryKey: [...GLOSSARY_PROPOSALS_QUERY_KEY, 'proposal', termId],
  });

  return data ?? undefined;
};

/** Settles a proposal, then refreshes every view of the review queue. */
export const useDecideProposal = (): DecideProposal => {
  const client = useQueryClient();

  return useCallback<DecideProposal>(
    async (proposal, decision, comment) => {
      const isSettled = await settle(proposal, decision, comment);
      await client.invalidateQueries({
        queryKey: GLOSSARY_PROPOSALS_QUERY_KEY,
      });

      return isSettled;
    },
    [client]
  );
};

/** Why an AI agent proposed each of these terms, for the rows a table shows. */
export const useTermDerivations = (termIds: string[]) => {
  const ids = useMemo(() => [...termIds].sort(), [termIds]);
  const { data } = useQuery({
    enabled: ids.length > 0,
    queryFn: () => getTermDerivations(ids),
    queryKey: [...GLOSSARY_PROPOSALS_QUERY_KEY, 'derivations', ids],
  });

  return data ?? NO_DERIVATIONS;
};

/** Why an AI agent proposed one term, for that term's own page. */
export const useTermDerivation = (termId?: string) => {
  const { data } = useQuery({
    enabled: Boolean(termId),
    queryFn: () =>
      getMemoryDerivations(EntityType.GLOSSARY_TERM, [termId ?? '']).catch(
        () => []
      ),
    queryKey: [...GLOSSARY_PROPOSALS_QUERY_KEY, 'derivation', termId],
  });

  return data?.[0];
};

const GLOSSARY_ID_FIELD = 'glossary.id';
const MAX_GLOSSARY_BUCKETS = 1000;
const PENDING_COUNTS_STALE_TIME = 60 * 1000;
const PENDING_TERMS_FILTER = {
  terms: {
    entityStatus: PENDING_REVIEW_STATUSES.map((status) => status.toLowerCase()),
  },
};
const AI_TERMS_FILTER = {
  term: { 'provider.keyword': ProviderType.Automation },
};

/**
 * Pending terms per glossary, keyed by the glossary's id: its name keyword folds case and accents,
 * so a name would not find its own bucket.
 */
export interface GlossaryPendingCounts {
  all: Record<string, number>;
  ai: Record<string, number>;
}

const countPendingTermsByGlossary = (
  filters: Record<string, unknown>[],
  signal?: AbortSignal
) =>
  postExactAggregateFieldOptions(
    {
      deleted: false,
      fieldName: GLOSSARY_ID_FIELD,
      // The include pattern is required: without one the server returns no buckets.
      fieldValue: '.*',
      index: SearchIndex.GLOSSARY_TERM,
      query: JSON.stringify({ query: { bool: { must: filters } } }),
      size: MAX_GLOSSARY_BUCKETS,
    },
    signal
  ).then(({ data }) =>
    Object.fromEntries(
      (data.aggregations?.[`sterms#${GLOSSARY_ID_FIELD}`]?.buckets ?? []).map(
        ({ key, doc_count }) => [key, doc_count]
      )
    )
  );

/** How many terms await review in each glossary, and how many of those an AI agent proposed. */
export const useGlossaryPendingCounts = (enabled = true) =>
  useQuery({
    enabled,
    queryFn: async ({ signal }): Promise<GlossaryPendingCounts> => {
      const [all, ai] = await Promise.all([
        countPendingTermsByGlossary([PENDING_TERMS_FILTER], signal),
        countPendingTermsByGlossary(
          [PENDING_TERMS_FILTER, AI_TERMS_FILTER],
          signal
        ),
      ]);

      return { ai, all };
    },
    queryKey: [...GLOSSARY_PROPOSALS_QUERY_KEY, 'byGlossary'],
    retry: false,
    staleTime: PENDING_COUNTS_STALE_TIME,
  }).data;
