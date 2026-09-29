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
  ConceptMappingType,
  CreateOntologyChangeSet,
  CreateOntologyChangeSetState,
  EntityStatus,
  OntologyChangeOperation,
  OperationState,
  OperationType,
  Provenance,
} from '../../generated/api/data/createOntologyChangeSet';
import {
  ConceptMappingType as SuggestedConceptMappingType,
  OntologyMappingSuggestion,
} from '../../generated/api/data/ontologyMappingSuggestionList';
import { OntologyRelationshipSuggestion } from '../../generated/api/data/ontologyRelationshipSuggestionList';
import { Glossary } from '../../generated/entity/data/glossary';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { OntologyGraphData, OntologyNode } from './OntologyExplorer.interface';

const MAX_RELATIONSHIP_SOURCES = 5;
const MAX_SOURCE_TERMS = 25;
const ONTOLOGY_EDGE_KIND = 'ontology';
const GLOSSARY_TERM_TYPE_PREFIX = 'glossaryTerm';

export interface OntologyAiScope {
  candidateTermIds: string[];
  relationshipTypeIds: string[];
  sourceTermIds: string[];
}

const termId = (node: OntologyNode): string =>
  node.termId ?? node.entityRef?.id ?? node.id;

const isOntologyTerm = (node: OntologyNode, glossaryId: string): boolean =>
  node.glossaryId === glossaryId &&
  node.type.startsWith(GLOSSARY_TERM_TYPE_PREFIX);

const ontologyTermNodes = (
  graphData: OntologyGraphData | null,
  glossaryId: string
): OntologyNode[] => {
  const nodes = graphData?.nodes ?? [];

  return nodes.filter((node) => isOntologyTerm(node, glossaryId));
};

const connectedTermIds = (graphData: OntologyGraphData | null): Set<string> => {
  const connectedIds = new Set<string>();

  graphData?.edges
    .filter((edge) => !edge.edgeKind || edge.edgeKind === ONTOLOGY_EDGE_KIND)
    .forEach((edge) => {
      connectedIds.add(edge.from);
      connectedIds.add(edge.to);
    });

  return connectedIds;
};

const relationshipSourceNodes = (
  graphData: OntologyGraphData | null,
  nodes: OntologyNode[]
): OntologyNode[] => {
  const connectedIds = connectedTermIds(graphData);
  const isolatedNodes = nodes.filter((node) => !connectedIds.has(termId(node)));
  const preferredNodes = isolatedNodes.length > 0 ? isolatedNodes : nodes;
  const sourceCount = Math.min(
    MAX_RELATIONSHIP_SOURCES,
    Math.max(nodes.length - 1, 0)
  );

  return preferredNodes.slice(0, sourceCount);
};

export const buildOntologyAiScope = (
  graphData: OntologyGraphData | null,
  glossaryId: string,
  relationshipTypes: RelationshipType[]
): OntologyAiScope => {
  const nodes = ontologyTermNodes(graphData, glossaryId);
  const sourceNodes = relationshipSourceNodes(graphData, nodes);
  const sourceIds = new Set(sourceNodes.map(termId));

  return {
    candidateTermIds: nodes
      .filter((node) => !sourceIds.has(termId(node)))
      .map(termId)
      .slice(0, 100),
    relationshipTypeIds: relationshipTypes
      .map((relationshipType) => relationshipType.id)
      .slice(0, MAX_SOURCE_TERMS),
    sourceTermIds: sourceNodes.map(termId).slice(0, MAX_SOURCE_TERMS),
  };
};

export const buildMappingSourceTermIds = (
  graphData: OntologyGraphData | null,
  glossaryId: string
): string[] =>
  ontologyTermNodes(graphData, glossaryId)
    .map(termId)
    .slice(0, MAX_SOURCE_TERMS);

const canonicalMappingType = (
  mappingType: SuggestedConceptMappingType
): ConceptMappingType => {
  let canonicalType: ConceptMappingType;

  switch (mappingType) {
    case SuggestedConceptMappingType.BroadMatch:
      canonicalType = ConceptMappingType.BroadMatch;

      break;
    case SuggestedConceptMappingType.CloseMatch:
      canonicalType = ConceptMappingType.CloseMatch;

      break;
    case SuggestedConceptMappingType.ExactMatch:
      canonicalType = ConceptMappingType.ExactMatch;

      break;
    case SuggestedConceptMappingType.NarrowMatch:
      canonicalType = ConceptMappingType.NarrowMatch;

      break;
    case SuggestedConceptMappingType.RelatedMatch:
      canonicalType = ConceptMappingType.RelatedMatch;

      break;
    case SuggestedConceptMappingType.SameAs:
      canonicalType = ConceptMappingType.SameAs;

      break;
  }

  return canonicalType;
};

export const relationshipDraftOperation = (
  suggestion: OntologyRelationshipSuggestion
): OntologyChangeOperation => {
  const relationship = suggestion.operation.relationship;

  if (!relationship) {
    throw new Error('Relationship suggestion has no relationship payload');
  }

  return {
    baseVersion: suggestion.operation.baseVersion,
    id: suggestion.operation.id,
    operationType: OperationType.AddRelationship,
    relationship: {
      createdAt: relationship.createdAt,
      createdBy: relationship.createdBy,
      fromTerm: relationship.fromTerm,
      id: relationship.id,
      provenance: Provenance.AISuggested,
      relationshipType: relationship.relationshipType,
      status: EntityStatus.Draft,
      toTerm: relationship.toTerm,
    },
    state: OperationState.Active,
    targetId: suggestion.operation.targetId,
  };
};

export const mappingDraftOperation = (
  suggestion: OntologyMappingSuggestion
): OntologyChangeOperation => {
  const mapping = suggestion.operation.mapping;

  if (!mapping) {
    throw new Error('Mapping suggestion has no mapping payload');
  }

  return {
    baseVersion: suggestion.operation.baseVersion,
    id: suggestion.operation.id,
    mapping: {
      conceptIri: mapping.conceptIri,
      mappingType: canonicalMappingType(mapping.mappingType),
      schemeIri: mapping.schemeIri,
      source: mapping.source,
    },
    operationType: OperationType.UpsertMapping,
    state: OperationState.Active,
    targetId: suggestion.operation.targetId,
  };
};

export const proposalChangeSet = (
  glossary: Glossary,
  suggestionId: string,
  displayName: string,
  description: string,
  operation: OntologyChangeOperation
): CreateOntologyChangeSet => ({
  description,
  displayName,
  glossaries: [glossary.fullyQualifiedName ?? glossary.name],
  name: `ai_${suggestionId.replaceAll('-', '')}`,
  operations: [operation],
  state: CreateOntologyChangeSetState.Draft,
  undoCursor: 1,
});

export const glossaryFqn = (glossary: Glossary): string =>
  glossary.fullyQualifiedName ?? glossary.name;
