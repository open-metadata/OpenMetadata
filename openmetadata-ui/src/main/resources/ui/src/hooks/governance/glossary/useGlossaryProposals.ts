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
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { MemoryDerivation } from '../../../generated/entity/context/memoryDerivation';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { queryClient } from '../../../queryClient';
import {
  getMemoryDerivations,
  MAX_DERIVATION_ENTITIES,
} from '../../../rest/contextMemoryAPI';
import { getGlossaryTermsById } from '../../../rest/glossaryAPI';
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
  ProposalDecision,
} from '../../../utils/GlossaryReview/GlossaryReview.types';
import {
  getProposalSource,
  toProposals,
} from '../../../utils/GlossaryReview/GlossaryReview.utils';
import { isTaskPendingFurtherApproval } from '../../../utils/TaskNavigationUtils';

export const GLOSSARY_PROPOSALS_QUERY_KEY = ['governance', 'glossaryProposals'];

/** Refreshes every review view after a term is created, edited or decided outside the panel. */
export const refreshGlossaryProposals = () =>
  queryClient.invalidateQueries({ queryKey: GLOSSARY_PROPOSALS_QUERY_KEY });

/** Settles a proposal; false when the approval still waits for other reviewers. */
export type DecideProposal = (
  proposal: GlossaryProposal,
  decision: ProposalDecision,
  comment?: string
) => Promise<boolean>;

const NO_DERIVATIONS: MemoryDerivation[] = [];

// A proposal in review, an AI agent's or a person's, has an approval request; one read gets them.
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
    fields: 'about,assignees,createdBy,comments',
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
  // A proposal lists even when its approval request is missing or unreadable; it then offers no decision.
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

// A term read on its own carries the reviewers it inherits, as the listing does.
const fetchProposal = async (termId: string) => {
  const term = await getGlossaryTermsById(termId, {
    fields: 'reviewers,parent',
  });
  const [proposal] = await toExplainedProposals([term]);

  return proposal ?? null;
};

// The approval workflow owns a proposal's status, so only its approval request decides it.
const settle = async (
  proposal: GlossaryProposal,
  decision: ProposalDecision,
  comment?: string
) => {
  if (!proposal.approvalTask) {
    throw new Error('A proposal is decided through its approval request');
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

/** One proposal wherever its page is, such as the term page it heads. */
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
