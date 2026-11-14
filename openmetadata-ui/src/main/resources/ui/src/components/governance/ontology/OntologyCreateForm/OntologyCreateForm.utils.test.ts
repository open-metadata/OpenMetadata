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

import { Ontology } from '../../../../generated/entity/data/ontology';
import {
  deriveOntologyId,
  derivePrefix,
  generatedOntologyIdentity,
} from './OntologyCreateForm.utils';

const BASE = 'https://open-metadata.org';
const taken = (name: string, namespace: string) =>
  ({ name, displayName: name, namespace } as Ontology);

describe('generatedOntologyIdentity', () => {
  it('names the ontology from its title and gives it an https IRI', () => {
    expect(generatedOntologyIdentity('Fibo sample', BASE, [])).toEqual({
      name: 'fibo-sample',
      displayName: 'Fibo sample',
      iri: 'https://open-metadata.org/onto/fibosamp',
      namespace: 'https://open-metadata.org/onto/fibosamp#',
    });
  });

  it('numbers a title that is already in use', () => {
    const identity = generatedOntologyIdentity('Fibo sample', BASE, [
      taken('fibo-sample', 'https://open-metadata.org/onto/fibosamp#'),
    ]);

    expect(identity).toEqual({
      name: 'fibo-sample-2',
      displayName: 'Fibo sample (2)',
      iri: 'https://open-metadata.org/onto/fibosamp2',
      namespace: 'https://open-metadata.org/onto/fibosamp2#',
    });
  });

  it('waits for the base URI and the ontology list', () => {
    expect(generatedOntologyIdentity('Fibo', '', [])).toBeUndefined();
    expect(generatedOntologyIdentity('Fibo', BASE, undefined)).toBeUndefined();
  });
});

describe('accented names', () => {
  it('keeps an accented letter as its base letter in the ID and the prefix', () => {
    expect(deriveOntologyId('Ümlauts & Café (v2)')).toBe('umlauts-cafe-v2');
    expect(derivePrefix('Ümlauts')).toBe(derivePrefix('Umlauts'));
  });
});
