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
  SUPPORTED_DATE_TIME_FORMATS_ANTD_FORMAT_MAPPING,
} from '../constants/CustomProperty.constants';
import {
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
});
