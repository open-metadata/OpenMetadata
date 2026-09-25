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
import { CustomProperty } from '../../../../generated/type/customProperty';
import {
  filterAndSortProperties,
  getPropertyItemCount,
  getPropertyTypeMeta,
  isPropertyValueEmpty,
} from './CustomPropertyCard.utils';

const createProperty = (
  name: string,
  typeName: string,
  overrides: Partial<CustomProperty> = {}
): CustomProperty => ({
  name,
  description: '',
  propertyType: { id: `${typeName}-id`, name: typeName, type: 'type' },
  ...overrides,
});

describe('CustomPropertyCard.utils', () => {
  describe('isPropertyValueEmpty', () => {
    it.each([undefined, null, '', [], {}])(
      'treats %p as empty for a string property',
      (value) => {
        expect(isPropertyValueEmpty('string', value)).toBe(true);
      }
    );

    it('keeps zero as a value', () => {
      expect(isPropertyValueEmpty('integer', 0)).toBe(false);
    });

    it('treats a table without rows as empty', () => {
      expect(
        isPropertyValueEmpty('table-cp', { columns: ['a'], rows: [] })
      ).toBe(true);
      expect(
        isPropertyValueEmpty('table-cp', { columns: ['a'], rows: [{ a: '1' }] })
      ).toBe(false);
    });

    it('treats a hyperlink without a url as empty', () => {
      expect(isPropertyValueEmpty('hyperlink-cp', { displayText: 'x' })).toBe(
        true
      );
      expect(
        isPropertyValueEmpty('hyperlink-cp', { url: 'https://example.com' })
      ).toBe(false);
    });
  });

  describe('getPropertyItemCount', () => {
    it('counts entity reference list items', () => {
      expect(
        getPropertyItemCount('entityReferenceList', [
          { id: '1', type: 'table' },
          { id: '2', type: 'table' },
        ])
      ).toBe(2);
    });

    it('counts table rows', () => {
      expect(
        getPropertyItemCount('table-cp', {
          columns: ['a'],
          rows: [{ a: '1' }, { a: '2' }, { a: '3' }],
        })
      ).toBe(3);
    });

    it('returns undefined for scalar types', () => {
      expect(getPropertyItemCount('string', 'value')).toBeUndefined();
      expect(getPropertyItemCount('entityReferenceList', [])).toBeUndefined();
    });
  });

  describe('getPropertyTypeMeta', () => {
    it('marks block types as wide', () => {
      expect(getPropertyTypeMeta('markdown').isWide).toBe(true);
      expect(getPropertyTypeMeta('table-cp').isWide).toBe(true);
      expect(getPropertyTypeMeta('string').isWide).toBeFalsy();
    });

    it('falls back to the default meta for unknown types', () => {
      expect(getPropertyTypeMeta('unknown').labelKey).toBe('label.value');
    });
  });

  describe('filterAndSortProperties', () => {
    const properties = [
      createProperty('zeta', 'string', { displayName: 'Zeta Owner' }),
      createProperty('alpha', 'markdown', { description: 'Usage notes' }),
      createProperty('beta', 'enum'),
    ];

    it('sorts by display name, with full-width properties last', () => {
      expect(
        filterAndSortProperties(properties, {}, '', 'name').map((p) => p.name)
      ).toEqual(['beta', 'zeta', 'alpha']);
    });

    it('sorts by type, then by name', () => {
      expect(
        filterAndSortProperties(
          [...properties, createProperty('gamma', 'email')],
          {},
          '',
          'type'
        ).map((p) => p.name)
      ).toEqual(['gamma', 'beta', 'zeta', 'alpha']);
    });

    it('puts properties with a value first', () => {
      expect(
        filterAndSortProperties(properties, { zeta: 'x' }, '', 'value').map(
          (p) => p.name
        )
      ).toEqual(['zeta', 'beta', 'alpha']);
    });

    it('filters on name, display name and description, ignoring case', () => {
      expect(
        filterAndSortProperties(properties, {}, 'OWNER', 'name').map(
          (p) => p.name
        )
      ).toEqual(['zeta']);
      expect(
        filterAndSortProperties(properties, {}, 'usage', 'name').map(
          (p) => p.name
        )
      ).toEqual(['alpha']);
    });
  });
});
