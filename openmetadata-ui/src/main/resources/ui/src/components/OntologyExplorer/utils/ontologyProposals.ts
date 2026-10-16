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

import { Glossary } from '../../../generated/entity/data/glossary';
import {
  EntityReference,
  OntologyAttribute,
  OntologyChangeOperation,
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationType,
  Provenance,
} from '../../../generated/entity/data/ontologyChangeSet';
import {
  ExplorationMode,
  OntologyEdge,
  OntologyNode,
  OntologyScope,
  OntologyStudioSurface,
} from '../OntologyExplorer.interface';

const PROPOSAL_NODE_ID_PREFIX = 'proposed-';

// The server only lets these states have their operations replaced, which a
// per-item approve or reject needs.
export const EDITABLE_PROPOSAL_STATES = [
  OntologyChangeSetState.Draft,
  OntologyChangeSetState.ApplyFailed,
];

export interface ProposedRelationship {
  kind: 'relationship';
  key: string;
  changeSet: OntologyChangeSet;
  operation: OntologyChangeOperation;
  fromId: string;
  toId: string;
  from: EntityReference;
  to: EntityReference;
  relationType: string;
}

export interface ProposedTerm {
  kind: 'term';
  key: string;
  changeSet: OntologyChangeSet;
  operation: OntologyChangeOperation;
  node: OntologyNode;
  relationships: ProposedRelationship[];
  properties: OntologyAttribute[];
}

export type OntologyProposal = ProposedTerm | ProposedRelationship;

export interface OntologyProposals {
  terms: ProposedTerm[];
  relationships: ProposedRelationship[];
}

export const EMPTY_PROPOSALS: OntologyProposals = {
  relationships: [],
  terms: [],
};

// Operations past the undo cursor are undone and never applied.
export const getActiveOperations = (
  changeSet: OntologyChangeSet
): OntologyChangeOperation[] =>
  changeSet.operations.slice(0, changeSet.undoCursor);

// Memory derivation records its sources; other AI drafts record the model.
const isAiAuthored = (operation: OntologyChangeOperation): boolean =>
  (operation.sourceMemoryIds?.length ?? 0) > 0 || Boolean(operation.modelId);

const isAiTermOperation = (operation: OntologyChangeOperation): boolean =>
  operation.operationType === OperationType.CreateTerm &&
  Boolean(operation.term) &&
  isAiAuthored(operation);

const isAiRelationshipOperation = (
  operation: OntologyChangeOperation
): boolean =>
  operation.operationType === OperationType.AddRelationship &&
  operation.relationship?.provenance === Provenance.AISuggested;

const refersTo = (ref: EntityReference, id?: string, fqn?: string) =>
  ref.id === id ||
  (Boolean(ref.fullyQualifiedName) && ref.fullyQualifiedName === fqn);

class GraphNodeIndex {
  private readonly byKey = new Map<string, OntologyNode>();

  constructor(nodes: OntologyNode[]) {
    nodes.forEach((node) => {
      this.byKey.set(node.id, node);
      if (node.fullyQualifiedName) {
        this.byKey.set(node.fullyQualifiedName, node);
      }
    });
  }

  private find(ref: EntityReference): OntologyNode | undefined {
    return (
      this.byKey.get(ref.id) ?? this.byKey.get(ref.fullyQualifiedName ?? '')
    );
  }

  resolve(ref: EntityReference): string | undefined {
    return this.find(ref)?.id;
  }

  // The loaded graph spans every glossary; only terms in scope are drawn.
  resolveInScope(
    ref: EntityReference,
    glossaryIds: ReadonlySet<string>
  ): string | undefined {
    const node = this.find(ref);

    return node && glossaryIds.has(node.glossaryId ?? '') ? node.id : undefined;
  }

  hasFqn(fqn?: string): boolean {
    return Boolean(fqn) && this.byKey.has(fqn ?? '');
  }
}

const toProposedRelationship = (
  changeSet: OntologyChangeSet,
  operation: OntologyChangeOperation,
  fromId: string | undefined,
  toId: string | undefined
): ProposedRelationship | undefined => {
  const relationship = operation.relationship;
  if (!relationship || !fromId || !toId) {
    return undefined;
  }

  return {
    changeSet,
    from: relationship.fromTerm,
    fromId,
    key: operation.id,
    kind: 'relationship',
    operation,
    relationType:
      relationship.relationshipType.name ?? relationship.relationshipType.id,
    to: relationship.toTerm,
    toId,
  };
};

const toProposedTerm = (
  changeSet: OntologyChangeSet,
  operation: OntologyChangeOperation,
  index: GraphNodeIndex
): ProposedTerm => {
  const term = operation.term as NonNullable<OntologyChangeOperation['term']>;
  const nodeId = `${PROPOSAL_NODE_ID_PREFIX}${operation.id}`;
  const resolveEnd = (ref: EntityReference) =>
    refersTo(ref, term.id, term.fullyQualifiedName)
      ? nodeId
      : index.resolve(ref);
  const relationships = getActiveOperations(changeSet)
    .filter(
      (candidate) =>
        candidate.operationType === OperationType.AddRelationship &&
        candidate.relationship &&
        (refersTo(
          candidate.relationship.fromTerm,
          term.id,
          term.fullyQualifiedName
        ) ||
          refersTo(
            candidate.relationship.toTerm,
            term.id,
            term.fullyQualifiedName
          ))
    )
    .map((candidate) =>
      toProposedRelationship(
        changeSet,
        candidate,
        resolveEnd(candidate.relationship?.fromTerm as EntityReference),
        resolveEnd(candidate.relationship?.toTerm as EntityReference)
      )
    )
    .filter((item): item is ProposedRelationship => Boolean(item));

  return {
    changeSet,
    key: operation.id,
    kind: 'term',
    node: {
      description: term.description,
      fullyQualifiedName: term.fullyQualifiedName,
      glossaryId: term.glossary?.id,
      group: term.glossary?.displayName ?? term.glossary?.name,
      id: nodeId,
      label: term.displayName || term.name,
      proposal: { changeSetId: changeSet.id, operationId: operation.id },
      type: 'glossaryTerm',
    },
    operation,
    properties: term.attributes ?? [],
    relationships,
  };
};

const collectTerms = (
  changeSets: OntologyChangeSet[],
  glossaryIds: ReadonlySet<string>,
  index: GraphNodeIndex
): ProposedTerm[] => {
  const seenFqns = new Set<string>();

  return changeSets.flatMap((changeSet) =>
    getActiveOperations(changeSet)
      .filter((operation) => {
        const fqn = operation.term?.fullyQualifiedName ?? '';
        const isNew =
          isAiTermOperation(operation) &&
          glossaryIds.has(operation.term?.glossary?.id ?? '') &&
          !index.hasFqn(fqn) &&
          !seenFqns.has(fqn);
        if (isNew) {
          seenFqns.add(fqn);
        }

        return isNew;
      })
      .map((operation) => toProposedTerm(changeSet, operation, index))
  );
};

/**
 * AI proposals that fit the canvas: new terms for glossaries already shown,
 * and suggested relationships between terms already drawn. A term proposed by
 * more than one draft, or that now exists, is shown once or not at all.
 */
export const buildOntologyProposals = (
  changeSets: OntologyChangeSet[],
  glossaryIds: ReadonlySet<string>,
  graphNodes: OntologyNode[]
): OntologyProposals => {
  const editable = changeSets.filter((changeSet) =>
    EDITABLE_PROPOSAL_STATES.includes(changeSet.state)
  );
  const index = new GraphNodeIndex(graphNodes);
  const terms = collectTerms(editable, glossaryIds, index);
  const attached = new Set(
    terms.flatMap((term) => term.relationships.map((item) => item.key))
  );
  const relationships = editable.flatMap((changeSet) =>
    getActiveOperations(changeSet)
      .filter(
        (operation) =>
          isAiRelationshipOperation(operation) && !attached.has(operation.id)
      )
      .map((operation) =>
        toProposedRelationship(
          changeSet,
          operation,
          index.resolveInScope(
            operation.relationship?.fromTerm as EntityReference,
            glossaryIds
          ),
          index.resolveInScope(
            operation.relationship?.toTerm as EntityReference,
            glossaryIds
          )
        )
      )
      .filter((item): item is ProposedRelationship => Boolean(item))
  );

  return { relationships, terms };
};

export const getProposalQueue = (
  proposals: OntologyProposals
): OntologyProposal[] => [...proposals.terms, ...proposals.relationships];

export const getProposalEdges = (
  proposals: OntologyProposals
): OntologyEdge[] =>
  [
    ...proposals.terms.flatMap((term) => term.relationships),
    ...proposals.relationships,
  ].map((item) => ({
    from: item.fromId,
    label: item.relationType,
    proposal: {
      changeSetId: item.changeSet.id,
      operationId: item.operation.id,
    },
    relationType: item.relationType,
    to: item.toId,
  }));

// Proposals are drawn only on the Studio concept graph, where a new concept fits.
export const showsOntologyProposals = (
  scope: OntologyScope,
  surface: OntologyStudioSurface,
  explorationMode: ExplorationMode,
  isHierarchyView: boolean
): boolean =>
  scope === 'global' &&
  surface === 'graph' &&
  explorationMode === 'model' &&
  !isHierarchyView;

export const getProposalGlossaryIds = (
  selectedGlossaryIds: string[] | undefined,
  glossaries: Glossary[]
): Set<string> =>
  new Set(
    selectedGlossaryIds?.length
      ? selectedGlossaryIds
      : glossaries.map((glossary) => glossary.id)
  );

/**
 * Operations to apply from one draft, and every operation the decision retires
 * from it. An `edited` operation replaces the draft's copy when applied.
 */
export interface ProposalDecision {
  changeSetId: string;
  apply: string[];
  retire: string[];
  edited?: OntologyChangeOperation;
}

/**
 * A term's unchecked relationships are retired with it rather than left on a
 * term the draft no longer creates.
 */
export const getTermDecision = (
  term: ProposedTerm,
  checkedRelationshipKeys: ReadonlySet<string> = new Set(
    term.relationships.map((item) => item.key)
  )
): ProposalDecision => ({
  apply: [
    term.key,
    ...term.relationships
      .filter((item) => checkedRelationshipKeys.has(item.key))
      .map((item) => item.key),
  ],
  changeSetId: term.changeSet.id,
  retire: [term.key, ...term.relationships.map((item) => item.key)],
});

export const getRelationshipDecision = (
  relationship: ProposedRelationship,
  relationshipType?: EntityReference
): ProposalDecision => {
  const current = relationship.operation.relationship;
  const isRetyped =
    relationshipType && current?.relationshipType.id !== relationshipType.id;

  return {
    apply: [relationship.key],
    changeSetId: relationship.changeSet.id,
    retire: [relationship.key],
    ...(isRetyped && current
      ? {
          edited: {
            ...relationship.operation,
            relationship: { ...current, relationshipType },
          },
        }
      : {}),
  };
};

export const withoutOperations = (
  changeSet: OntologyChangeSet,
  operationIds: ReadonlySet<string>
): { operations: OntologyChangeOperation[]; undoCursor: number } => ({
  operations: changeSet.operations.filter(
    (operation) => !operationIds.has(operation.id)
  ),
  undoCursor: getActiveOperations(changeSet).filter(
    (operation) => !operationIds.has(operation.id)
  ).length,
});

// "relatedTo" or "Related To" reads as "related to", as on the canvas.
export const getRelationLabel = (relationship: ProposedRelationship): string =>
  (
    relationship.operation.relationship?.relationshipType.displayName ??
    relationship.relationType
  )
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLocaleLowerCase();

export const getReferenceLabel = (ref: EntityReference): string =>
  ref.displayName || ref.name || ref.fullyQualifiedName || ref.id;

// Memory-derived proposals come from Ask Collate conversations; any other AI
// draft is attributed to whoever (usually an agent bot) last wrote it.
export const isAskCollateProposal = (item: OntologyProposal): boolean =>
  (item.operation.sourceMemoryIds?.length ?? 0) > 0;

export const getConfidencePercent = (
  operation: OntologyChangeOperation
): number | undefined =>
  operation.confidence === undefined
    ? undefined
    : Math.round(operation.confidence * 100);

export const getConfidenceColor = (
  percent: number
): 'success' | 'warning' | 'gray' => {
  if (percent >= 85) {
    return 'success';
  }

  return percent >= 70 ? 'warning' : 'gray';
};
