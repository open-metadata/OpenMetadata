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
import { MemoryDerivation } from '../../generated/entity/context/memoryDerivation';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../generated/entity/data/glossaryTerm';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import { Task } from '../../rest/tasksAPI';
import {
  canDecideAiGeneratedDraft,
  getGlossaryEntityLink,
  isAiGeneratedDraft,
  permissionForApproveOrReject,
} from '../GlossaryPureUtils';
import {
  GlossaryProposal,
  ProposalCounts,
  ProposalFilter,
  ProposalSource,
} from './GlossaryReview.types';

export const PENDING_REVIEW_STATUSES = [
  EntityStatus.Draft,
  EntityStatus.InReview,
];

/** Who proposed a term, or nothing once a person has decided it. */
export const getProposalSource = (
  term: Pick<GlossaryTerm, 'entityStatus' | 'provider'>
): ProposalSource | undefined => {
  if (isAiGeneratedDraft(term)) {
    return 'ai';
  }

  return term.entityStatus &&
    PENDING_REVIEW_STATUSES.includes(term.entityStatus)
    ? 'person'
    : undefined;
};

const indexBy = <T>(items: T[], key: (item: T) => string | undefined) =>
  new Map(
    items.flatMap((item) => {
      const id = key(item);

      return id ? [[id, item] as const] : [];
    })
  );

const SOURCE_ORDER: Record<ProposalSource, number> = { ai: 0, person: 1 };

// AI proposals come first, as in the review design; within a source, the newest first.
const byReviewOrder = (left: GlossaryProposal, right: GlossaryProposal) =>
  SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source] ||
  (right.term.updatedAt ?? 0) - (left.term.updatedAt ?? 0);

/** The terms still awaiting review, each with what explains it: evidence or an approval task. */
export const toProposals = (
  terms: GlossaryTerm[],
  derivations: MemoryDerivation[],
  approvalTasks: Task[]
): GlossaryProposal[] => {
  const derivationByTerm = indexBy(derivations, (item) => item.entity.id);
  const taskByTerm = indexBy(
    approvalTasks,
    (task) => task.about?.fullyQualifiedName
  );

  return terms
    .flatMap((term) => {
      const source = getProposalSource(term);

      return source
        ? [
            {
              term,
              source,
              derivation: derivationByTerm.get(term.id),
              approvalTask: taskByTerm.get(term.fullyQualifiedName ?? ''),
            },
          ]
        : [];
    })
    .sort(byReviewOrder);
};

export const countProposals = (
  proposals: GlossaryProposal[]
): ProposalCounts => {
  const ai = proposals.filter((proposal) => proposal.source === 'ai').length;

  return { all: proposals.length, ai, person: proposals.length - ai };
};

/** Filtering by who proposed only helps when both AI agents and people have proposals. */
export const hasProposalsFromBothSources = (counts: ProposalCounts) =>
  counts.ai > 0 && counts.person > 0;

/** The filter that applies: every proposal, once only one source has any left. */
export const getActiveFilter = (
  counts: ProposalCounts,
  filter: ProposalFilter
): ProposalFilter => (hasProposalsFromBothSources(counts) ? filter : 'all');

export const filterProposals = (
  proposals: GlossaryProposal[],
  filter: ProposalFilter
) =>
  filter === 'all'
    ? proposals
    : proposals.filter((proposal) => proposal.source === filter);

/** The agent's confidence as a whole percentage, when it recorded one. */
export const getConfidencePercent = (derivation?: MemoryDerivation) => {
  const confidence = derivation?.evidence?.confidence;

  return confidence === undefined ? undefined : Math.round(confidence * 100);
};

/** Who wrote a person's proposal: the approval request's author, else the last editor. */
export const getProposalAuthor = (proposal: GlossaryProposal) =>
  proposal.approvalTask?.createdBy?.displayName ??
  proposal.approvalTask?.createdBy?.name ??
  proposal.term.updatedBy;

/**
 * Whether the user decides this proposal. A term the approval workflow holds is decided through
 * its approval request; an AI draft directly, by its reviewers or by anyone who can edit it.
 */
export const canDecideProposal = (
  proposal: GlossaryProposal,
  user: User | undefined,
  canEditTerm: boolean
) => {
  if (!proposal.approvalTask) {
    return canDecideAiGeneratedDraft(proposal.term, user, canEditTerm);
  }
  if (!user) {
    return false;
  }
  const entityLink = getGlossaryEntityLink(
    proposal.term.fullyQualifiedName ?? ''
  );

  return permissionForApproveOrReject(
    { ...proposal.term, children: undefined },
    user,
    { [entityLink]: [proposal.approvalTask] }
  ).permission;
};

/** The people a proposal waits on, named to everyone who cannot decide it. */
export const getDeciders = (proposal: GlossaryProposal): EntityReference[] => {
  const assignees = proposal.approvalTask?.assignees ?? [];

  return assignees.length > 0 ? assignees : proposal.term.reviewers ?? [];
};
