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
import { ONTOLOGY_DATATYPE_OPTIONS } from './OntologyIriInput.constants';

describe('ONTOLOGY_DATATYPE_OPTIONS', () => {
  it('offers only datatypes the server accepts as OWL 2 datatypes', () => {
    expect(ONTOLOGY_DATATYPE_OPTIONS.map(({ label }) => label)).toEqual([
      'string',
      'boolean',
      'integer',
      'decimal',
      'double',
      'dateTime',
      'anyURI',
    ]);
  });

  it('stores each option as its XML Schema IRI', () => {
    expect(ONTOLOGY_DATATYPE_OPTIONS.map(({ iri }) => iri)).toEqual([
      'http://www.w3.org/2001/XMLSchema#string',
      'http://www.w3.org/2001/XMLSchema#boolean',
      'http://www.w3.org/2001/XMLSchema#integer',
      'http://www.w3.org/2001/XMLSchema#decimal',
      'http://www.w3.org/2001/XMLSchema#double',
      'http://www.w3.org/2001/XMLSchema#dateTime',
      'http://www.w3.org/2001/XMLSchema#anyURI',
    ]);
  });
});
