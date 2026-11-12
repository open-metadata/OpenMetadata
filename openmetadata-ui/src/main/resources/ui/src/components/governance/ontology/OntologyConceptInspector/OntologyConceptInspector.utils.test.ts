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
import { ConceptMappingType } from '../../../../generated/entity/data/ontologyConcept';
import {
    countFilledSections,
    getCompletenessCounts,
    shortenIri
} from './OntologyConceptInspector.utils';

describe('shortenIri', () => {
  it('elides the middle of a long IRI and keeps its host and last two segments', () => {
    expect(
      shortenIri(
        'https://open-metadata.org/library/fhir/clinical/ClinicalRecord'
      )
    ).toBe('https://open-metadata.org/…/clinical/ClinicalRecord');
  });

  it('leaves a short IRI and a URN whole', () => {
    expect(shortenIri('https://example.org/fhir/Record')).toBe(
      'https://example.org/fhir/Record'
    );
    expect(shortenIri('urn:sales:Customer')).toBe('urn:sales:Customer');
  });
});

describe('countFilledSections', () => {
  it('counts only the sections that have an item', () => {
    expect(countFilledSections([0, 2, 0, 1, 0])).toBe(2);
  });
});

describe('getCompletenessCounts', () => {
  it('counts a blank description as missing and reads mappings from the concept', () => {
    expect(
      getCompletenessCounts(
        {
          description: '  ',
          conceptMappings: [
            {
              conceptIri: 'https://example.org/A',
              mappingType: ConceptMappingType.ExactMatch,
            },
          ],
        },
        { relations: 2, properties: 0, assets: 1 }
      )
    ).toEqual([0, 2, 0, 1, 1]);
  });
});
