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
import { render } from '@testing-library/react';
import { startCase } from 'lodash';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import { ServiceCategory } from '../enums/service.enum';
import { TestSuite } from '../generated/tests/testCase';
import { MOCK_CHART_DATA } from '../mocks/Chart.mock';
import { MOCK_TABLE, MOCK_TIER_DATA } from '../mocks/TableData.mock';
import {
  columnSorter,
  getBreadcrumbForTestSuite,
  getColumnSorter,
  getEntityBreadcrumbs,
  getEntityLinkFromType,
  getEntityOverview,
  highlightEntityNameAndDescription,
  highlightSearchArrayElement,
  highlightSearchText,
} from './EntityUtils';
import {
  entityWithoutNameAndDescHighlight,
  highlightedEntityDescription,
  highlightedEntityDisplayName,
  mockDatabaseUrl,
  mockEntityForDatabase,
  mockEntityForDatabaseSchema,
  mockHighlightedResult,
  mockHighlights,
  mockSearchText,
  mockServiceUrl,
  mockSettingUrl,
  mockText,
  mockUrl,
} from './mocks/EntityUtils.mock';
import {
  getEntityDetailsPath,
  getServiceDetailsPath,
  getSettingPath,
} from './RouterUtils';
import { getServiceRouteFromServiceType } from './ServiceUtils';
import { getTierTags } from './TableUtils';

jest.mock('../constants/constants', () => ({
  getEntityDetailsPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
}));

jest.mock('./RouterUtils', () => ({
  getDataQualityPagePath: jest.fn(),
  getDomainPath: jest.fn(),
  getSettingPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getEntityDetailsPath: jest.fn(),
}));

jest.mock('./ServiceUtils', () => ({
  getServiceRouteFromServiceType: jest.fn(),
}));

jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./ExportUtilClassBase', () => ({
  __esModule: true,
  default: {
    exportMethodBasedOnType: jest.fn(),
  },
}));

jest.mock('../components/Tag/TagsV1/TagsV1.component', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('../components/common/OwnerLabel/OwnerLabel.component', () => ({
  __esModule: true,
  OwnerLabel: jest.fn(),
}));

jest.mock('../components/common/DomainLabel/DomainLabel.component', () => ({
  __esModule: true,
  DomainLabel: jest.fn(),
}));

jest.mock('../components/common/QueryCount/QueryCount.component', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./StringsUtils', () => ({
  bytesToSize: jest.fn(),
  getEncodedFqn: jest.fn(),
  stringToHTML: jest.fn().mockImplementation((value) => value),
}));
jest.mock('./TableUtils', () => ({
  getDataTypeString: jest.fn(),
  getTagsWithoutTier: jest.fn(),
  getTierTags: jest.fn(),
  getUsagePercentile: jest.fn().mockImplementation((value) => value + 'th'),
}));

jest.mock('./TagsUtils', () => ({
  getTableTags: jest.fn(),
}));

jest.mock('./CommonUtils', () => ({
  getPartialNameFromTableFQN: jest.fn().mockImplementation((value) => value),
  getTableFQNFromColumnFQN: jest.fn().mockImplementation((value) => value),
}));
jest.mock('./DataInsightUtils', () => ({
  getDataInsightPathWithFqn: jest.fn(),
}));
jest.mock('./EntityLink', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((value) => value),
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
      basicEntityReference: {
        fullyQualifiedName: 'test/testSuite',
        id: '123',
        type: 'testType',
      },
    };

    it('should get breadcrumb if data is basic', () => {
      const result = getBreadcrumbForTestSuite({
        ...testSuiteData,
        basic: true,
      });

      expect(result).toEqual([
        { name: '', url: undefined },
        { name: 'label.test-suite', url: '' },
      ]);
    });

    it('should get breadcrumb if data is not basic', () => {
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
        getEntityOverview(ExplorePageTabs.CHARTS, {
          ...MOCK_CHART_DATA,
          dataProducts: [],
        })
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
          dataProducts: [],
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
      expect(getTierTags).toHaveBeenCalledWith([MOCK_TIER_DATA]);
      expect(result).toContain('Regular');
      expect(result).toContain('sample_data');
      expect(result).toContain('ecommerce_db');
      expect(result).toContain('shopify');
      expect(result).toContain('0th');
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

    const falsyTestCases = [
      { text: null, searchText: 'test', expected: '' },
      { text: 'mockText', searchText: null, expected: 'mockText' },
      { text: null, searchText: null, expected: '' },
      { text: 0 as any, searchText: '', expected: 0 },
      { text: false as any, searchText: '', expected: false },
    ];

    it.each(falsyTestCases)(
      'should return expected when text or searchText is null or falsy',
      ({ text, searchText, expected }) => {
        const result = highlightSearchText(
          text ?? undefined,
          searchText ?? undefined
        );

        expect(result).toBe(expected);
      }
    );
  });

  describe('highlightSearchArrayElement method', () => {
    it('should highlight the searchText in the text', () => {
      const result = highlightSearchArrayElement(mockText, 'highlightText');
      const { container } = render(<>{result}</>); // Render the result to check JSX output

      // Check if the correct part of the text is wrapped in a <span> with the correct class
      const highlighted = container.querySelector('.text-highlighter');

      expect(highlighted).toBeInTheDocument();
      expect(highlighted?.textContent).toBe('highlightText');
    });

    it('should highlight multiple occurrences of the searchText', () => {
      const result = highlightSearchArrayElement(
        'Data testing environment, Manually test data',
        'data'
      );
      const { container } = render(<>{result}</>);

      // Check that there are two highlighted parts (one for each 'hello')
      const highlightedElements =
        container.querySelectorAll('.text-highlighter');

      expect(highlightedElements).toHaveLength(2);
      expect(highlightedElements[0].textContent).toBe('Data');
      expect(highlightedElements[1].textContent).toBe('data');
    });

    it('should not modify parts of the text that do not match searchText', () => {
      const result = highlightSearchArrayElement(mockText, 'highlightText');
      const { container } = render(<>{result}</>);

      // Ensure the non-matching part is plain text
      const nonHighlighted = container.textContent;

      expect(nonHighlighted).toContain('description');
    });

    it('should not wrap searchText in the result if it does not appear in text', () => {
      const result = highlightSearchArrayElement(mockText, 'foo');
      const { container } = render(<>{result}</>);

      // Ensure that no parts of the text are highlighted
      const highlighted = container.querySelector('.text-highlighter');

      expect(highlighted).toBeNull();
    });

    it('should handle case-insensitive search', () => {
      const result = highlightSearchArrayElement(mockText, 'HighlightText');
      const { container } = render(<>{result}</>);

      const highlighted = container.querySelector('.text-highlighter');

      expect(highlighted).toBeInTheDocument();
      expect(highlighted?.textContent).toBe('highlightText');
    });

    it('should return an empty string if no text is provided', () => {
      const result = highlightSearchArrayElement('', 'test');

      expect(result).toBe('');
    });

    it('should return an empty string if no searchText is provided', () => {
      const result = highlightSearchArrayElement(mockText, '');

      expect(result).toBe(mockText);
    });

    it('should return empty string if both text and searchText are missing', () => {
      const result = highlightSearchArrayElement('', '');

      expect(result).toBe('');
    });

    const falsyTestCases = [
      { text: null, searchText: 'test', expected: '' },
      { text: 'mockText', searchText: null, expected: 'mockText' },
      { text: null, searchText: null, expected: '' },
      { text: 0 as any, searchText: '', expected: 0 },
      { text: false as any, searchText: '', expected: false },
    ];

    it.each(falsyTestCases)(
      'should return expected when text or searchText is null or falsy',
      ({ text, searchText, expected }) => {
        const result = highlightSearchArrayElement(
          text ?? undefined,
          searchText ?? undefined
        );

        expect(result).toBe(expected);
      }
    );
  });

  describe('getEntityBreadcrumbs', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return breadcrumbs for EntityType.DATABASE', () => {
      (getServiceRouteFromServiceType as jest.Mock).mockReturnValue(mockUrl);
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(
        '/service/databaseServices/mysql_sample'
      );
      (getEntityDetailsPath as jest.Mock).mockReturnValue('/database/default');

      const result = getEntityBreadcrumbs(
        mockEntityForDatabase,
        EntityType.DATABASE
      );

      expect(result).toEqual([
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: mockSettingUrl,
        },
        { name: 'mysql_sample', url: '/service/databaseServices/mysql_sample' },
        {
          name: 'default',
          url: '/database/default',
        },
      ]);

      expect(getServiceRouteFromServiceType).toHaveBeenCalledWith(
        ServiceCategory.DATABASE_SERVICES
      );
    });

    it('should return breadcrumbs for EntityType.DATABASE_SCHEMA', () => {
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(mockServiceUrl);
      (getEntityDetailsPath as jest.Mock).mockReturnValue(mockDatabaseUrl);

      const result = getEntityBreadcrumbs(
        mockEntityForDatabaseSchema,
        EntityType.DATABASE_SCHEMA
      );

      expect(result).toEqual([
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: mockSettingUrl,
        },
        {
          name: 'sample_data',
          url: mockServiceUrl,
        },
        {
          name: 'ecommerce_db',
          url: mockDatabaseUrl,
        },
        {
          name: 'shopify',
          url: '/entity/MockDatabase',
        },
      ]);

      expect(getServiceDetailsPath).toHaveBeenCalledWith(
        'sample_data',
        ServiceCategory.DATABASE_SERVICES
      );
      expect(getEntityDetailsPath).toHaveBeenCalledWith(
        EntityType.DATABASE,
        'sample_data.ecommerce_db'
      );
    });
  });
});
