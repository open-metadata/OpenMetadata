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
  buildCsv,
  buildTsv,
  describeTimeAgo,
  toCsvFileName,
} from './OntologyQueryResults.utils';

const uri = (value: string): RDFTerm => ({ type: Type.URI, value });
const literal = (value: string): RDFTerm => ({ type: Type.Literal, value });

describe('buildCsv', () => {
  it('writes the variable names as the header and one line per row', () => {
    const csv = buildCsv(
      ['c', 'label'],
      [
        { c: uri('urn:a'), label: literal('Alpha') },
        { c: uri('urn:b'), label: literal('Beta') },
      ]
    );

    expect(csv).toBe('c,label\nurn:a,Alpha\nurn:b,Beta');
  });

  it('quotes cells with commas, quotes and line breaks, and doubles inner quotes', () => {
    const csv = buildCsv(
      ['label'],
      [
        { label: literal('Smith, John') },
        { label: literal('say "hi"') },
        { label: literal('two\nlines') },
      ]
    );

    expect(csv).toBe('label\n"Smith, John"\n"say ""hi"""\n"two\nlines"');
  });

  it('leaves a variable that is unbound in a row empty', () => {
    expect(buildCsv(['a', 'b'], [{ a: uri('urn:a') }])).toBe('a,b\nurn:a,');
  });

  it('writes only the header for a query with no rows', () => {
    expect(buildCsv(['a', 'b'], [])).toBe('a,b');
  });
});

describe('buildTsv', () => {
  it('separates cells with tabs and flattens tabs and line breaks inside a cell', () => {
    const tsv = buildTsv(
      ['c', 'label'],
      [{ c: uri('urn:a'), label: literal('one\ttwo\nthree') }]
    );

    expect(tsv).toBe('c\tlabel\nurn:a\tone two three');
  });
});

describe('toCsvFileName', () => {
  it.each([
    ['All concepts', 'All-concepts.csv'],
    ['  Kinds of <Order>  ', 'Kinds-of-Order.csv'],
    ['', 'query-results.csv'],
    [undefined, 'query-results.csv'],
  ])('names %p as %p', (name, expected) => {
    expect(toCsvFileName(name)).toBe(expected);
  });
});

describe('describeTimeAgo', () => {
  it('says "just now" within the first minute, then a relative time', () => {
    const now = Date.now();

    expect(describeTimeAgo(now - 59_000, 'just now', now)).toBe('just now');
    expect(describeTimeAgo(now - 5 * 60_000, 'just now', now)).not.toBe(
      'just now'
    );
    expect(describeTimeAgo(now - 5 * 60_000, 'just now', now)).toMatch(
      /minutes ago/
    );
  });
});
