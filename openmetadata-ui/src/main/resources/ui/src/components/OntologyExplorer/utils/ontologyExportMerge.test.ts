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

import { mergeOntologyExports } from './ontologyExportMerge';

describe('mergeOntologyExports', () => {
  it('returns a single part unchanged', () => {
    expect(mergeOntologyExports(['@prefix x: <y> .'], 'turtle')).toBe(
      '@prefix x: <y> .'
    );
  });

  it('concatenates turtle parts', () => {
    const result = mergeOntologyExports(
      [':A a owl:Class .', ':B a owl:Class .'],
      'turtle'
    );

    expect(result).toContain(':A a owl:Class .');
    expect(result).toContain(':B a owl:Class .');
  });

  it('merges json-ld parts into a single @graph while preserving @context', () => {
    const first = JSON.stringify({
      '@context': { om: 'urn:om:' },
      '@graph': [{ id: 'A' }],
    });
    const second = JSON.stringify({
      '@context': { om: 'urn:om:' },
      '@graph': [{ id: 'B' }],
    });

    const merged = JSON.parse(mergeOntologyExports([first, second], 'jsonld'));

    expect(merged['@graph']).toHaveLength(2);
    expect(merged['@context']).toEqual({ om: 'urn:om:' });
  });

  it('folds bare json-ld nodes into the @graph', () => {
    const first = JSON.stringify({ '@context': { om: 'urn:om:' }, id: 'A' });
    const second = JSON.stringify({ '@context': { om: 'urn:om:' }, id: 'B' });

    const merged = JSON.parse(mergeOntologyExports([first, second], 'jsonld'));

    expect(merged['@graph']).toHaveLength(2);
    expect(merged['@graph'][0]['@context']).toBeUndefined();
  });

  it('merges rdf/xml documents under one root element', () => {
    const first = '<rdf:RDF xmlns:rdf="r"><owl:Class rdf:about="A"/></rdf:RDF>';
    const second =
      '<rdf:RDF xmlns:rdf="r"><owl:Class rdf:about="B"/></rdf:RDF>';

    const merged = mergeOntologyExports([first, second], 'rdfxml');

    expect(merged.match(/<rdf:RDF/g)).toHaveLength(1);
    expect(merged.match(/<\/rdf:RDF>/g)).toHaveLength(1);
    expect(merged).toContain('rdf:about="A"');
    expect(merged).toContain('rdf:about="B"');
  });
});
