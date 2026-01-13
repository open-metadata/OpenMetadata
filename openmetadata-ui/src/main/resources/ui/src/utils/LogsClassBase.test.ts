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

import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { OPEN_METADATA } from '../constants/service-guide.constant';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import logsClassBase, { LogsClassBase } from './LogsClassBase';

jest.mock('./CommonUtils', () => ({
  getNameFromFQN: jest.fn((fqn: string) => {
    const parts = fqn.split('.');

    return parts[parts.length - 1];
  }),

  getTableFQNFromColumnFQN: jest.fn((fqn: string) => {
    const parts = fqn.split('.');

    return parts.slice(0, -1).join('.');
  }),
}));

jest.mock('./Fqn', () => ({
  split: jest.fn((fqn: string) => fqn.split('.')),
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn((key: string) => key),
}));

jest.mock('./IngestionUtils', () => ({
  getSettingsPathFromPipelineType: jest.fn(
    (type: string) => `/settings/${type}`
  ),
}));

jest.mock('./RouterUtils', () => ({
  getApplicationDetailsPath: jest.fn((name: string) => `/applications/${name}`),
  getDataQualityPagePath: jest.fn((tab: string) => `/data-quality/${tab}`),
  getLogEntityPath: jest.fn(
    (path: string, serviceType: string) => `/${serviceType}/${path}`
  ),
  getSettingPath: jest.fn((option: string) => `/settings/${option}`),
}));

jest.mock('./TestSuiteUtils', () => ({
  getTestSuiteDetailsPath: jest.fn(
    (params: { fullyQualifiedName: string; isExecutableTestSuite: boolean }) =>
      `/test-suite/${params.fullyQualifiedName}`
  ),
}));

describe('LogsClassBase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an instance of LogsClassBase', () => {
    expect(logsClassBase).toBeInstanceOf(LogsClassBase);
  });

  describe('getLogBreadCrumbs', () => {
    it('should return breadcrumbs for OpenMetadata ingestion pipeline', () => {
      const serviceType = 'database';
      const ingestionName = `${OPEN_METADATA}.testPipeline`;
      const ingestionDetails = {
        pipelineType: 'metadata',
        name: 'testPipeline',
      } as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([
        {
          name: 'Metadata',
          url: '/settings/metadata',
          activeTitle: true,
        },
        {
          name: 'testPipeline',
          url: '',
          activeTitle: true,
        },
      ]);
    });

    it('should return breadcrumbs for Applications service type', () => {
      const serviceType = GlobalSettingOptions.APPLICATIONS;
      const ingestionName = 'testApplication';
      const ingestionDetails = undefined;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([
        {
          name: 'Apps',
          url: '/settings/apps',
        },
        {
          name: 'testApplication',
          url: '/applications/testApplication',
        },
      ]);
    });

    it('should return empty array when ingestionDetails is undefined and not Applications', () => {
      const serviceType = 'database';
      const ingestionName = 'testPipeline';
      const ingestionDetails = undefined;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([]);
    });

    it('should return breadcrumbs for executable test suite', () => {
      const serviceType = 'testSuite';
      const ingestionName = 'testSuite.testPipeline';
      const ingestionDetails = {
        name: 'testPipeline',
        sourceConfig: {
          config: {
            entityFullyQualifiedName: 'database.schema.table.column',
          },
        },
        service: {
          fullyQualifiedName: 'service.fqn',
        },
      } as unknown as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([
        {
          name: 'Test Suite',
          url: `/data-quality/${DataQualityPageTabs.TEST_SUITES}`,
        },
        {
          name: 'testPipeline',
          url: '/test-suite/database.schema.table',
        },
        {
          name: 'label.log-plural',
          url: '',
        },
      ]);
    });

    it('should return breadcrumbs for non-executable test suite', () => {
      const serviceType = 'testSuite';
      const ingestionName = 'testSuite.testPipeline';
      const ingestionDetails = {
        name: 'testPipeline',
        sourceConfig: {
          config: {},
        },
        service: {
          fullyQualifiedName: 'service.fqn',
        },
      } as unknown as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([
        {
          name: 'Test Suite',
          url: `/data-quality/${DataQualityPageTabs.TEST_SUITES}`,
        },
        {
          name: 'testPipeline',
          url: '/test-suite/service.fqn',
        },
        {
          name: 'label.log-plural',
          url: '',
        },
      ]);
    });

    it('should return breadcrumbs for test suite without service', () => {
      const serviceType = 'testSuite';
      const ingestionName = 'testSuite.testPipeline';
      const ingestionDetails = {
        name: 'testPipeline',
        sourceConfig: {
          config: {},
        },
      } as unknown as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([
        {
          name: 'Test Suite',
          url: `/data-quality/${DataQualityPageTabs.TEST_SUITES}`,
        },
        {
          name: 'testPipeline',
          url: '/test-suite/',
        },
        {
          name: 'label.log-plural',
          url: '',
        },
      ]);
    });

    it('should return breadcrumbs for regular service type', () => {
      const serviceType = 'database';
      const ingestionName = 'service.database.pipeline';
      const ingestionDetails = {
        name: 'pipeline',
        pipelineType: 'metadata',
      } as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      const expectedPath = ['database', 'service', 'database', 'pipeline'];

      expect(result).toEqual(
        expectedPath.map((path, index) => ({
          name: index === 0 ? 'Database' : path,
          url: index !== expectedPath.length - 1 ? `/database/${path}` : '',
        }))
      );
    });

    it('should handle ingestion name with single part', () => {
      const serviceType = 'messaging';
      const ingestionName = 'kafkaPipeline';
      const ingestionDetails = {
        name: 'kafkaPipeline',
        pipelineType: 'metadata',
      } as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      const expectedPath = ['messaging', 'kafkaPipeline'];

      expect(result).toEqual(
        expectedPath.map((path, index) => ({
          name: index === 0 ? 'Messaging' : path,
          url: index !== expectedPath.length - 1 ? `/messaging/${path}` : '',
        }))
      );
    });

    it('should handle empty entityFullyQualifiedName for executable test suite', () => {
      const serviceType = 'testSuite';
      const ingestionName = 'testSuite.testPipeline';
      const ingestionDetails = {
        name: 'testPipeline',
        sourceConfig: {
          config: {
            entityFullyQualifiedName: '',
          },
        },
        service: {
          fullyQualifiedName: 'service.fqn',
        },
      } as unknown as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([
        {
          name: 'Test Suite',
          url: `/data-quality/${DataQualityPageTabs.TEST_SUITES}`,
        },
        {
          name: 'testPipeline',
          url: '/test-suite/',
        },
        {
          name: 'label.log-plural',
          url: '',
        },
      ]);
    });

    it('should handle multiple dots in ingestion name for OpenMetadata', () => {
      const serviceType = 'database';
      const ingestionName = `${OPEN_METADATA}.pipeline.sub.test`;
      const ingestionDetails = {
        pipelineType: 'dbt',
        name: 'test',
      } as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      expect(result).toEqual([
        {
          name: 'Dbt',
          url: '/settings/dbt',
          activeTitle: true,
        },
        {
          name: 'test',
          url: '',
          activeTitle: true,
        },
      ]);
    });

    it('should handle complex service path', () => {
      const serviceType = 'storage';
      const ingestionName = 'aws.s3.bucket.pipeline';
      const ingestionDetails = {
        name: 'pipeline',
        pipelineType: 'metadata',
      } as IngestionPipeline;

      const result = logsClassBase.getLogBreadCrumbs(
        serviceType,
        ingestionName,
        ingestionDetails
      );

      const expectedPath = ['storage', 'aws', 's3', 'bucket', 'pipeline'];

      expect(result).toEqual(
        expectedPath.map((path, index) => ({
          name: index === 0 ? 'Storage' : path,
          url: index !== expectedPath.length - 1 ? `/storage/${path}` : '',
        }))
      );
    });
  });
});
