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

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/data/ontologyChangeSet';
import { showSuccessToast } from '../../../utils/ToastUtils';
import {
  AiProposalView,
  OntologyNode,
  OntologyProposalRef,
} from '../OntologyExplorer.interface';
import {
  buildOntologyProposals,
  getProposalEdges,
  getProposalQueue,
  getRelationshipDecision,
  getTermDecision,
  OntologyProposal,
  ProposalDecision,
  ProposedRelationship,
  ProposedTerm,
} from '../utils/ontologyProposals';
import { useOntologyProposals } from './useOntologyProposals';

const NO_NODES: OntologyNode[] = [];

interface UseOntologyAiProposalReviewOptions {
  isEnabled: boolean;
  glossaryIds: ReadonlySet<string>;
  graphNodes?: OntologyNode[];
  onApplied: () => void;
  onEditTerm: (fullyQualifiedName: string) => void;
}

/**
 * Review state for AI proposals on the Studio canvas: which proposals exist,
 * what the drawer shows, and the decisions that apply or dismiss them.
 */
export const useOntologyAiProposalReview = ({
  isEnabled,
  glossaryIds,
  graphNodes = NO_NODES,
  onApplied,
  onEditTerm,
}: UseOntologyAiProposalReviewOptions) => {
  const { t } = useTranslation();
  const { apply, changeSets, isSaving, reject } =
    useOntologyProposals(isEnabled);
  const [view, setView] = useState<AiProposalView | null>(null);
  const [isBarClosed, setIsBarClosed] = useState(false);

  const proposals = useMemo(
    () => buildOntologyProposals(changeSets, glossaryIds, graphNodes),
    [changeSets, glossaryIds, graphNodes]
  );
  const queue = useMemo(() => getProposalQueue(proposals), [proposals]);
  const proposedNodes = useMemo(
    () => proposals.terms.map((term) => term.node),
    [proposals]
  );
  const proposedEdges = useMemo(() => getProposalEdges(proposals), [proposals]);
  // The term open in the drawer is drawn as selected on the canvas.
  const focusNodeId = proposals.terms.find(
    (term) => view?.kind === 'item' && term.key === view.key
  )?.node.id;

  // After a decision the drawer moves on to the neighbour, as a review queue.
  const neighbourOf = useCallback(
    (key: string): AiProposalView | null => {
      const index = queue.findIndex((item) => item.key === key);
      const next = queue[index + 1] ?? queue[index - 1];

      return next ? { key: next.key, kind: 'item' } : null;
    },
    [queue]
  );

  const decide = useCallback(
    async (
      item: OntologyProposal,
      decision: ProposalDecision,
      mode: 'apply' | 'reject'
    ): Promise<boolean> => {
      const next = neighbourOf(item.key);
      const isDone = await (mode === 'apply' ? apply : reject)([decision]);
      if (isDone) {
        setView(next);
        if (mode === 'apply') {
          onApplied();
        } else {
          showSuccessToast(t('message.term-proposal-dismissed'));
        }
      }

      return isDone;
    },
    [apply, neighbourOf, onApplied, reject, t]
  );

  const applyTerm = useCallback(
    async (
      term: ProposedTerm,
      checkedRelationshipKeys: ReadonlySet<string>,
      andEdit: boolean
    ) => {
      const isDone = await decide(
        term,
        getTermDecision(term, checkedRelationshipKeys),
        'apply'
      );
      if (isDone) {
        showSuccessToast(
          `${term.node.label} ${t('message.has-been-created-successfully')}`
        );
      }
      if (isDone && andEdit && term.node.fullyQualifiedName) {
        setView(null);
        onEditTerm(term.node.fullyQualifiedName);
      }
    },
    [decide, onEditTerm, t]
  );

  const rejectTerm = useCallback(
    (term: ProposedTerm) => decide(term, getTermDecision(term), 'reject'),
    [decide]
  );

  const applyRelationship = useCallback(
    (relationship: ProposedRelationship, relationshipType: EntityReference) =>
      decide(
        relationship,
        getRelationshipDecision(relationship, relationshipType),
        'apply'
      ),
    [decide]
  );

  const rejectRelationship = useCallback(
    (relationship: ProposedRelationship) =>
      decide(relationship, getRelationshipDecision(relationship), 'reject'),
    [decide]
  );

  const applyAll = useCallback(
    async (decisions: ProposalDecision[], remaining: AiProposalView | null) => {
      if (await apply(decisions)) {
        setView(remaining);
        onApplied();
      }
    },
    [apply, onApplied]
  );

  const applyAllTerms = useCallback(
    () =>
      applyAll(
        proposals.terms.map((term) => getTermDecision(term)),
        proposals.relationships.length
          ? { kind: 'list', tab: 'relationships' }
          : null
      ),
    [applyAll, proposals]
  );

  const applyAllRelationships = useCallback(
    () =>
      applyAll(
        proposals.relationships.map((relationship) =>
          getRelationshipDecision(relationship)
        ),
        proposals.terms.length ? { kind: 'list', tab: 'terms' } : null
      ),
    [applyAll, proposals]
  );

  const openProposal = useCallback(
    (ref: OntologyProposalRef) =>
      setView({ key: ref.operationId, kind: 'item' }),
    []
  );

  const openList = useCallback(
    () =>
      setView({
        kind: 'list',
        tab: proposals.terms.length ? 'terms' : 'relationships',
      }),
    [proposals.terms.length]
  );

  return {
    applyAllRelationships,
    applyAllTerms,
    applyRelationship,
    applyTerm,
    closeBar: () => setIsBarClosed(true),
    closeDrawer: () => setView(null),
    focusNodeId,
    isBarClosed,
    isSaving,
    openList,
    openProposal,
    proposals,
    proposedEdges,
    proposedNodes,
    queue,
    rejectRelationship,
    rejectTerm,
    setView,
    view,
  };
};
