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
import { OntologyConceptType } from '../../../generated/entity/data/ontologyConcept';
import { DataType } from '../../../generated/entity/data/table';
import {
  AssetType,
  State,
} from '../../../generated/type/ontologyConceptBindingsResponse';
import {
  buildOntologyBindingGraph,
  getOntologyColumnOptions,
} from './OntologyConceptBindings.utils';
import { OntologyStudioModel } from './OntologyStudioModel.utils';

it('preserves exact nested segments including dots and escaped quotes', () => {
  const options = getOntologyColumnOptions(
    [
      {
        name: 'address',
        dataType: DataType.Struct,
        fullyQualifiedName: 'svc.db.schema."customer.data".address',
        children: [
          {
            name: 'zip.code',
            dataType: DataType.String,
            fullyQualifiedName:
              'svc.db.schema."customer.data".address."zip.code"',
          },
          {
            name: 'quoted"name',
            dataType: DataType.String,
            fullyQualifiedName:
              'svc.db.schema."customer.data".address."quoted""name"',
          },
        ],
      },
    ],
    'svc.db.schema."customer.data"'
  );

  expect(options.map((option) => option.path)).toEqual([
    ['address'],
    ['address', 'zip.code'],
    ['address', 'quoted"name'],
  ]);
});

it('draws only authorized associations and exact column assignments without table lineage', () => {
  const concept = {
    id: 'customer',
    name: 'Customer',
    fullyQualifiedName: 'Owner.Customer',
    iri: 'urn:Customer',
    ontology: { id: 'owner', type: 'ontology' },
    conceptType: OntologyConceptType.OwlClass,
  };
  const model: OntologyStudioModel = {
    ontology: {
      id: 'owner',
      name: 'Owner',
      fullyQualifiedName: 'Owner',
      iri: 'urn:Owner',
      namespace: 'urn:',
    },
    concepts: [concept],
    properties: [],
    axioms: [],
  };
  const graph = buildOntologyBindingGraph(
    model,
    concept,
    {
      revision: 3,
      assets: [
        {
          assetId: 'table1',
          assetType: AssetType.Table,
          asset: { id: 'table1', type: 'table', name: 'customers' },
          columns: [
            {
              propertyId: 'id',
              columnPath: ['nested', 'id'],
              state: State.Unresolved,
            },
          ],
        },
        {
          assetId: 'table2',
          assetType: AssetType.Table,
          asset: { id: 'table2', type: 'table', name: 'orders' },
          columns: [],
        },
      ],
    },
    'Linked asset',
    'Unavailable'
  );

  expect(graph.nodes).toHaveLength(4);
  expect(graph.nodes.find((node) => node.type === 'column')?.label).toBe(
    'nested › id · Unavailable'
  );
  expect(graph.edges.filter((edge) => edge.from === concept.id)).toHaveLength(
    3
  );
  expect(
    graph.edges.some(
      (edge) => edge.from.includes('table1') && edge.to.includes('table2')
    )
  ).toBe(false);
});
