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

import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { buildVisualSparqlQuery } from './OntologyVisualQueryBuilder';

describe('buildVisualSparqlQuery', () => {
  it('compiles the selected relation and target into auditable SPARQL', () => {
    const relationType: RelationshipType = createRelationshipTypeMock({
      name: 'governedBy',
      displayName: 'Governed by',
      rdfPredicate: 'https://example.com/ontology/governedBy',
    });
    const target: GlossaryTerm = {
      id: 'target-id',
      name: 'AntiMoneyLaundering',
      description: '',
      fullyQualifiedName: 'Compliance.AntiMoneyLaundering',
      glossary: { id: 'glossary-id', type: 'glossary' },
    };

    const query = buildVisualSparqlQuery(relationType, target);

    expect(query).toContain('<https://example.com/ontology/governedBy>');
    expect(query).toContain(
      'om:fullyQualifiedName "Compliance.AntiMoneyLaundering"'
    );
    expect(query).toContain('SELECT ?concept ?conceptFqn');
  });
});
