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
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_DATE_TIME_FORMAT,
  DEFAULT_TIME_FORMAT,
  ENTITY_REFERENCE_OPTIONS,
  SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING,
} from '../constants/CustomProperty.constants';
import {
  formatTableCellValue,
  getCustomPropertyDateTimeDefaultFormat,
  getCustomPropertyEntityPathname,
  getCustomPropertyMomentFormat,
} from './CustomProperty.utils';

describe('CustomProperty.utils', () => {
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
