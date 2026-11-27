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
  getSuggestionReason,
  getSuggestionTerms,
} from './OntologyAssetSuggestion.utils';

describe('getSuggestionTerms', () => {
  it('splits the concept name into words and adds its synonyms', () => {
    expect(
      getSuggestionTerms('MedicationRecord', ['Rx', 'Prescription'])
    ).toEqual([
      { text: 'Medication', kind: 'name' },
      { text: 'Record', kind: 'name' },
      { text: 'Rx', kind: 'synonym' },
      { text: 'Prescription', kind: 'synonym' },
    ]);
  });

  it('drops words too short to match on and repeated terms', () => {
    expect(getSuggestionTerms('A of Visit', ['visit'])).toEqual([
      { text: 'Visit', kind: 'name' },
    ]);
  });
});

describe('getSuggestionReason', () => {
  const terms = getSuggestionTerms('Medication Record', ['Prescription']);

  it('names the term an asset name matches', () => {
    expect(getSuggestionReason({ name: 'medication_events' }, terms)).toEqual({
      kind: 'name',
      term: 'Medication',
    });
  });

  it('says a synonym matched when only a synonym did', () => {
    expect(getSuggestionReason({ name: 'prescriptions' }, terms)).toEqual({
      kind: 'synonym',
      term: 'Prescription',
    });
  });

  it('falls back to a column of the asset', () => {
    expect(
      getSuggestionReason(
        { name: 'events', columns: [{ name: 'id' }, { name: 'record_id' }] },
        terms
      )
    ).toEqual({ kind: 'column', term: 'Record', column: 'record_id' });
  });

  it('gives no reason to an asset that matches nothing', () => {
    expect(
      getSuggestionReason(
        { name: 'invoices', columns: [{ name: 'total' }] },
        terms
      )
    ).toBeUndefined();
  });
});
