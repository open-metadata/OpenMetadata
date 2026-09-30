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
import { TFunction } from 'i18next';
import { CustomProperty } from '../../../generated/type/customProperty';
import {
  getPropertyConfigSummary,
  getPropertyTypeBadge,
} from './CustomPropertyTable.utils';

const t = ((key: string) => key) as unknown as TFunction;

const buildProperty = (
  typeName: string,
  config?: NonNullable<CustomProperty['customPropertyConfig']>['config']
): CustomProperty => ({
  name: 'prop',
  description: '',
  propertyType: { id: typeName, type: 'type', name: typeName },
  ...(config === undefined ? {} : { customPropertyConfig: { config } }),
});

describe('getPropertyTypeBadge', () => {
  it('uses the design label and color for a known type', () => {
    expect(getPropertyTypeBadge(buildProperty('enum').propertyType, t)).toEqual(
      { color: 'purple', label: 'label.enum' }
    );
  });

  it('falls back to the reported type name for an unknown type', () => {
    expect(
      getPropertyTypeBadge(
        { id: '1', type: 'type', name: 'custom-cp', displayName: 'custom-cp' },
        t
      )
    ).toEqual({ color: 'gray', label: 'Custom' });
  });
});

describe('getPropertyConfigSummary', () => {
  it('returns nothing without a config', () => {
    expect(
      getPropertyConfigSummary(buildProperty('string'), t)
    ).toBeUndefined();
    expect(
      getPropertyConfigSummary(buildProperty('date-cp', ''), t)
    ).toBeUndefined();
    expect(
      getPropertyConfigSummary(buildProperty('entityReference', []), t)
    ).toBeUndefined();
    expect(
      getPropertyConfigSummary(buildProperty('enum', {}), t)
    ).toBeUndefined();
  });

  it('shows a date format as a single value', () => {
    expect(
      getPropertyConfigSummary(buildProperty('date-cp', 'yyyy-MM-dd'), t)
    ).toEqual({
      label: 'label.format',
      values: ['yyyy-MM-dd'],
      testId: 'prop-config',
    });
  });

  it('title-cases entity types', () => {
    expect(
      getPropertyConfigSummary(
        buildProperty('entityReferenceList', ['user', 'glossaryTerm']),
        t
      )
    ).toEqual({
      label: 'label.entity-types',
      values: ['User', 'Glossary Term'],
      testId: 'prop-config',
    });
  });

  it('lists table columns', () => {
    expect(
      getPropertyConfigSummary(
        buildProperty('table-cp', { columns: ['Id', 'Name'] }),
        t
      )
    ).toEqual({
      label: 'label.column-plural',
      values: ['Id', 'Name'],
      testId: 'table-config',
    });
  });

  it('labels enum values with their selection mode', () => {
    expect(
      getPropertyConfigSummary(
        buildProperty('enum', { values: ['A'], multiSelect: false }),
        t
      )?.label
    ).toBe('label.value-plural · label.single-select');
    expect(
      getPropertyConfigSummary(
        buildProperty('enum', { values: ['A'], multiSelect: true }),
        t
      )?.label
    ).toBe('label.value-plural · label.multi-select');
  });
});
