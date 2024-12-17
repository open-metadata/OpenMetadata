/*
 *  Copyright 2023 Collate.
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
import { getEntityDetailsPath } from '../constants/constants';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import { TestSuite } from '../generated/tests/testCase';
import { MOCK_CHART_DATA } from '../mocks/Chart.mock';
import { MOCK_TABLE, MOCK_TIER_DATA } from '../mocks/TableData.mock';
import {
  columnSorter,
  getBreadcrumbForTestSuite,
  getColumnSorter,
  getEntityLinkFromType,
  getEntityOverview,
  highlightEntityNameAndDescription,
  highlightSearchText,
} from './EntityUtils';
import {
  entityWithoutNameAndDescHighlight,
  highlightedEntityDescription,
  highlightedEntityDisplayName,
  mockHighlightedResult,
  mockHighlights,
  mockSearchText,
  mockText,
} from './mocks/EntityUtils.mock';

jest.mock('../constants/constants', () => ({
  getEntityDetailsPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
}));

jest.mock('./RouterUtils', () => ({
  getDataQualityPagePath: jest.fn(),
  getDomainPath: jest.fn(),
}));

describe('EntityUtils unit tests', () => {
  describe('highlightEntityNameAndDescription method', () => {
    it('highlightEntityNameAndDescription method should return the entity with highlighted name and description', () => {
      const highlightedEntity = highlightEntityNameAndDescription(
        entityWithoutNameAndDescHighlight,
        mockHighlights
      );

      expect(highlightedEntity.displayName).toBe(highlightedEntityDisplayName);
      expect(highlightedEntity.description).toBe(highlightedEntityDescription);
    });
  });

  describe('columnSorter method', () => {
    it('columnSorter method should return 1 if the 2nd column should be come before 1st column', () => {
      const result = columnSorter({ name: 'name2' }, { name: 'name1' });

      expect(result).toBe(1);
    });

    it('columnSorter method should return -1 if the 1st column should be come before 2nd column', () => {
      const result = columnSorter({ name: 'name1' }, { name: 'name2' });

      expect(result).toBe(-1);
    });
  });

  describe('getEntityLinkFromType', () => {
    it('should trigger case for entity type TestSuite', () => {
      const fqn = 'test/testSuite';

      getEntityLinkFromType(fqn, EntityType.TEST_SUITE);

      expect(getEntityDetailsPath).toHaveBeenCalledWith(
        EntityType.TABLE,
        fqn,
        EntityTabs.PROFILER
      );
    });
  });

  describe('getBreadcrumbForTestSuite', () => {
    const testSuiteData: TestSuite = {
      name: 'testSuite',
      executableEntityReference: {
        fullyQualifiedName: 'test/testSuite',
        id: '123',
        type: 'testType',
      },
    };

    it('should get breadcrumb if data is executable', () => {
      const result = getBreadcrumbForTestSuite({
        ...testSuiteData,
        executable: true,
      });

      expect(result).toEqual([
        { name: '', url: undefined },
        { name: 'label.test-suite', url: '' },
      ]);
    });

    it('should get breadcrumb if data is not executable', () => {
      const result = getBreadcrumbForTestSuite(testSuiteData);

      expect(result).toEqual([
        { name: 'label.test-suite-plural', url: undefined },
        { name: 'testSuite', url: '' },
      ]);
    });
  });

  describe('getEntityOverview', () => {
    it('should call getChartOverview and get ChartData if ExplorePageTabs is charts', () => {
      const result = JSON.stringify(
        getEntityOverview(ExplorePageTabs.CHARTS, MOCK_CHART_DATA)
      );

      expect(result).toContain('label.owner-plural');
      expect(result).toContain('label.chart');
      expect(result).toContain('label.url-uppercase');
      expect(result).toContain('Are you an ethnic minority in your city?');
      expect(result).toContain(
        `http://localhost:8088/superset/explore/?form_data=%7B%22slice_id%22%3A%20127%7D`
      );
      expect(result).toContain('label.service');
      expect(result).toContain('sample_superset');
      expect(result).toContain('Other');
      expect(result).toContain('label.service-type');
      expect(result).toContain('Superset');
    });

    it('should call getChartOverview and get TableData if ExplorePageTabs is table', () => {
      const result = JSON.stringify(
        getEntityOverview(ExplorePageTabs.TABLES, {
          ...MOCK_TABLE,
          tags: [MOCK_TIER_DATA],
        })
      );

      expect(result).toContain('label.owner-plural');
      expect(result).toContain('label.type');
      expect(result).toContain('label.service');
      expect(result).toContain('label.database');
      expect(result).toContain('label.schema');
      expect(result).toContain('label.tier');
      expect(result).toContain('label.usage');
      expect(result).toContain('label.query-plural');
      expect(result).toContain('label.column-plural');
      expect(result).toContain('label.row-plural');

      expect(result).toContain('Tier4');
      expect(result).toContain('Regular');
      expect(result).toContain('sample_data');
      expect(result).toContain('ecommerce_db');
      expect(result).toContain('shopify');
      expect(result).toContain('0th label.pctile-lowercase');
      expect(result).toContain('4');
      expect(result).toContain('14567');
    });
  });

  describe('getColumnSorter', () => {
    type TestType = { name: string };

    it('should return -1 if the 1st value should be before 2nd value', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc' };
      const item2 = { name: 'xyz' };

      expect(sorter(item1, item2)).toBe(-1);
    });

    it('should return 0 when both values are the same', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc' };
      const item2 = { name: 'abc' };

      expect(sorter(item1, item2)).toBe(0);
    });

    it('should return 1 if the 1st value should be after 2nd value', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc' };
      const item2 = { name: 'xyz' };

      expect(sorter(item2, item1)).toBe(1);
    });

    it('should return 1 if the 1st value should be after 2nd value for alphanumeric values', () => {
      const sorter = getColumnSorter<TestType, 'name'>('name');
      const item1 = { name: 'abc10' };
      const item2 = { name: 'abc20' };

      expect(sorter(item2, item1)).toBe(1);
    });
  });

  describe('highlightSearchText method', () => {
    it('should return the text with highlighted search text', () => {
      const result = highlightSearchText(mockText, mockSearchText);

      expect(result).toBe(mockHighlightedResult);
    });

    it('should return the original text if searchText is not found', () => {
      const result = highlightSearchText(mockText, 'nonexistent');

      expect(result).toBe(mockText);
    });

    it('should return an empty string if no text is provided', () => {
      const result = highlightSearchText('', 'test');

      expect(result).toBe('');
    });

    it('should return an empty string if no searchText is provided', () => {
      const result = highlightSearchText(mockText, '');

      expect(result).toBe(mockText);
    });

    it('should return empty string if both text and searchText are missing', () => {
      const result = highlightSearchText('', '');

      expect(result).toBe('');
    });
  });
});
