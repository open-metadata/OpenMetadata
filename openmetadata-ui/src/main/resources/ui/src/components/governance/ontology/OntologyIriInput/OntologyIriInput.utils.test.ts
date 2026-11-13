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
  OPTION_SUPPORTING_TEXT_MAX,
  optionSupportingText,
  truncateMiddle,
} from './OntologyIriInput.utils';

describe('OntologyIriInput utils', () => {
  it('keeps short text as it is', () => {
    expect(truncateMiddle('urn:sales:Customer')).toBe('urn:sales:Customer');
  });

  it('keeps the start and the unique end of a long IRI within the limit', () => {
    const iri = 'urn:pw_perm_b4c3472d:03f803b6-3099-4f2a-9c1e-7d50000c20f8';
    const shown = truncateMiddle(iri);

    expect(shown).toHaveLength(OPTION_SUPPORTING_TEXT_MAX);
    expect(shown.startsWith('urn:pw_perm_b4c3')).toBe(true);
    expect(shown.endsWith('7d50000c20f8')).toBe(true);
    expect(shown).toContain('…');
  });

  it('shortens the ontology and IRI line of an option together', () => {
    const text = optionSupportingText({
      iri: 'urn:pw_perm_7d50000c:20f8a557-283c-4c0b-8f1e-26f050da4434',
      label: 'Customer',
      context: 'pw_perm_7d50000c',
    });

    expect(text.length).toBeLessThanOrEqual(OPTION_SUPPORTING_TEXT_MAX);
    expect(text.startsWith('pw_perm_7d50000c · urn')).toBe(true);
  });
});
