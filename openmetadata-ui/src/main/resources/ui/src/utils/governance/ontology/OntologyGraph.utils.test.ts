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
import { buildOntologyTreeGroups } from '../../../components/OntologyExplorer/OntologyStudio.utils';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import { buildNativeOntologyGraph } from './OntologyGraph.utils';

const ontology: Ontology = {
  id: 'sales',
  name: 'Sales',
  fullyQualifiedName: 'Sales',
  iri: 'urn:sales',
  namespace: 'urn:sales:',
};
const concept = (
  name: string,
  superClasses: string[] = []
): OntologyConcept => ({
  id: name,
  name,
  fullyQualifiedName: `Sales.${name}`,
  conceptType: OntologyConceptType.OwlClass,
  iri: `urn:${name}`,
  ontology: { id: ontology.id, type: 'ontology' },
  superClasses,
});

it('projects native subclass axioms into the existing graph and tree without glossary entities', () => {
  const graph = buildNativeOntologyGraph(ontology, [
    concept('Customer', ['urn:Party']),
    concept('Party'),
  ]);

  expect(graph.nodes.every((node) => node.type === 'ontologyConcept')).toBe(
    true
  );
  expect(graph.edges).toEqual([
    expect.objectContaining({
      from: 'Customer',
      to: 'Party',
      relationType: 'subClassOf',
    }),
  ]);

  const groups = buildOntologyTreeGroups(
    graph,
    {
      viewMode: 'hierarchy',
      glossaryIds: [],
      relationTypes: [],
      searchQuery: '',
      showIsolatedNodes: true,
      showCrossGlossaryOnly: false,
    },
    [],
    []
  );

  expect(groups[0].glossaryName).toBe('Sales');
  expect(groups[0].rows.map((row) => [row.node.id, row.depth])).toEqual([
    ['Party', 0],
    ['Customer', 1],
  ]);
});

it('does not draw edges to concepts outside the loaded page', () => {
  expect(
    buildNativeOntologyGraph(ontology, [concept('Customer', ['urn:Party'])])
      .edges
  ).toEqual([]);
});
