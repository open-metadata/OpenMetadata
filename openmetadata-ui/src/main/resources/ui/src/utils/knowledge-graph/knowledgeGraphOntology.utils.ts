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
  GraphData,
  GraphNode,
  KnowledgeGraphFilters,
} from '../../components/KnowledgeGraph/KnowledgeGraph.interface';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import {
  getGraphDistances,
  isConceptNode,
  isMappingEdge,
} from './knowledgeGraphPresentation.utils';

export const graphEntityId = (nodeId: string) =>
  nodeId.split('/').pop() ?? nodeId;

export const getOntologyScope = (
  data: GraphData | null,
  rootId: string
): GraphData | null => {
  if (!data) {
    return null;
  }
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const edges = data.edges.filter((edge) => {
    const source = nodes.get(edge.from);
    const target = nodes.get(edge.to);
    if (!source || !target) {
      return false;
    }

    return (
      (isConceptNode(source) && isConceptNode(target)) ||
      isMappingEdge(edge, nodes)
    );
  });
  const ids = new Set([
    rootId,
    ...edges.flatMap((edge) => [edge.from, edge.to]),
  ]);

  return {
    ...data,
    edges,
    nodes: data.nodes.filter(
      (node) => ids.has(node.id) || graphEntityId(node.id) === rootId
    ),
  };
};

const DOMAIN_PREDICATE = 'http://www.w3.org/2000/01/rdf-schema#domain';

/** The glossary exporter emits each declared attribute as a datatype property with rdfs:domain. */
export const addDeclaredOntologyProperties = (
  data: GraphData | null,
  unfiltered: GraphData | null,
  terms: GlossaryTerm[],
  rootId: string,
  depth: number,
  domainLabel: string,
  filters?: KnowledgeGraphFilters
): GraphData | null => {
  if (!data || !unfiltered || depth === 0 || terms.length === 0) {
    return data;
  }
  const excludesProperties = Boolean(
    filters?.entityTypes.length && !filters.entityTypes.includes('property')
  );
  const excludesDomain = Boolean(
    filters?.relationshipTypes.length &&
      !filters.relationshipTypes.includes(DOMAIN_PREDICATE)
  );
  if (excludesProperties || excludesDomain) {
    return data;
  }
  const levels = getGraphDistances(unfiltered, rootId);
  const concepts = new Map(
    data.nodes
      .filter(isConceptNode)
      .map((node) => [graphEntityId(node.id), node])
  );
  const nodes = new Map<string, GraphNode>(
    data.nodes.map((node) => [node.id, node])
  );
  const edges = [...data.edges];
  terms.forEach((term) => {
    const concept = concepts.get(term.id);
    if (!concept || (levels.get(concept.id) ?? Infinity) > depth) {
      return;
    }
    (term.attributes ?? []).forEach((attribute) => {
      const id = attribute.iri ?? 'kg:property:' + term.id + ':' + attribute.id;
      nodes.set(id, {
        id,
        label: attribute.name,
        type: 'property',
        description: attribute.description,
        ontologyProperty: {
          range: attribute.datatypeIri ?? attribute.dataType,
          functional: Boolean(attribute.isIdentifier),
        },
      });
      edges.push({
        from: id,
        to: concept.id,
        label: domainLabel,
        relationType: DOMAIN_PREDICATE,
        category: 'structure',
      });
    });
  });

  return { ...data, nodes: [...nodes.values()], edges };
};
