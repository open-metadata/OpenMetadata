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

import { RDFTerm, Type } from '../../generated/api/rdf/sparqlResponse';
import {
  getTermDisplayText,
  getTermLexicalValue,
  isTripleTerm,
} from './SparqlTerm.utils';

const uri = (value: string): RDFTerm => ({ type: Type.URI, value });

describe('SparqlTerm.utils', () => {
  it('renders simple terms as their bare value', () => {
    expect(getTermDisplayText(uri('https://example.com/s'))).toBe(
      'https://example.com/s'
    );
    expect(getTermDisplayText({ type: Type.Literal, value: 'orders' })).toBe(
      'orders'
    );
    expect(getTermDisplayText({ type: Type.Bnode, value: 'b0' })).toBe('b0');
  });

  it('leaves language and datatype off top-level literals', () => {
    expect(
      getTermDisplayText({
        type: Type.Literal,
        value: 'cat',
        'xml:lang': 'en',
      })
    ).toBe('cat');
    expect(
      getTermDisplayText({
        datatype: 'http://www.w3.org/2001/XMLSchema#integer',
        type: Type.Literal,
        value: '7',
      })
    ).toBe('7');
  });

  it('renders a triple term in RDF 1.2 syntax instead of an object', () => {
    const term: RDFTerm = {
      type: Type.Triple,
      value: {
        object: {
          'its:dir': 'rtl',
          type: Type.Literal,
          value: 'قطة',
          'xml:lang': 'ar',
        },
        predicate: uri('urn:p'),
        subject: uri('urn:s'),
      },
    } as RDFTerm;

    expect(getTermDisplayText(term)).toBe(
      '<<( <urn:s> <urn:p> "قطة"@ar--rtl )>>'
    );
  });

  it('renders nested triple terms, typed literals, and escapes quotes', () => {
    const term: RDFTerm = {
      type: Type.Triple,
      value: {
        object: { type: Type.Literal, value: 'say "hi"' },
        predicate: uri('urn:q'),
        subject: {
          type: Type.Triple,
          value: {
            object: { datatype: 'urn:int', type: Type.Literal, value: '7' },
            predicate: uri('urn:p'),
            subject: { type: Type.Bnode, value: 'b0' },
          },
        },
      },
    } as RDFTerm;

    expect(getTermDisplayText(term)).toBe(
      '<<( <<( _:b0 <urn:p> "7"^^<urn:int> )>> <urn:q> "say \\"hi\\"" )>>'
    );
  });

  it('reports an empty string for a missing term', () => {
    expect(getTermDisplayText(undefined)).toBe('');
    expect(getTermLexicalValue(undefined)).toBe('');
  });

  it('identifies triple terms', () => {
    expect(isTripleTerm({ type: Type.Triple, value: {} } as RDFTerm)).toBe(
      true
    );
    expect(isTripleTerm(uri('urn:s'))).toBe(false);
  });

  it('reports no lexical value for a triple term', () => {
    expect(
      getTermLexicalValue({ type: Type.Triple, value: {} } as RDFTerm)
    ).toBe('');
  });
});
