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

// Mock DateTimeUtils before any imports that might use it
jest.mock('../date-time/DateTimeUtils', () => ({
  formatMonth: jest.fn((timestamp) => {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return monthNames[new Date(timestamp).getMonth()];
  }),
  getCurrentMillis: jest.fn(() => 1640995200000),
  getEpochMillisForPastDays: jest.fn(
    (days) => 1640995200000 - days * 24 * 60 * 60 * 1000
  ),
  getStartOfDayInMillis: jest.fn().mockImplementation((val) => val),
  getEndOfDayInMillis: jest.fn().mockImplementation((val) => val),
}));

jest.mock('js-yaml', () => ({
  dump: jest.fn((data) => JSON.stringify(data)),
}));

jest.mock('../i18next/LocalUtil', () => ({
  __esModule: true,
  default: {
    t: jest.fn((key: string) => key),
  },
  t: jest.fn((key: string) => key),
  detectBrowserLanguage: jest.fn(() => 'en-US'),
}));

// Import after mocks are set up
import { DataContractProcessedResultCharts } from '../../components/DataContract/ContractExecutionChart/ContractExecutionChart.interface';
import { DataContract } from '../../generated/entity/data/dataContract';
import { DataContractResult } from '../../generated/entity/datacontract/dataContractResult';
import { ContractExecutionStatus } from '../../generated/type/contractExecutionStatus';
import {
  createContractExecutionCustomScale,
  downloadContractYamlFile,
  formatContractExecutionTick,
  generateMonthTickPositions,
  generateSelectOptionsFromString,
  getConstraintStatus,
  getContractStatusLabelBasedOnFailedResult,
  getContractStatusType,
  getDataContractStatusIcon,
  getUpdatedContractDetails,
  processContractExecutionData,
} from './DataContractUtils';

describe('DataContractUtils', () => {
  describe('processContractExecutionData', () => {
    it('should process execution data with unique identifiers', () => {
      const executionData = [
        {
          id: '1',
          timestamp: 1234567890000,
          contractExecutionStatus: ContractExecutionStatus.Success,
        },
        {
          id: '2',
          timestamp: 1234567890000,
          contractExecutionStatus: ContractExecutionStatus.Failed,
        },
        {
          id: '3',
          timestamp: 1234567891000,
          contractExecutionStatus: ContractExecutionStatus.Aborted,
        },
        {
          id: '4',
          timestamp: 1234567891000,
          contractExecutionStatus: ContractExecutionStatus.Running,
        },
      ];

      const result = processContractExecutionData(
        executionData as DataContractResult[]
      );

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        name: '1234567890000_0',
        displayTimestamp: 1234567890000,
        value: 1,
        status: ContractExecutionStatus.Success,
        failed: 0,
        success: 1,
        aborted: 0,
        running: 0,
        data: executionData[0],
      });
      expect(result[1]).toEqual({
        name: '1234567890000_1',
        displayTimestamp: 1234567890000,
        value: 1,
        status: ContractExecutionStatus.Failed,
        failed: 1,
        success: 0,
        aborted: 0,
        running: 0,
        data: executionData[1],
      });
      expect(result[2]).toEqual({
        name: '1234567891000_2',
        displayTimestamp: 1234567891000,
        value: 1,
        status: ContractExecutionStatus.Aborted,
        failed: 0,
        success: 0,
        aborted: 1,
        running: 0,
        data: executionData[2],
      });
      expect(result[3]).toEqual({
        name: '1234567891000_3',
        displayTimestamp: 1234567891000,
        value: 1,
        status: ContractExecutionStatus.Running,
        failed: 0,
        success: 0,
        aborted: 0,
        running: 1,
        data: executionData[3],
      });
    });

    it('should handle empty execution data', () => {
      const result = processContractExecutionData([]);

      expect(result).toEqual([]);
    });
  });

  describe('createContractExecutionCustomScale', () => {
    const mockData = [
      { name: '1234567890000_0', displayTimestamp: 1234567890000 },
      { name: '1234567890001_1', displayTimestamp: 1234567890001 },
      { name: '1234567890002_2', displayTimestamp: 1234567890002 },
    ];

    it('should create a scale function that maps values to positions', () => {
      const scale = createContractExecutionCustomScale(
        mockData as DataContractProcessedResultCharts[]
      );

      expect(scale('1234567890000_0')).toBe(0);
      expect(scale('1234567890001_1')).toBe(28); // 0 + 1 * (20 + 8)
      expect(scale('1234567890002_2')).toBe(56); // 0 + 2 * (20 + 8)
    });

    it('should return 0 for unknown values', () => {
      const scale = createContractExecutionCustomScale(
        mockData as DataContractProcessedResultCharts[]
      );

      expect(scale('unknown_value')).toBe(0);
    });

    it('should have chainable domain method', () => {
      const scale = createContractExecutionCustomScale(
        mockData as DataContractProcessedResultCharts[]
      );
      const result = scale.domain();

      expect(result).toEqual([
        '1234567890000_0',
        '1234567890001_1',
        '1234567890002_2',
      ]);

      const chained = scale.domain(['new_domain']);

      expect(chained).toBe(scale);
    });

    it('should have chainable range method', () => {
      const scale = createContractExecutionCustomScale(
        mockData as DataContractProcessedResultCharts[]
      );
      const result = scale.range();

      expect(result).toEqual([0, 800]);

      const chained = scale.range([0, 1000]);

      expect(chained).toBe(scale);
      expect(scale.range()).toEqual([0, 1000]);
    });

    it('should have other required scale methods', () => {
      const scale = createContractExecutionCustomScale(
        mockData as DataContractProcessedResultCharts[]
      );

      expect(scale.bandwidth()).toBe(20);
      expect(scale.ticks()).toEqual([]);
      expect(scale.tickFormat()).toBeDefined();
      expect(scale.copy()).toBeDefined();
      expect(scale.nice()).toBe(scale);
      expect(scale.type).toBe('band');
    });
  });

  describe('generateMonthTickPositions', () => {
    it('should generate unique month tick positions', () => {
      const processedData = [
        { name: '1640995200000_0', displayTimestamp: 1640995200000 }, // Jan 2022
        { name: '1640995260000_1', displayTimestamp: 1640995260000 }, // Same month
        { name: '1643673600000_2', displayTimestamp: 1643673600000 }, // Feb 2022
        { name: '1646092800000_3', displayTimestamp: 1646092800000 }, // Mar 2022
      ];

      const result = generateMonthTickPositions(
        processedData as DataContractProcessedResultCharts[]
      );

      expect(result).toEqual([
        '1640995200000_0', // First occurrence of Jan
        '1643673600000_2', // First occurrence of Feb
        '1646092800000_3', // First occurrence of Mar
      ]);
    });

    it('should handle empty data', () => {
      const result = generateMonthTickPositions([]);

      expect(result).toEqual([]);
    });

    it('should handle data with same month', () => {
      const processedData = [
        { name: '1640995200000_0', displayTimestamp: 1640995200000 },
        { name: '1640995260000_1', displayTimestamp: 1640995260000 },
        { name: '1640995320000_2', displayTimestamp: 1640995320000 },
      ];

      const result = generateMonthTickPositions(
        processedData as DataContractProcessedResultCharts[]
      );

      expect(result).toEqual(['1640995200000_0']); // Only first occurrence
    });
  });

  describe('formatContractExecutionTick', () => {
    it('should extract timestamp and format as month', () => {
      const result = formatContractExecutionTick('1640995200000_0');

      expect(result).toBe('Jan');
    });

    it('should handle different months', () => {
      expect(formatContractExecutionTick('1643673600000_0')).toBe('Feb');
      expect(formatContractExecutionTick('1646092800000_0')).toBe('Mar');
    });

    it('should handle invalid timestamp gracefully', () => {
      const result = formatContractExecutionTick('invalid_0');

      expect(result).toBeUndefined(); // formatMonth returns undefined for NaN
    });
  });

  describe('getContractStatusLabelBasedOnFailedResult', () => {
    it('should return passed when failed count is 0', () => {
      expect(getContractStatusLabelBasedOnFailedResult(0)).toBe('label.passed');
    });

    it('should return failed when failed count is greater than 0', () => {
      expect(getContractStatusLabelBasedOnFailedResult(1)).toBe('label.failed');
      expect(getContractStatusLabelBasedOnFailedResult(10)).toBe(
        'label.failed'
      );
    });

    it('should handle undefined gracefully', () => {
      expect(getContractStatusLabelBasedOnFailedResult(undefined)).toBe(
        'label.failed'
      );
    });
  });

  describe('getConstraintStatus', () => {
    it('should return status for all validations', () => {
      const latestContractResults = {
        schemaValidation: { failed: 0 },
        semanticsValidation: { failed: 1 },
        qualityValidation: { failed: 2 },
      };

      const result = getConstraintStatus(
        latestContractResults as DataContractResult
      );

      expect(result).toEqual({
        schema: 'label.passed',
        semantic: 'label.failed',
        quality: 'label.failed',
      });
    });

    it('should handle partial validations', () => {
      const latestContractResults = {
        schemaValidation: { failed: 0 },
      };

      const result = getConstraintStatus(
        latestContractResults as DataContractResult
      );

      expect(result).toEqual({
        schema: 'label.passed',
      });
    });

    it('should return empty object when no validations', () => {
      const latestContractResults = {};

      const result = getConstraintStatus(
        latestContractResults as DataContractResult
      );

      expect(result).toEqual({});
    });
  });

  describe('getContractStatusType', () => {
    it('should return correct status types', () => {
      expect(getContractStatusType('passed')).toBe('success');
      expect(getContractStatusType('success')).toBe('success');
      expect(getContractStatusType('failed')).toBe('failure');
      expect(getContractStatusType('issue')).toBe('warning');
      expect(getContractStatusType('warning')).toBe('warning');
      expect(getContractStatusType('unknown')).toBe('pending');
      expect(getContractStatusType('')).toBe('pending');
    });

    it('should be case insensitive', () => {
      expect(getContractStatusType('PASSED')).toBe('success');
      expect(getContractStatusType('Failed')).toBe('failure');
    });
  });

  describe('getUpdatedContractDetails', () => {
    it('should merge form values with contract and omit specific fields', () => {
      const contract = {
        id: '123',
        name: 'Original Name',
        description: 'Original Description',
        fullyQualifiedName: 'fqn',
        version: '1.0',
        updatedAt: 1234567890,
        updatedBy: 'user',
        testSuite: 'suite',
        deleted: false,
        changeDescription: 'change',
        latestResult: 'result',
        incrementalChangeDescription: 'incremental',
        otherField: 'value',
      };

      const formValues = {
        name: 'New Name',
        description: 'New Description',
        newField: 'newValue',
      };

      const result = getUpdatedContractDetails(
        contract as unknown as DataContract,
        formValues as unknown as DataContract
      );

      expect(result).toEqual({
        name: 'Original Name', // Name is preserved
        description: 'New Description', // Description is updated
        otherField: 'value',
        newField: 'newValue',
      });

      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('fullyQualifiedName');
      expect(result).not.toHaveProperty('version');
      expect(result).not.toHaveProperty('updatedAt');
      expect(result).not.toHaveProperty('updatedBy');
      expect(result).not.toHaveProperty('testSuite');
      expect(result).not.toHaveProperty('deleted');
      expect(result).not.toHaveProperty('changeDescription');
      expect(result).not.toHaveProperty('latestResult');
      expect(result).not.toHaveProperty('incrementalChangeDescription');
    });
  });

  describe('downloadContractYamlFile', () => {
    let createElementSpy: jest.SpyInstance;
    let appendChildSpy: jest.SpyInstance;
    let removeChildSpy: jest.SpyInstance;
    let clickSpy: jest.Mock;
    let createObjectURLSpy: jest.SpyInstance;
    let revokeObjectURLSpy: jest.SpyInstance;

    beforeEach(() => {
      clickSpy = jest.fn();
      const mockElement = {
        textContent: '',
        href: '',
        download: '',
        click: clickSpy,
      };

      createElementSpy = jest
        .spyOn(document, 'createElement')
        .mockReturnValue(mockElement as unknown as HTMLAnchorElement);
      appendChildSpy = jest
        .spyOn(document.body, 'appendChild')
        .mockImplementation(() => mockElement as unknown as Node);
      removeChildSpy = jest
        .spyOn(document.body, 'removeChild')
        .mockImplementation(() => mockElement as unknown as Node);
      // Mock URL methods on global object
      global.URL = {
        createObjectURL: jest.fn(() => 'blob:url'),
        revokeObjectURL: jest.fn(),
      } as unknown as typeof URL;
      createObjectURLSpy = global.URL.createObjectURL as jest.Mock;
      revokeObjectURLSpy = global.URL.revokeObjectURL as jest.Mock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should download contract as YAML file', () => {
      const contract = {
        id: '123',
        name: 'test-contract',
        description: 'Test Contract',
      };

      downloadContractYamlFile(contract as unknown as DataContract);

      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });
  });

  describe('getDataContractStatusIcon', () => {
    it('should return correct icon for each status', () => {
      expect(
        getDataContractStatusIcon(ContractExecutionStatus.Failed)
      ).toBeDefined();
      expect(
        getDataContractStatusIcon(ContractExecutionStatus.Aborted)
      ).toBeDefined();
      expect(
        getDataContractStatusIcon(ContractExecutionStatus.Running)
      ).toBeDefined();
      expect(
        getDataContractStatusIcon(ContractExecutionStatus.Success)
      ).toBeNull();
    });
  });

  describe('generateSelectOptionsFromString', () => {
    it('should convert string array to select options', () => {
      const input = ['hour', 'day', 'week'];
      const result = generateSelectOptionsFromString(input);

      expect(result).toEqual([
        { label: 'label.hour', value: 'hour' },
        { label: 'label.day', value: 'day' },
        { label: 'label.week', value: 'week' },
      ]);
    });

    it('should handle empty array', () => {
      const result = generateSelectOptionsFromString([]);

      expect(result).toEqual([]);
    });
  });
});
