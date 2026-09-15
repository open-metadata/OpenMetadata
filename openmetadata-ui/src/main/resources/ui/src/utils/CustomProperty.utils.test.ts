/*
 *  Copyright 2025 Collate.
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
import { DateTime, Settings } from 'luxon';
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_DATE_TIME_FORMAT,
  DEFAULT_TIME_FORMAT,
  ENTITY_REFERENCE_OPTIONS,
  SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING,
} from '../constants/CustomProperty.constants';
import { SearchIndex } from '../enums/search.enum';
import {
  CustomProperty,
  CustomPropertyConfig,
  EntityReference,
} from '../generated/entity/type';
import {
  filterPopulatedTableRows,
  formatCustomPropertyDateTime,
  formatTableCellValue,
  getCustomPropertyDateTimeDefaultFormat,
  getCustomPropertyEntityPathname,
  getCustomPropertyLuxonFormat,
  getCustomPropertyMomentFormat,
  getCustomPropertyReferenceSearchIndex,
  getCustomPropertyTypeDisplayName,
  getHyperlinkUrlValidationErrorKey,
  hasPopulatedTableRows,
  parseCustomPropertyDateTime,
  serializeExtensionValue,
} from './CustomProperty.utils';

describe('CustomProperty.utils', () => {
  const createCustomProperty = (
    propertyType: string,
    config?: CustomPropertyConfig['config']
  ): CustomProperty => ({
    name: `${propertyType}Property`,
    description: `${propertyType} property`,
    propertyType: {
      id: `${propertyType}-id`,
      name: propertyType,
      type: 'type',
    },
    ...(config === undefined ? {} : { customPropertyConfig: { config } }),
  });

  it('getCustomPropertyEntityPathname should return entityPath[0] if entityPath is found', () => {
    const expectedPath = 'glossaryTerm';
    const entityType = 'glossaryTerm';

    expect(getCustomPropertyEntityPathname(entityType)).toEqual(expectedPath);
  });

  it('getCustomPropertyEntityPathname should return empty string if entityPath is not found', () => {
    const entityType = 'randomEntity';

    expect(getCustomPropertyEntityPathname(entityType)).toEqual('');
  });

  it('getCustomPropertyEntityPathname should return empty string if entityType is empty', () => {
    const entityType = 'glossary';

    expect(getCustomPropertyEntityPathname(entityType)).toEqual('glossaries');
  });

  describe('getCustomPropertyDateTimeDefaultFormat', () => {
    it('should return DEFAULT_DATE_FORMAT for date-cp type', () => {
      const type = 'date-cp';

      const result = getCustomPropertyDateTimeDefaultFormat(type);

      expect(result).toBe(DEFAULT_DATE_FORMAT);
    });

    it('should return DEFAULT_DATE_TIME_FORMAT for dateTime-cp type', () => {
      const type = 'dateTime-cp';

      const result = getCustomPropertyDateTimeDefaultFormat(type);

      expect(result).toBe(DEFAULT_DATE_TIME_FORMAT);
    });

    it('should return DEFAULT_TIME_FORMAT for time-cp type', () => {
      const type = 'time-cp';

      const result = getCustomPropertyDateTimeDefaultFormat(type);

      expect(result).toBe(DEFAULT_TIME_FORMAT);
    });

    it('should return empty string for unknown type', () => {
      const type = 'unknown-type';

      const result = getCustomPropertyDateTimeDefaultFormat(type);

      expect(result).toBe('');
    });

    it('should return empty string for empty type', () => {
      const type = '';

      const result = getCustomPropertyDateTimeDefaultFormat(type);

      expect(result).toBe('');
    });
  });

  describe('custom property date-time formatting', () => {
    it('maps the backend microsecond pattern to a Luxon-compatible parser', () => {
      expect(
        getCustomPropertyLuxonFormat(
          'dateTime-cp',
          'yyyy-MM-dd HH:mm:ss.SSSSSS'
        )
      ).toBe('yyyy-MM-dd HH:mm:ss.u');
    });

    it('serializes the backend microsecond pattern with exactly six digits', () => {
      const value = DateTime.fromObject({
        year: 2026,
        month: 7,
        day: 28,
        hour: 14,
        minute: 30,
        second: 15,
        millisecond: 123,
      });

      expect(
        formatCustomPropertyDateTime(
          value,
          'dateTime-cp',
          'yyyy-MM-dd HH:mm:ss.SSSSSS'
        )
      ).toBe('2026-07-28 14:30:15.123000');
    });

    it('leaves other supported formats unchanged', () => {
      const value = DateTime.fromISO('2026-07-28T14:30:15');

      expect(
        formatCustomPropertyDateTime(
          value,
          'dateTime-cp',
          'dd-MM-yyyy HH:mm:ss'
        )
      ).toBe('28-07-2026 14:30:15');
    });

    it('uses English month names regardless of the browser locale', () => {
      const originalLocale = Settings.defaultLocale;
      Settings.defaultLocale = 'fr';

      try {
        const value = DateTime.fromObject({
          year: 2026,
          month: 7,
          day: 28,
        });
        const formatted = formatCustomPropertyDateTime(
          value,
          'date-cp',
          'd MMMM yyyy'
        );
        const parsed = parseCustomPropertyDateTime(
          formatted,
          'date-cp',
          'd MMMM yyyy'
        );

        expect(formatted).toBe('28 July 2026');
        expect(parsed.isValid).toBe(true);
        expect(parsed.toISODate()).toBe('2026-07-28');
      } finally {
        Settings.defaultLocale = originalLocale;
      }
    });
  });

  describe('getCustomPropertyMomentFormat', () => {
    it('should return mapped format for valid date-cp type and backend format', () => {
      const type = 'date-cp';
      const backendFormat = 'MM/dd/yyyy';
      const expectedFormat =
        SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[backendFormat];

      const result = getCustomPropertyMomentFormat(type, backendFormat);

      expect(result).toBe(expectedFormat);
    });

    it('should return mapped format for valid dateTime-cp type and backend format', () => {
      const type = 'dateTime-cp';
      const backendFormat = 'yyyy-MM-dd HH:mm:ss';
      const expectedFormat =
        SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[backendFormat];

      const result = getCustomPropertyMomentFormat(type, backendFormat);

      expect(result).toBe(expectedFormat);
    });

    it('should return mapped format for valid time-cp type and backend format', () => {
      const type = 'time-cp';
      const backendFormat = 'HH:mm:ss';
      const expectedFormat =
        SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[backendFormat];

      const result = getCustomPropertyMomentFormat(type, backendFormat);

      expect(result).toBe(expectedFormat);
    });

    it('should fallback to default format when backend format is undefined', () => {
      const type = 'date-cp';
      const backendFormat = undefined;

      const result = getCustomPropertyMomentFormat(type, backendFormat);

      const expectedFormat =
        SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[DEFAULT_DATE_FORMAT];

      expect(result).toBe(expectedFormat);
    });

    it('should fallback to default format when backend format is not supported', () => {
      const type = 'date-cp';
      const backendFormat = 'INVALID-FORMAT';

      const result = getCustomPropertyMomentFormat(type, backendFormat);

      const expectedFormat =
        SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[DEFAULT_DATE_FORMAT];

      expect(result).toBe(expectedFormat);
    });

    it('should handle empty type with valid backend format', () => {
      const type = '';
      const backendFormat = 'yyyy-MM-dd';

      const result = getCustomPropertyMomentFormat(type, backendFormat);

      const expectedFormat =
        SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[backendFormat];

      expect(result).toBe(expectedFormat);
    });

    it('should handle both empty type and undefined backend format', () => {
      const type = '';
      const backendFormat = undefined;

      const result = getCustomPropertyMomentFormat(type, backendFormat);

      const expectedFormat =
        SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING[
          '' as keyof typeof SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING
        ];

      expect(result).toBe(expectedFormat);
    });
  });

  describe('Entity Reference Options', () => {
    it('should have correct structure for metric option', () => {
      const metricOption = ENTITY_REFERENCE_OPTIONS.find(
        (option) => option.key === 'metric'
      );

      expect(metricOption).toMatchObject({
        key: 'metric',
        value: 'metric',
        label: 'Metric',
      });
    });

    it('should have all expected entity types including metric', () => {
      const expectedEntityTypes = [
        'table',
        'storedProcedure',
        'databaseSchema',
        'database',
        'dashboard',
        'dashboardDataModel',
        'pipeline',
        'topic',
        'container',
        'searchIndex',
        'mlmodel',
        'glossaryTerm',
        'tag',
        'user',
        'team',
        'metric',
      ];

      const actualEntityTypes = ENTITY_REFERENCE_OPTIONS.map(
        (option) => option.key
      );

      expectedEntityTypes.forEach((entityType) => {
        expect(actualEntityTypes).toContain(entityType);
      });
    });
  });

  describe('getCustomPropertyReferenceSearchIndex', () => {
    const emptyConfigs: CustomPropertyConfig['config'][] = [
      undefined,
      [],
      '',
      '   ',
      { values: ['not-an-entity-index'] },
    ];

    it('joins every configured entity index', () => {
      const property = createCustomProperty('entityReference', [
        SearchIndex.GLOSSARY_TERM,
        SearchIndex.TABLE,
      ]);

      expect(getCustomPropertyReferenceSearchIndex(property)).toBe(
        `${SearchIndex.GLOSSARY_TERM},${SearchIndex.TABLE}`
      );
    });

    it('returns a single string index', () => {
      const property = createCustomProperty(
        'entityReference',
        SearchIndex.GLOSSARY_TERM
      );

      expect(getCustomPropertyReferenceSearchIndex(property)).toBe(
        SearchIndex.GLOSSARY_TERM
      );
    });

    it.each(emptyConfigs)('falls back to ALL for config %p', (config) => {
      const property = createCustomProperty('entityReference', config);

      expect(getCustomPropertyReferenceSearchIndex(property)).toBe(
        SearchIndex.ALL
      );
    });
  });

  describe('getHyperlinkUrlValidationErrorKey', () => {
    it.each(['http://example.com', 'https://example.com/path'])(
      'accepts the HTTP(S) URL %s',
      (url) => {
        expect(getHyperlinkUrlValidationErrorKey(url)).toBeUndefined();
      }
    );

    it.each([undefined, ''])('lets required validation handle %p', (url) => {
      expect(getHyperlinkUrlValidationErrorKey(url)).toBeUndefined();
    });

    it('rejects a URL that cannot be parsed', () => {
      expect(getHyperlinkUrlValidationErrorKey('example.com')).toBe(
        'message.invalid-url'
      );
    });

    it.each(['ftp://example.com', 'mailto:owner@example.com'])(
      'rejects the non-HTTP(S) URL %s',
      (url) => {
        expect(getHyperlinkUrlValidationErrorKey(url)).toBe(
          'message.url-must-use-http-or-https'
        );
      }
    );
  });

  describe('serializeExtensionValue', () => {
    it.each([
      ['string', 'plain text'],
      ['markdown', '**formatted**'],
      ['date-cp', '2026-07-28'],
      ['dateTime-cp', '2026-07-28 14:30:00'],
      ['time-cp', '14:30:00'],
      ['email', 'owner@example.com'],
      ['duration', 'PT30M'],
      ['sqlQuery', 'SELECT 1'],
    ])('passes through the %s string value', (propertyType, raw) => {
      expect(
        serializeExtensionValue(createCustomProperty(propertyType), raw)
      ).toBe(raw);
    });

    it.each([
      ['integer', '42', 42],
      ['number', '42.5', 42.5],
      ['timestamp', '1753738200000', 1753738200000],
    ])('coerces the %s value to a number', (propertyType, raw, expected) => {
      expect(
        serializeExtensionValue(createCustomProperty(propertyType), raw)
      ).toBe(expected);
    });

    it('preserves a numeric zero', () => {
      expect(serializeExtensionValue(createCustomProperty('integer'), 0)).toBe(
        0
      );
    });

    it.each(['integer', 'number', 'timestamp'])(
      'omits a non-numeric %s value instead of sending NaN',
      (propertyType) => {
        expect(
          serializeExtensionValue(createCustomProperty(propertyType), 'abc')
        ).toBeUndefined();
      }
    );

    it('omits a non-numeric time interval bound instead of sending NaN', () => {
      expect(
        serializeExtensionValue(createCustomProperty('timeInterval'), {
          start: 'abc',
          end: '1753741800000',
        })
      ).toEqual({ end: 1753741800000 });
    });

    it('omits a table value that has no populated rows', () => {
      const definition = createCustomProperty('table-cp', {
        columns: ['name'],
      });

      expect(
        serializeExtensionValue(definition, { columns: ['name'], rows: [] })
      ).toBeUndefined();
      expect(
        serializeExtensionValue(definition, {
          columns: ['name'],
          rows: [{ name: '' }],
        })
      ).toBeUndefined();
    });

    it('keeps a table value that has populated rows', () => {
      const tableValue = { columns: ['name'], rows: [{ name: 'orders' }] };

      expect(
        serializeExtensionValue(
          createCustomProperty('table-cp', { columns: ['name'] }),
          tableValue
        )
      ).toEqual(tableValue);
    });

    it('coerces populated time interval bounds and omits empty bounds', () => {
      const definition = createCustomProperty('timeInterval');

      expect(
        serializeExtensionValue(definition, {
          start: '1753738200000',
          end: '1753741800000',
        })
      ).toEqual({
        start: 1753738200000,
        end: 1753741800000,
      });
      expect(
        serializeExtensionValue(definition, {
          start: '1753738200000',
          end: '',
        })
      ).toEqual({ start: 1753738200000 });
      expect(
        serializeExtensionValue(definition, { start: '', end: '' })
      ).toBeUndefined();
    });

    it('wraps a single enum picker value in an array', () => {
      expect(
        serializeExtensionValue(createCustomProperty('enum'), {
          id: 'Gold',
          label: 'Gold',
          value: 'Gold',
        })
      ).toEqual(['Gold']);
    });

    it('unwraps and filters multiple enum picker values', () => {
      expect(
        serializeExtensionValue(createCustomProperty('enum'), [
          { id: 'Gold', label: 'Gold', value: 'Gold' },
          'Silver',
          { id: '', label: '', value: '' },
        ])
      ).toEqual(['Gold', 'Silver']);
    });

    it('returns undefined for an empty enum selection', () => {
      expect(
        serializeExtensionValue(createCustomProperty('enum'), {
          id: '',
          label: '',
          value: '',
        })
      ).toBeUndefined();
    });

    it('unwraps an entity reference picker value without changing its type', () => {
      const reference: EntityReference = {
        id: 'term-id',
        fullyQualifiedName: 'Business.Revenue',
        type: 'glossaryTerm',
      };

      expect(
        serializeExtensionValue(createCustomProperty('entityReference'), {
          id: reference.id,
          label: 'Revenue',
          value: reference,
        })
      ).toEqual(reference);
    });

    it('supports entity references from DataAssetAsyncSelectList', () => {
      const reference: EntityReference = {
        id: 'table-id',
        fullyQualifiedName: 'service.database.schema.table',
        type: 'table',
      };

      expect(
        serializeExtensionValue(createCustomProperty('entityReference'), {
          displayName: 'table',
          label: 'table',
          reference,
          value: reference.fullyQualifiedName,
        })
      ).toEqual(reference);
    });

    it('passes through a bare entity reference', () => {
      const reference: EntityReference = {
        id: 'user-id',
        name: 'owner',
        type: 'user',
      };

      expect(
        serializeExtensionValue(
          createCustomProperty('entityReference'),
          reference
        )
      ).toBe(reference);
    });

    it('unwraps an entity reference list and drops invalid items', () => {
      const glossaryTerm: EntityReference = {
        id: 'term-id',
        type: 'glossaryTerm',
      };
      const table: EntityReference = {
        id: 'table-id',
        type: 'table',
      };

      expect(
        serializeExtensionValue(createCustomProperty('entityReferenceList'), [
          { id: glossaryTerm.id, label: 'Term', value: glossaryTerm },
          { label: 'Table', reference: table, value: 'table-fqn' },
          { id: 'invalid', label: 'Invalid', value: 'invalid' },
        ])
      ).toEqual([glossaryTerm, table]);
    });

    it('returns undefined for an empty entity reference selection', () => {
      const definition = createCustomProperty('entityReferenceList');

      expect(serializeExtensionValue(definition, [])).toBeUndefined();
      expect(
        serializeExtensionValue(definition, [
          { id: 'invalid', label: 'Invalid', value: '' },
        ])
      ).toBeUndefined();
    });

    it('serializes a hyperlink to its exact backend shape', () => {
      expect(
        serializeExtensionValue(createCustomProperty('hyperlink-cp'), {
          url: 'https://example.com',
          displayText: 'Example',
          ignored: 'not allowed by the backend',
        })
      ).toEqual({
        url: 'https://example.com',
        displayText: 'Example',
      });
    });

    it('omits an empty hyperlink display text', () => {
      expect(
        serializeExtensionValue(createCustomProperty('hyperlink-cp'), {
          url: 'https://example.com',
          displayText: '',
        })
      ).toEqual({ url: 'https://example.com' });
    });

    it('returns undefined for a hyperlink without a URL', () => {
      expect(
        serializeExtensionValue(createCustomProperty('hyperlink-cp'), {
          url: '',
          displayText: 'Example',
        })
      ).toBeUndefined();
    });

    it('passes through a table value', () => {
      const tableValue = {
        columns: ['name', 'description'],
        rows: [{ name: 'Revenue', description: 'Gross revenue' }],
      };

      expect(
        serializeExtensionValue(createCustomProperty('table-cp'), tableValue)
      ).toBe(tableValue);
    });

    it('passes through values for an unknown property type', () => {
      const raw = { supportedByFutureVersion: true };

      expect(
        serializeExtensionValue(createCustomProperty('future-type'), raw)
      ).toBe(raw);
    });

    it.each([undefined, null, '', [], {}])(
      'drops the empty value %p',
      (raw) => {
        expect(
          serializeExtensionValue(createCustomProperty('string'), raw)
        ).toBeUndefined();
      }
    );

    it.each([false, 0])('preserves the non-empty scalar %p', (raw) => {
      expect(
        serializeExtensionValue(createCustomProperty('future-type'), raw)
      ).toBe(raw);
    });
  });

  it('keeps a populated table column named id', () => {
    expect(
      filterPopulatedTableRows([{ id: 'business-id' }, { id: '' }])
    ).toEqual([{ id: 'business-id' }]);
  });

  describe('hasPopulatedTableRows', () => {
    it('accepts a table value with at least one populated row', () => {
      expect(
        hasPopulatedTableRows({
          columns: ['name'],
          rows: [{ name: '' }, { name: 'orders' }],
        })
      ).toBe(true);
    });

    it.each([
      ['a table value with only empty rows', { rows: [{ name: '' }, {}] }],
      ['a table value with no rows', { rows: [] }],
      ['a value without a rows array', { columns: ['name'] }],
      ['a non-object value', 'rows'],
      ['undefined', undefined],
    ])('rejects %s', (_, value) => {
      expect(hasPopulatedTableRows(value)).toBe(false);
    });
  });

  describe('getCustomPropertyTypeDisplayName', () => {
    it.each([
      ['hyperlink-cp', 'HYPERLINK'],
      ['date-cp', 'DATE'],
      ['dateTime-cp', 'DATETIME'],
      ['time-cp', 'TIME'],
      ['table-cp', 'TABLE'],
      ['entityReference', 'ENTITYREFERENCE'],
      ['entityReferenceList', 'ENTITYREFERENCELIST'],
      ['string', 'STRING'],
      ['sqlQuery', 'SQLQUERY'],
    ])('formats %s as %s', (propertyTypeName, expected) => {
      expect(getCustomPropertyTypeDisplayName(propertyTypeName)).toBe(expected);
    });

    it.each([undefined, ''])('returns an empty string for %p', (value) => {
      expect(getCustomPropertyTypeDisplayName(value)).toBe('');
    });
  });

  describe('formatTableCellValue', () => {
    it('should return "-" for null value', () => {
      const result = formatTableCellValue(null);

      expect(result).toBe('-');
    });

    it('should return "-" for undefined value', () => {
      const result = formatTableCellValue(undefined);

      expect(result).toBe('-');
    });

    it('should convert string value to string', () => {
      const result = formatTableCellValue('test value');

      expect(result).toBe('test value');
    });

    it('should convert number value to string', () => {
      const result = formatTableCellValue(123);

      expect(result).toBe('123');
    });

    it('should convert boolean value to string', () => {
      expect(formatTableCellValue(true)).toBe('true');
      expect(formatTableCellValue(false)).toBe('false');
    });

    it('should join array elements with ", "', () => {
      const result = formatTableCellValue(['value1', 'value2', 'value3']);

      expect(result).toBe('value1, value2, value3');
    });

    it('should handle empty array', () => {
      const result = formatTableCellValue([]);

      expect(result).toBe('');
    });

    it('should return name property for object with name', () => {
      const result = formatTableCellValue({ name: 'TestName', id: '123' });

      expect(result).toBe('TestName');
    });

    it('should return displayName property for object with displayName', () => {
      const result = formatTableCellValue({
        displayName: 'Test Display Name',
        id: '123',
      });

      expect(result).toBe('Test Display Name');
    });

    it('should prefer name over displayName when both exist', () => {
      const result = formatTableCellValue({
        name: 'Name',
        displayName: 'Display Name',
      });

      expect(result).toBe('Name');
    });

    it('should return value property for object with value', () => {
      const result = formatTableCellValue({ value: 'test value' });

      expect(result).toBe('test value');
    });

    it('should handle object with value being a number', () => {
      const result = formatTableCellValue({ value: 42 });

      expect(result).toBe('42');
    });

    it('should return JSON string for object without name, displayName, or value', () => {
      const obj = { key: 'test', data: 'value' };
      const result = formatTableCellValue(obj);

      expect(result).toBe(JSON.stringify(obj));
    });

    it('should handle nested objects', () => {
      const obj = { nested: { key: 'value' }, count: 5 };
      const result = formatTableCellValue(obj);

      expect(result).toBe(JSON.stringify(obj));
    });

    it('should handle empty object', () => {
      const result = formatTableCellValue({});

      expect(result).toBe(JSON.stringify({}));
    });

    it('should handle array with mixed types', () => {
      const result = formatTableCellValue([1, 'string', true]);

      expect(result).toBe('1, string, true');
    });

    it('should convert zero to string', () => {
      const result = formatTableCellValue(0);

      expect(result).toBe('0');
    });

    it('should convert empty string to empty string', () => {
      const result = formatTableCellValue('');

      expect(result).toBe('');
    });

    it('should handle object with value being null', () => {
      const result = formatTableCellValue({ value: null });

      expect(result).toBe('null');
    });

    it('should handle object with value being undefined', () => {
      const result = formatTableCellValue({ value: undefined });

      expect(result).toBe('{}');
    });
  });
});
