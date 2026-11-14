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
  suggestPropertiesForColumns,
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

describe('suggestPropertiesForColumns', () => {
  const properties = [
    { id: 'p-id', label: 'Patient Key', isIdentifier: true },
    { id: 'p-dob', label: 'dateOfBirth' },
    { id: 'p-name', label: 'Patient Name' },
    { id: 'p-unit', label: 'unit' },
  ];
  // Column name → property id, with ' (unticked)' when another column matches it better.
  const suggest = (names: string[], props: typeof properties = properties) =>
    Object.fromEntries(
      [...suggestPropertiesForColumns(names.map(column), props)].map(
        ([id, { property, isBest }]) => [
          JSON.parse(id)[0],
          isBest ? property.id : `${property.id} (unticked)`,
        ]
      )
    );

  it('maps each column to the property with the same words, or one its name holds', () => {
    expect(
      suggest(['date_of_birth', 'PatientName', 'dosage_unit', 'created_at'])
    ).toEqual({
      PatientName: 'p-name',
      date_of_birth: 'p-dob',
      dosage_unit: 'p-unit',
    });
  });

  it('maps an id column to a key-like identifier property', () => {
    expect(suggest(['patient_id'])).toEqual({ patient_id: 'p-id' });
  });

  it('does not offer an id column to a concept with no identifier property', () => {
    expect(suggest(['row_id'], [{ id: 'p-name', label: 'Name' }])).toEqual({});
  });

  it('does not offer an id column to an identifier not named like a key', () => {
    const email = [{ id: 'p-email', label: 'email', isIdentifier: true }];

    expect(suggest(['customer_id', 'customer_email'], email)).toEqual({
      customer_email: 'p-email',
    });
  });

  it('suggests every matching column but ticks only the best one for a property', () => {
    expect(suggest(['patient_id', 'patient_key'])).toEqual({
      patient_id: 'p-id (unticked)',
      patient_key: 'p-id',
    });
  });

  it('ticks the first of two equally good columns', () => {
    expect(
      suggest(['unit', 'unit'.toUpperCase()], [{ id: 'p-unit', label: 'unit' }])
    ).toEqual({ UNIT: 'p-unit (unticked)', unit: 'p-unit' });
  });
});
