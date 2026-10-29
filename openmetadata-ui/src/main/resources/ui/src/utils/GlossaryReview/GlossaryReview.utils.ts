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
  getGlossaryEntityLink,
  isAiGeneratedDraft,
  permissionForApproveOrReject,
} from '../GlossaryPureUtils';
import { GlossaryProposal, ProposalSource } from './GlossaryReview.types';

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

/**
 * The terms still awaiting review, each with what explains it: evidence or an approval task. They
 * keep the server's order: AI agents' proposals first, then people's.
 */
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

  return terms.flatMap((term) => {
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
  });
};

/** A loaded row of the terms table: a term, whose children are rows too. */
type TermRow = Pick<GlossaryTerm, 'id' | 'entityStatus' | 'provider'> & {
  children?: unknown[];
};

/** The ids of the AI drafts among the terms a table has loaded, nested ones included. */
export const collectAiDraftIds = (rows: TermRow[]): string[] =>
  rows.flatMap((row) => [
    ...(getProposalSource(row) === 'ai' ? [row.id] : []),
    ...collectAiDraftIds((row.children ?? []) as TermRow[]),
  ]);

/** The agent's confidence as a whole percentage, when it recorded one. */
export const getConfidencePercent = (derivation?: MemoryDerivation) => {
  const confidence = derivation?.evidence?.confidence;

  return confidence === undefined ? undefined : Math.round(confidence * 100);
};

/** Who wrote a person's proposal: its approval request's author, else the term's last editor. */
export const getRequestAuthor = (approvalTask?: Task, updatedBy?: string) =>
  approvalTask?.createdBy?.displayName ??
  approvalTask?.createdBy?.name ??
  updatedBy;

export const getProposalAuthor = (proposal: GlossaryProposal) =>
  getRequestAuthor(proposal.approvalTask, proposal.term.updatedBy);

/**
 * Whether the user decides this proposal: every proposal, an AI agent's included, is decided
 * through its approval request, so no one decides one before the approval workflow opens it.
 */
export const canDecideProposal = (
  proposal: GlossaryProposal,
  user: User | undefined
) => {
  if (!proposal.approvalTask || !user) {
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

/**
 * The people a proposal waits on, named to everyone who cannot decide it: its approval request's
 * assignees, and no one before the request opens, since a reviewer cannot decide it either.
 */
export const getDeciders = (proposal: GlossaryProposal): EntityReference[] =>
  proposal.approvalTask?.assignees ?? [];
