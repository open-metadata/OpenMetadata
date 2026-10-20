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
import { useCallback, useMemo } from 'react';
import {
  PAGE_SIZE_EXTRA_LARGE,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../generated/entity/data/glossaryTerm';
import { getMemoryDerivations } from '../../../rest/contextMemoryAPI';
import { getGlossaryTerms, patchGlossaryTerm } from '../../../rest/glossaryAPI';
import { postExactAggregateFieldOptions } from '../../../rest/miscAPI';
import {
  listTasks,
  resolveTask,
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
  TaskResolutionType,
} from '../../../rest/tasksAPI';
import {
  GlossaryProposal,
  ProposalCounts,
  ProposalDecision,
} from '../../../utils/GlossaryReview/GlossaryReview.types';
import {
  countProposals,
  getProposalSource,
  PENDING_REVIEW_STATUSES,
  toProposals,
} from '../../../utils/GlossaryReview/GlossaryReview.utils';
import { isTaskPendingFurtherApproval } from '../../../utils/TaskNavigationUtils';

export const GLOSSARY_PROPOSALS_QUERY_KEY = ['governance', 'glossaryProposals'];

/** A glossary's proposals are all its pending terms; a term's, its pending children. */
export interface ProposalScope {
  id: string;
  fullyQualifiedName: string;
  isGlossary: boolean;
}

export interface GlossaryProposals {
  proposals: GlossaryProposal[];
  counts: ProposalCounts;
  isLoading: boolean;
  /** Settles a proposal; false when the approval still waits for other reviewers. */
  decide: (
    proposal: GlossaryProposal,
    decision: ProposalDecision,
    comment?: string
  ) => Promise<boolean>;
}

const NO_PROPOSALS: GlossaryProposal[] = [];

const getApprovalTasks = async (
  scope: ProposalScope,
  terms: GlossaryTerm[]
) => {
  if (!terms.some((term) => term.entityStatus === EntityStatus.InReview)) {
    return [];
  }
  const { data } = await listTasks({
    status: TaskEntityStatus.Open,
    category: TaskCategory.Approval,
    type: TaskEntityType.RequestApproval,
    aboutEntity: scope.fullyQualifiedName,
    limit: PAGE_SIZE_LARGE,
    fields: 'about,assignees,createdBy',
  });

  return data;
};

// The evidence is an extra: a caller who may not read memories still reviews the terms.
const getEvidence = (terms: GlossaryTerm[]) =>
  getMemoryDerivations(
    EntityType.GLOSSARY_TERM,
    terms
      .filter((term) => getProposalSource(term) === 'ai')
      .map((term) => term.id)
  ).catch(() => []);

const fetchProposals = async (scope: ProposalScope) => {
  const { data } = await getGlossaryTerms({
    ...(scope.isGlossary ? { glossary: scope.id } : { parent: scope.id }),
    entityStatus: PENDING_REVIEW_STATUSES.join(','),
    fields: 'reviewers,parent',
    limit: PAGE_SIZE_EXTRA_LARGE,
  });
  const terms = data.filter((term) => getProposalSource(term));
  const [derivations, approvalTasks] = await Promise.all([
    getEvidence(terms),
    getApprovalTasks(scope, terms),
  ]);

  return toProposals(terms, derivations, approvalTasks);
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

export const useGlossaryProposals = (
  scope?: ProposalScope
): GlossaryProposals => {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({
    enabled: Boolean(scope?.id),
    queryFn: () => fetchProposals(scope as ProposalScope),
    queryKey: [...GLOSSARY_PROPOSALS_QUERY_KEY, scope?.id],
  });
  const proposals = data ?? NO_PROPOSALS;

  const decide = useCallback(
    async (
      proposal: GlossaryProposal,
      decision: ProposalDecision,
      comment?: string
    ) => {
      const isSettled = await settle(proposal, decision, comment);
      await queryClient.invalidateQueries({
        queryKey: GLOSSARY_PROPOSALS_QUERY_KEY,
      });

      return isSettled;
    },
    [queryClient]
  );

  return useMemo(
    () => ({
      counts: countProposals(proposals),
      decide,
      isLoading: Boolean(scope?.id) && isPending,
      proposals,
    }),
    [decide, isPending, proposals, scope?.id]
  );
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

const GLOSSARY_NAME_FIELD = 'glossary.name.keyword';
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

/** Pending terms per glossary, keyed by the glossary's lowercased name. */
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
      fieldName: GLOSSARY_NAME_FIELD,
      // The include pattern is required: without one the server returns no buckets.
      fieldValue: '.*',
      index: SearchIndex.GLOSSARY_TERM,
      query: JSON.stringify({ query: { bool: { must: filters } } }),
      size: MAX_GLOSSARY_BUCKETS,
    },
    signal
  ).then(({ data }) =>
    Object.fromEntries(
      (data.aggregations?.[`sterms#${GLOSSARY_NAME_FIELD}`]?.buckets ?? []).map(
        ({ key, doc_count }) => [key.toLowerCase(), doc_count]
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
