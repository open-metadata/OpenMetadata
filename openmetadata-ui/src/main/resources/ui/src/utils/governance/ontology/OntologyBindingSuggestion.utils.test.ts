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
  suggestColumnForProperty,
  suggestPropertyForColumn,
} from './OntologyBindingSuggestion.utils';

const column = (name: string) => ({ id: JSON.stringify([name]) });
const columns = [
  column('medication_id'),
  column('patient_name'),
  column('dosage'),
  column('dosage_unit'),
  column('created_at'),
];

describe('suggestColumnForProperty', () => {
  it('prefers the column that carries the same words as the property', () => {
    expect(suggestColumnForProperty({ label: 'dosage' }, columns)?.id).toBe(
      '["dosage"]'
    );
    expect(
      suggestColumnForProperty({ label: 'patientName' }, columns)?.id
    ).toBe('["patient_name"]');
  });

  it('falls back to a column whose name holds the property name', () => {
    expect(suggestColumnForProperty({ label: 'unit' }, columns)?.id).toBe(
      '["dosage_unit"]'
    );
  });

  it('offers an id column for an identifier property', () => {
    expect(
      suggestColumnForProperty(
        { label: 'medicationKey', isIdentifier: true },
        columns
      )?.id
    ).toBe('["medication_id"]');
  });

  it('suggests nothing when no column resembles the property', () => {
    expect(
      suggestColumnForProperty({ label: 'prescriber' }, columns)
    ).toBeUndefined();
  });
});

describe('suggestPropertyForColumn', () => {
  const properties = [
    { id: 'p-id', label: 'Patient Key', isIdentifier: true },
    { id: 'p-dob', label: 'dateOfBirth' },
    { id: 'p-name', label: 'Patient Name' },
    { id: 'p-unit', label: 'unit' },
  ];

  it('maps a column to the property with the same words', () => {
    expect(suggestPropertyForColumn('date_of_birth', properties)?.id).toBe(
      'p-dob'
    );
    expect(suggestPropertyForColumn('PatientName', properties)?.id).toBe(
      'p-name'
    );
  });

  it('maps an id column to the identifier property', () => {
    expect(suggestPropertyForColumn('patient_id', properties)?.id).toBe('p-id');
  });

  it('maps a column whose name holds the property name', () => {
    expect(suggestPropertyForColumn('dosage_unit', properties)?.id).toBe(
      'p-unit'
    );
  });

  it('suggests nothing for an unmatched column', () => {
    expect(suggestPropertyForColumn('created_at', properties)).toBeUndefined();
  });

  it('does not offer an id column to a concept with no identifier property', () => {
    expect(
      suggestPropertyForColumn('row_id', [{ id: 'p-name', label: 'Name' }])
    ).toBeUndefined();
  });
});
