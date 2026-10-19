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
  OntologyEdge,
  OntologyGraphData,
} from '../../../components/OntologyExplorer/OntologyExplorer.interface';
import { Ontology } from '../../../generated/entity/data/ontology';
import { OntologyConcept } from '../../../generated/entity/data/ontologyConcept';
import { getEntityName } from '../../EntityNameUtils';

export const buildNativeOntologyGraph = (
  ontology: Ontology,
  concepts: OntologyConcept[]
): OntologyGraphData => {
  const byIri = new Map(concepts.map((concept) => [concept.iri, concept.id]));
  const edges: OntologyEdge[] = [];
  concepts.forEach((concept) => {
    const relations = [
      ...(concept.superClasses ?? []).map((iri) => ({
        iri,
        type: 'subClassOf',
      })),
      ...(concept.conceptMappings ?? []).map((mapping) => ({
        iri: mapping.conceptIri,
        type: mapping.mappingType,
      })),
    ];
    relations.forEach(({ iri, type }) => {
      const target = byIri.get(iri);
      if (target) {
        edges.push({
          id: `${concept.id}:${type}:${target}`,
          from: concept.id,
          to: target,
          label: type,
          relationType: type,
          edgeKind: 'ontology',
        });
      }
    });
  });

  return {
    nodes: concepts.map((concept) => ({
      id: concept.id,
      label: getEntityName(concept),
      type: 'ontologyConcept',
      description: concept.description,
      fullyQualifiedName: concept.fullyQualifiedName,
      group: getEntityName(ontology),
      glossaryId: ontology.id,
      entityRef: {
        id: concept.id,
        type: 'ontologyConcept',
        fullyQualifiedName: concept.fullyQualifiedName,
      },
    })),
    edges,
  };
};
