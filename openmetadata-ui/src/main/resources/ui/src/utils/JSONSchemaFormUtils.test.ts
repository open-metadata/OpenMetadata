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
  formatAdditionalProperties,
  formatFormDataForSubmit,
} from './JSONSchemaFormUtils';

describe('formatFormDataForSubmit', () => {
  it('drops map rows that were added but never filled in', () => {
    expect(
      formatFormDataForSubmit({
        connectionOptions: { newKey: 'New Value', sslmode: 'require' },
        connectionArguments: { 'newKey-1': 'New Value' },
      })
    ).toEqual({
      connectionOptions: { sslmode: 'require' },
      connectionArguments: {},
    });
  });

  it('keeps a row whose key or value the user changed', () => {
    expect(
      formatFormDataForSubmit({
        connectionOptions: { newKey: 'verify-full', sslmode: 'New Value' },
      })
    ).toEqual({
      connectionOptions: { newKey: 'verify-full', sslmode: 'New Value' },
    });
  });

  it('drops object-valued ownerConfig map rows that RJSF seeded with {}', () => {
    expect(
      formatFormDataForSubmit({
        ownerConfig: {
          enableInheritance: true,
          database: { newKey: {} },
        },
      })
    ).toEqual({
      ownerConfig: {
        enableInheritance: true,
        database: {},
      },
    });
  });
});

describe('formatAdditionalProperties', () => {
  it('drops a newKey whose value is an empty object (type-less anyOf default)', () => {
    expect(formatAdditionalProperties({ newKey: {} })).toEqual({});
  });

  it('drops a newKey-N whose value is an empty array (array-valued map default)', () => {
    expect(formatAdditionalProperties({ 'newKey-2': [] })).toEqual({});
  });

  it('keeps a filled object-valued map row', () => {
    expect(
      formatAdditionalProperties({
        ownerConfig: {
          database: { newKey: { sales_db: 'sales-team' } },
        },
      })
    ).toEqual({
      ownerConfig: {
        database: { newKey: { sales_db: 'sales-team' } },
      },
    });
  });

  it('keeps a filled array-valued map row', () => {
    expect(formatAdditionalProperties({ newKey: ['alice', 'bob'] })).toEqual({
      newKey: ['alice', 'bob'],
    });
  });

  it('drops the string default from string-valued maps (string branch)', () => {
    expect(
      formatAdditionalProperties({ newKey: 'New Value', sslmode: 'require' })
    ).toEqual({ sslmode: 'require' });
  });

  it('keeps a string row the user edited away from the default', () => {
    expect(formatAdditionalProperties({ newKey: 'verify-full' })).toEqual({
      newKey: 'verify-full',
    });
  });

  it('drops untouched rows recursively at any depth', () => {
    expect(
      formatAdditionalProperties({ a: { newKey: {} }, k: 'New Value' })
    ).toEqual({ a: {}, k: 'New Value' });
  });

  it('preserves legitimate empty values that are not newKey rows', () => {
    expect(
      formatAdditionalProperties({ sslmode: '', count: 0, flag: false })
    ).toEqual({ sslmode: '', count: 0, flag: false });
  });

  it('does not treat null as an empty object to drop', () => {
    expect(formatAdditionalProperties({ newKey: null })).toEqual({
      newKey: null,
    });
  });
});
