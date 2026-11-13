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
import { matchConcepts } from './OntologyConceptPicker.utils';

const concepts = [
  { id: 'a', name: 'MedicationKnowledgeIndication' },
  { id: 'b', name: '_Patient', parentName: '_DomainResource' },
  { id: 'c', name: 'PatientLinkComponent', parentName: 'BackboneElement' },
  { id: 'd', name: 'Patient', parentName: 'DomainResource' },
  { id: 'e', name: 'Encounter', parentName: 'PatientResource' },
];

describe('matchConcepts', () => {
  it('ranks an exact name first, then prefixes, then other name and parent matches', () => {
    expect(matchConcepts(concepts, ' patient ').map(({ id }) => id)).toEqual([
      'd',
      'c',
      'b',
      'e',
    ]);
  });

  it('lists every concept by name when nothing is typed', () => {
    expect(matchConcepts(concepts, '').map(({ name }) => name)).toEqual([
      '_Patient',
      'Encounter',
      'MedicationKnowledgeIndication',
      'Patient',
      'PatientLinkComponent',
    ]);
  });

  it('returns nothing when no name or parent matches', () => {
    expect(matchConcepts(concepts, 'zzz')).toEqual([]);
  });
});
