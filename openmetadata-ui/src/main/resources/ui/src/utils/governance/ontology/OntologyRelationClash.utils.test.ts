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
  Code,
  Severity,
} from '../../../generated/api/data/ontologyProfileReport';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  OntologyConcept,
  OntologyConceptType,
} from '../../../generated/entity/data/ontologyConcept';
import { PaletteKey } from '../../../generated/entity/data/relationshipType';
import { validateOntologyAxiom } from '../../../rest/ontologyAPI';
import {
  NativeRelationType,
  SUBCLASS_OF_PREDICATE,
} from './OntologyNativeRelation.utils';
import { findRelationClash } from './OntologyRelationClash.utils';
import { OntologyStudioModel } from './OntologyStudioModel.utils';

jest.mock('../../../rest/ontologyAPI', () => ({
  validateOntologyAxiom: jest.fn(),
}));

const validate = validateOntologyAxiom as jest.MockedFunction<
  typeof validateOntologyAxiom
>;
const ontology = {
  id: 'ontology-id',
  name: 'Retail',
  fullyQualifiedName: 'Retail',
  iri: 'urn:retail',
  namespace: 'urn:retail:',
} as Ontology;
const concept = (name: string): OntologyConcept => ({
  conceptType: OntologyConceptType.OwlClass,
  fullyQualifiedName: `Retail.${name}`,
  id: `concept-${name}`,
  iri: `urn:retail:${name}`,
  name,
  ontology: { id: ontology.id, type: 'ontology' },
});
const customer = concept('Customer');
const supplier = concept('Supplier');
const model: OntologyStudioModel = {
  axioms: [],
  concepts: [customer, supplier],
  ontology,
  properties: [],
};
const subClassOf: NativeRelationType = {
  group: 'core',
  id: SUBCLASS_OF_PREDICATE,
  kind: 'subClassOf',
  label: 'Sub class of',
  name: 'subClassOf',
  paletteKey: PaletteKey.Blue,
};
const CLASH_MESSAGE = 'Customer would also be a Supplier, which are disjoint.';

describe('findRelationClash', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the server clash message for the proposed parent edge', async () => {
    validate.mockResolvedValue({
      valid: true,
      violations: [
        {
          code: Code.DisjointClash,
          message: CLASH_MESSAGE,
          path: 'subjectIri',
          severity: Severity.Warning,
        },
      ],
    });

    await expect(
      findRelationClash({
        from: customer,
        model,
        to: supplier,
        type: subClassOf,
      })
    ).resolves.toBe(CLASH_MESSAGE);
    expect(validate).toHaveBeenCalledWith(
      expect.objectContaining({
        axiomType: 'SUBCLASS_OF',
        expressions: [{ classIri: supplier.iri, kind: 'NAMED_CLASS' }],
        subjectIri: customer.iri,
      })
    );
  });

  it('is silent when the server reports no clash, and when the check itself fails', async () => {
    validate.mockResolvedValueOnce({ valid: true, violations: [] });

    await expect(
      findRelationClash({
        from: customer,
        model,
        to: supplier,
        type: subClassOf,
      })
    ).resolves.toBeUndefined();

    validate.mockRejectedValueOnce(new Error('network'));

    await expect(
      findRelationClash({
        from: customer,
        model,
        to: supplier,
        type: subClassOf,
      })
    ).resolves.toBeUndefined();
  });
});
