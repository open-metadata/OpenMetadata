/*
 *  Copyright 2024 Collate.
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
import { CSMode } from '../../enums/codemirror.enum';
import {
  Language,
  UnitOfMeasurement,
} from '../../generated/entity/data/metric';
import {
  getMetricExpressionLanguageName,
  getSortedOptions,
} from './MetricUtils';

describe('getSortedOptions', () => {
  it('should sort options by granularity order if valueKey is granularity', () => {
    const options = [
      { label: 'Second', value: 'second', key: '1' },
      { label: 'Minute', value: 'minute', key: '2' },
      { label: 'Hour', value: 'hour', key: '3' },
      { label: 'Day', value: 'day', key: '4' },
      { label: 'Week', value: 'week', key: '5' },
      { label: 'Month', value: 'month', key: '6' },
      { label: 'Quarter', value: 'quarter', key: '7' },
      { label: 'Year', value: 'year', key: '8' },
    ];
    const value = 'day';
    const valueKey = 'granularity';

    const result = getSortedOptions(options, value, valueKey);

    expect(result).toEqual([
      { label: 'Day', value: 'day', key: '4' },
      { label: 'Second', value: 'second', key: '1' },
      { label: 'Minute', value: 'minute', key: '2' },
      { label: 'Hour', value: 'hour', key: '3' },
      { label: 'Week', value: 'week', key: '5' },
      { label: 'Month', value: 'month', key: '6' },
      { label: 'Quarter', value: 'quarter', key: '7' },
      { label: 'Year', value: 'year', key: '8' },
    ]);
  });

  it('should sort options by default order if valueKey is not granularity', () => {
    const options = Object.values(UnitOfMeasurement).map(
      (unitOfMeasurement) => ({
        key: unitOfMeasurement,
        label: unitOfMeasurement,
        value: unitOfMeasurement,
      })
    );
    const value = 'SIZE';
    const valueKey = 'unitOfMeasurement';

    const result = getSortedOptions(options, value, valueKey);

    expect(result).toEqual([
      { key: 'SIZE', label: 'SIZE', value: 'SIZE' },
      { key: 'COUNT', label: 'COUNT', value: 'COUNT' },
      { key: 'DOLLARS', label: 'DOLLARS', value: 'DOLLARS' },
      { key: 'EVENTS', label: 'EVENTS', value: 'EVENTS' },
      { key: 'PERCENTAGE', label: 'PERCENTAGE', value: 'PERCENTAGE' },
      { key: 'REQUESTS', label: 'REQUESTS', value: 'REQUESTS' },
      { key: 'TIMESTAMP', label: 'TIMESTAMP', value: 'TIMESTAMP' },
      { key: 'TRANSACTIONS', label: 'TRANSACTIONS', value: 'TRANSACTIONS' },
    ]);
  });
});

describe('getMetricExpressionLanguageName', () => {
  it('should return SQL if language is not provided', () => {
    const result = getMetricExpressionLanguageName();

    expect(result).toBe(CSMode.SQL);

    const result2 = getMetricExpressionLanguageName(undefined);

    expect(result2).toBe(CSMode.SQL);

    const result3 = getMetricExpressionLanguageName('' as Language);

    expect(result3).toBe(CSMode.SQL);
  });

  it('should return CLIKE if language is Java', () => {
    const result = getMetricExpressionLanguageName(Language.Java);

    expect(result).toBe(CSMode.CLIKE);
  });

  it('should return language in lowercase if language is provided', () => {
    const result = getMetricExpressionLanguageName(Language.Python);

    expect(result).toBe('python');
  });
});
