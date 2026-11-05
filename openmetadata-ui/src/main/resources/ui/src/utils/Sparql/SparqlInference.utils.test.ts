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
  getAvailableSparqlInferences,
  resolveSparqlInference,
} from './SparqlInference.utils';

describe('getAvailableSparqlInferences', () => {
  it('always offers queries without inference', () => {
    expect(getAvailableSparqlInferences()).toEqual(['none']);
    expect(getAvailableSparqlInferences([])).toEqual(['none']);
  });

  it('offers custom inference when the server materializes rules', () => {
    expect(getAvailableSparqlInferences(['NONE', 'CUSTOM'])).toEqual([
      'none',
      'custom',
    ]);
  });

  it('maps both OWL reasoning levels to the single owl option', () => {
    expect(getAvailableSparqlInferences(['OWL_LITE', 'OWL_DL'])).toEqual([
      'none',
      'owl',
    ]);
  });

  it('ignores levels the playground cannot request', () => {
    expect(getAvailableSparqlInferences(['NONE', 'UNKNOWN'])).toEqual(['none']);
  });
});

describe('resolveSparqlInference', () => {
  it('keeps a level the server offers', () => {
    expect(resolveSparqlInference('custom', ['none', 'custom'])).toBe('custom');
  });

  it('falls back to no inference for a level the server no longer offers', () => {
    expect(resolveSparqlInference('rdfs', ['none', 'custom'])).toBe('none');
    expect(resolveSparqlInference('owl', ['none'])).toBe('none');
    expect(resolveSparqlInference('custom', ['none'])).toBe('none');
  });
});
