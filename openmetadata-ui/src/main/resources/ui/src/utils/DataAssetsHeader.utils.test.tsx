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

import { Tooltip, Typography } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { HeaderProperty } from '../components/DataAssets/EntityHeaderProperties/EntityHeaderProperties.types';
import { EntityType } from '../enums/entity.enum';
import {
  Spreadsheet,
  SpreadsheetMIMEType,
} from '../generated/entity/data/spreadsheet';
import { mockContainerData } from '../mocks/ContainerVersion.mock';
import { MOCK_DASHBOARD_DATA_MODEL } from '../mocks/DashboardDataModel.mock';
import { mockDashboardData } from '../mocks/dashboardVersion.mock';
import { MOCK_DATABASE } from '../mocks/Database.mock';
import { MOCK_DATABASE_SCHEMA } from '../mocks/DatabaseSchema.mock';
import { mockMlModelDetails } from '../mocks/MlModelVersion.mock';
import { mockPipelineData } from '../mocks/PipelineVersion.mock';
import { MOCK_SEARCH_INDEX } from '../mocks/SearchIndex.mock';
import {
  MOCK_DASHBOARD_SERVICE,
  MOCK_DATABASE_SERVICE,
  MOCK_MESSAGING_SERVICE,
  MOCK_METADATA_SERVICE,
  MOCK_ML_MODEL_SERVICE,
  MOCK_PIPLELINE_SERVICE,
  MOCK_SEARCH_SERVICE,
  MOCK_STORAGE_SERVICE,
} from '../mocks/Service.mock';
import { mockStoredProcedureData } from '../mocks/StoredProcedure.mock';
import { MOCK_TABLE } from '../mocks/TableData.mock';
import { mockTopicData } from '../mocks/TopicVersion.mock';
import {
  ExtraInfoLabel,
  getDataAssetsHeaderInfo,
} from './DataAssetsHeader.utils';
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTimeLong,
} from './date-time/DateTimeUtils';

// Mock only ExtraInfoLink, not ExtraInfoLabel as we want to test it
jest.mock('./DataAssetsHeader.utils', () => ({
  ...jest.requireActual('./DataAssetsHeader.utils'),
  ExtraInfoLink: jest.fn().mockImplementation(({ value }) => value),
}));
jest.mock('./EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
}));
jest.mock('./EntityBreadcrumbPureUtils', () => ({
  getEntityBreadcrumbs: jest.fn().mockReturnValue([
    {
      name: 'entityName',
      url: 'url',
    },
  ]),
}));
jest.mock('./EntityDataBreadcrumbUtils', () => ({
  getBreadcrumbForTable: jest.fn().mockReturnValue([
    {
      name: 'entityName',
      url: 'url',
    },
  ]),
  getBreadcrumbForContainer: jest.fn().mockReturnValue([
    {
      name: 'entityName',
      url: 'url',
    },
  ]),
  getBreadcrumbForEntitiesWithServiceOnly: jest.fn().mockReturnValue([
    {
      name: 'entityName',
      url: 'url',
    },
  ]),
  getBreadcrumbForEntityWithParent: jest.fn().mockReturnValue([
    {
      name: 'entityName',
      url: 'url',
    },
  ]),
}));

jest.mock('./StringUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  bytesToSize: jest.fn().mockReturnValue('bytesToSize'),
  getSafeHttpUrl: jest.requireActual('./StringUtils').getSafeHttpUrl,
}));

jest.mock('./TablePureUtils', () => ({
  getUsagePercentile: jest.fn().mockReturnValue('getUsagePercentile'),
}));

jest.mock('./date-time/DateTimeUtils', () => ({
  ...jest.requireActual('./date-time/DateTimeUtils'),
  formatDateTime: jest
    .fn()
    .mockImplementation((timestamp) => `formatted-${timestamp}`),
  getEpochMillisForPastDays: jest
    .fn()
    .mockImplementation((days) => Date.now() - days * 24 * 60 * 60 * 1000),
  getCurrentMillis: jest.fn().mockReturnValue(Date.now()),
}));

jest.mock('../constants/constants', () => ({
  ...jest.requireActual('../constants/constants'),
  NO_DATA_PLACEHOLDER: jest.fn().mockReturnValue('---'),
  getEntityDetailsPath: jest.fn().mockReturnValue('getDashboardDetailsPath'),
}));

// The builders list every property of the entity type; only the filled ones reach the header.
const shownInfo = ({ extraInfo }: { extraInfo: HeaderProperty[] }) =>
  JSON.stringify(extraInfo.filter(({ isEmpty }) => !isEmpty));

const renderInfo = (extraInfo: HeaderProperty[]) =>
  render(
    <>
      {extraInfo.map(({ id, content }) => (
        <React.Fragment key={id}>{content}</React.Fragment>
      ))}
    </>
  );

describe('Tests for DataAssetsHeaderUtils', () => {
  // Test for Table entity
  it('Function getDataAssetsHeaderInfo should return data for tables entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.TABLE,
      MOCK_TABLE,
      'Redshift',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains all extra data

    expect(shownInfo(assetData)).toContain('label.type');
    expect(shownInfo(assetData)).toContain('Regular');

    expect(shownInfo(assetData)).toContain('label.usage');
    expect(shownInfo(assetData)).toContain('getUsagePercentile');

    expect(shownInfo(assetData)).toContain('label.column-plural');
    expect(shownInfo(assetData)).toContain('12');

    expect(shownInfo(assetData)).toContain('label.row-plural');
    expect(shownInfo(assetData)).toContain('14567');

    // source-system creation time, read from lifeCycle.created
    expect(shownInfo(assetData)).toContain('label.created-time');
    expect(shownInfo(assetData)).toContain('formatted-1609459200000');

    //  If Data does not present
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.TABLE,
      {
        ...MOCK_TABLE,
        tableType: undefined,
        retentionPeriod: undefined,
        usageSummary: undefined,
        profile: undefined,
        lifeCycle: undefined,
      },
      'Redshift',
      []
    );

    // contains all extra data

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.type');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('Regular');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.usage');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('getUsagePercentile');

    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'label.column-plural'
    );
    expect(shownInfo(assetWithNoExtraData)).not.toContain('12');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.row-plural');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('14567');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.created-time');
  });

  it('Function getDataAssetsHeaderInfo should render an epoch-0 table creation time', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.TABLE,
      { ...MOCK_TABLE, lifeCycle: { created: { timestamp: 0 } } },
      'Redshift',
      []
    );

    expect(shownInfo(assetData)).toContain('label.created-time');
    expect(shownInfo(assetData)).toContain('formatted-0');
  });

  it.each([
    {
      entityType: EntityType.TABLE as const,
      dataAsset: {
        ...MOCK_TABLE,
        lifeCycle: { created: { timestamp: 1609459200000 } },
      },
      testId: 'table-created-time',
    },
    {
      entityType: EntityType.SPREADSHEET as const,
      dataAsset: {
        id: 'spreadsheet-123',
        name: 'test-spreadsheet',
        createdTime: 1609459200000,
        service: { id: 'service-123', type: 'driveService' },
      } as Spreadsheet,
      testId: 'spreadsheet-created-time',
    },
  ])(
    'shows the $entityType creation time without its UTC offset and the full time on hover',
    async ({ entityType, dataAsset, testId }) => {
      const createdAt = 1609459200000;
      const { extraInfo } = getDataAssetsHeaderInfo(
        entityType,
        dataAsset,
        'name',
        []
      );

      renderInfo(extraInfo);

      const createdTime = screen.getByTestId(testId);

      expect(createdTime).toHaveTextContent(
        formatDateTimeLong(createdAt, DATE_TIME_12_HOUR_FORMAT)
      );
      expect(createdTime).not.toHaveTextContent('UTC');

      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      fireEvent.mouseMove(document);
      await user.hover(createdTime);

      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        `formatted-${createdAt}`
      );
    }
  );

  it('Function getDataAssetsHeaderInfo should hide a year-0001 placeholder table creation time', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.TABLE,
      {
        ...MOCK_TABLE,
        lifeCycle: { created: { timestamp: -62135596800000 } },
      },
      'Redshift',
      []
    );

    expect(shownInfo(assetData)).not.toContain('label.created-time');
    expect(shownInfo(assetData)).not.toContain('formatted--62135596800000');
  });

  // Test for Topic entity
  it('Function getDataAssetsHeaderInfo should return data for Topic entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.TOPIC,
      mockTopicData,
      'customer_contacts',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains all extra data
    expect(shownInfo(assetData)).toContain('label.partition-plural');
    expect(shownInfo(assetData)).toContain('128');

    expect(shownInfo(assetData)).toContain('label.replication-factor');
    expect(shownInfo(assetData)).toContain('4');

    //  If Data does not present
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.TOPIC,
      { ...mockTopicData, partitions: undefined, replicationFactor: undefined },
      'customer_contacts',
      []
    );

    // contains all extra data
    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'label.partition-plural'
    );
    expect(shownInfo(assetWithNoExtraData)).not.toContain('128');

    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'label.replication-factor'
    );
    expect(shownInfo(assetWithNoExtraData)).not.toContain('4');
  });

  // Test for Dashboard entity
  it('Function getDataAssetsHeaderInfo should return data for Dashboard entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.DASHBOARD,
      mockDashboardData,
      'orders',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains all extra data
    expect(shownInfo(assetData)).toContain('label.entity-type-plural');
    expect(shownInfo(assetData)).toContain('Dashboard');

    expect(shownInfo(assetData)).toContain('label.project');
    expect(shownInfo(assetData)).toContain('workspace');

    expect(shownInfo(assetData)).toContain('label.usage');
    expect(shownInfo(assetData)).toContain('getUsagePercentile');

    //  If Data does not present
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.DASHBOARD,
      {
        ...mockDashboardData,
        dashboardType: undefined,
        project: undefined,
        usageSummary: undefined,
      },
      'orders',
      []
    );

    // contains all extra data
    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'label.entity-type-plural'
    );
    expect(shownInfo(assetWithNoExtraData)).not.toContain('Dashboard');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.project');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('workspace');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.usage');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('getUsagePercentile');
  });

  // Test for Pipeline entity
  it('Function getDataAssetsHeaderInfo should return data for Pipeline entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.PIPELINE,
      mockPipelineData,
      'snowflake_etl',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains extra data for source url

    //  If Data does not present

    // contains extra data for source url
  });

  // Test for MlModel entity
  it('Function getDataAssetsHeaderInfo should return data for MlModel entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.MLMODEL,
      mockMlModelDetails,
      'forecast_sales',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains extra data
    expect(shownInfo(assetData)).toContain('label.algorithm');
    expect(shownInfo(assetData)).toContain('Neural Network');

    expect(shownInfo(assetData)).toContain('label.target');
    expect(shownInfo(assetData)).toContain('ETA_time');

    expect(shownInfo(assetData)).toContain('label.server');
    expect(shownInfo(assetData)).toContain('http://my-server.ai');

    expect(shownInfo(assetData)).toContain('label.dashboard');
    expect(shownInfo(assetData)).toContain('forecast_sales');

    expect(shownInfo(assetData)).toContain('label.usage');
    expect(shownInfo(assetData)).toContain('getUsagePercentile');

    //  If Data does not present
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.MLMODEL,
      {
        ...mockMlModelDetails,
        algorithm: undefined,
        target: undefined,
        server: undefined,
        dashboard: undefined,
        usageSummary: undefined,
      },
      'forecast_sales',
      []
    );

    // contains extra data

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.algorithm');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('Neural Network');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.target');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('ETA_time');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.server');
    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'http://my-server.ai'
    );

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.dashboard');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('forecast_sales');

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.usage');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('getUsagePercentile');
  });

  it.each([
    ['http://my-server.ai', 'http://my-server.ai'],
    ['javascript:alert(document.cookie)', null],
    ['s3://models/forecast', null],
  ])(
    'should link the MlModel server %s only when it is an http(s) URL',
    (server, expectedHref) => {
      const { extraInfo } = getDataAssetsHeaderInfo(
        EntityType.MLMODEL,
        { ...mockMlModelDetails, server, dashboard: undefined },
        'forecast_sales',
        []
      );
      const { container, getByText } = renderInfo(extraInfo);

      expect(getByText(server)).toBeInTheDocument();
      expect(container.querySelector('a')?.getAttribute('href') ?? null).toBe(
        expectedHref
      );
    }
  );

  // Test for Container entity
  it('Function getDataAssetsHeaderInfo should return data for Container entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.CONTAINER,
      mockContainerData,
      'container',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains extra data
    expect(shownInfo(assetData)).toContain('label.non-partitioned');

    expect(shownInfo(assetData)).toContain('label.number-of-object-plural');
    expect(shownInfo(assetData)).toContain('10');

    expect(shownInfo(assetData)).toContain('label.size');
    expect(shownInfo(assetData)).toContain('bytesToSize');

    //  If Data has 0 as a value,it should display them
    const assetWithZeroData = getDataAssetsHeaderInfo(
      EntityType.CONTAINER,
      {
        ...mockContainerData,
        dataModel: {
          ...mockContainerData.dataModel,
          isPartitioned: true,
        },
        numberOfObjects: 0,
        size: 0,
      },
      'container',
      []
    );

    expect(shownInfo(assetWithZeroData)).toContain(
      'label.number-of-object-plural'
    );

    expect(shownInfo(assetWithZeroData)).toContain('label.size');

    //  If Data does not present
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.CONTAINER,
      {
        ...mockContainerData,
        dataModel: {
          ...mockContainerData.dataModel,
          isPartitioned: true,
        },
        numberOfObjects: undefined,
        size: undefined,
      },
      'container',
      []
    );

    // contains extra data
    expect(shownInfo(assetWithNoExtraData)).toContain('label.partitioned');

    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'http://localhost:8585/api/v1/databaseSchemas/48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1'
    );

    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'label.number-of-object-plural'
    );

    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.size');
  });

  // Test for Dashboard Data Modal entity
  it('Function getDataAssetsHeaderInfo should return data for Dashboard Data Modal entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.DASHBOARD_DATA_MODEL,
      MOCK_DASHBOARD_DATA_MODEL,
      'orders-view',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains extra data
    expect(shownInfo(assetData)).toContain('label.data-model-type');

    expect(shownInfo(assetData)).toContain('LookMlExplore');
  });

  // Test for Stored Procedure entity
  it('Function getDataAssetsHeaderInfo should return data for Stored Procedure entity', () => {
    const assetData = getDataAssetsHeaderInfo(
      EntityType.STORED_PROCEDURE,
      mockStoredProcedureData[0],
      'update_dim_address_table',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains extra data
    expect(shownInfo(assetData)).toContain('label.language');
    expect(shownInfo(assetData)).toContain('SQL');

    //  If Data does not present

    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.STORED_PROCEDURE,
      { ...mockStoredProcedureData[0], sourceUrl: '', storedProcedureCode: '' },
      'update_dim_address_table',
      []
    );

    // contains extra data
    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.language');

    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'http://localhost:8585/api/v1/databaseSchemas/48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1'
    );
  });

  // Test for Spreadsheet entity
  it('Function getDataAssetsHeaderInfo should return data for Spreadsheet entity', () => {
    const mockSpreadsheet: Spreadsheet = {
      id: 'spreadsheet-123',
      name: 'test-spreadsheet',
      fullyQualifiedName: 'service.directory.test-spreadsheet',
      mimeType:
        'application/vnd.google-apps.spreadsheet' as SpreadsheetMIMEType,
      createdTime: 1609459200000,
      modifiedTime: 1640995200000,
      service: {
        id: 'service-123',
        name: 'google-drive',
        type: 'driveService',
      },
    };

    const assetData = getDataAssetsHeaderInfo(
      EntityType.SPREADSHEET,
      mockSpreadsheet,
      'test-spreadsheet',
      []
    );

    // contains all breadcrumbs
    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);

    // contains extra data
    expect(shownInfo(assetData)).toContain('label.mime-type');
    expect(shownInfo(assetData)).toContain(
      'application/vnd.google-apps.spreadsheet'
    );

    expect(shownInfo(assetData)).toContain('label.created-time');
    expect(shownInfo(assetData)).toContain('formatted-1609459200000');

    expect(shownInfo(assetData)).toContain('label.modified-time');
    expect(shownInfo(assetData)).toContain('formatted-1640995200000');

    // Test with missing optional data
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.SPREADSHEET,
      {
        ...mockSpreadsheet,
        mimeType: undefined,
        createdTime: undefined,
        modifiedTime: undefined,
      },
      'test-spreadsheet',
      []
    );

    // Should not contain extra data when fields are undefined
    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.mime-type');
    expect(shownInfo(assetWithNoExtraData)).not.toContain('label.created-time');
    expect(shownInfo(assetWithNoExtraData)).not.toContain(
      'label.modified-time'
    );
  });

  // Test for Search entity
  it('Function getDataAssetsHeaderInfo should return data for Search entity', () => {
    // Search Service
    const assetData = getDataAssetsHeaderInfo(
      EntityType.SEARCH_SERVICE,
      MOCK_SEARCH_INDEX,
      'elasticsearch_sample',
      []
    );

    expect(assetData.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);
    expect(assetData.extraInfo).toEqual([]);
  });

  // Test for All Service entity Level
  it('Function getDataAssetsHeaderInfo should return data for Services', () => {
    // Database Service
    const databaseService = getDataAssetsHeaderInfo(
      EntityType.DATABASE_SERVICE,
      MOCK_DATABASE_SERVICE,
      'sample_data',
      []
    );

    expect(databaseService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(databaseService.extraInfo).toEqual([]);

    // Database
    const database = getDataAssetsHeaderInfo(
      EntityType.DATABASE,
      MOCK_DATABASE,
      'ecommerce_db',
      []
    );

    expect(database.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);
    expect(database.extraInfo).toEqual([]);

    // Database Schema
    const databaseSchema = getDataAssetsHeaderInfo(
      EntityType.DATABASE_SCHEMA,
      MOCK_DATABASE_SCHEMA,
      'shopify_schema',
      []
    );

    expect(databaseSchema.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(databaseSchema.extraInfo).toEqual([]);

    // Messaging Service
    const messagingService = getDataAssetsHeaderInfo(
      EntityType.MESSAGING_SERVICE,
      MOCK_MESSAGING_SERVICE,
      'sample_kafka',
      []
    );

    expect(messagingService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(messagingService.extraInfo).toEqual([]);

    // Dashboard Service
    const dashboardService = getDataAssetsHeaderInfo(
      EntityType.MESSAGING_SERVICE,
      MOCK_DASHBOARD_SERVICE,
      'sample_kafka',
      []
    );

    expect(dashboardService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(dashboardService.extraInfo).toEqual([]);

    // MlModel Service
    const mlModelService = getDataAssetsHeaderInfo(
      EntityType.MLMODEL_SERVICE,
      MOCK_ML_MODEL_SERVICE,
      'sample_kafka',
      []
    );

    expect(mlModelService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(mlModelService.extraInfo).toEqual([]);

    // Pipeline Service
    const pipelineService = getDataAssetsHeaderInfo(
      EntityType.PIPELINE_SERVICE,
      MOCK_PIPLELINE_SERVICE,
      'sample_airflow',
      []
    );

    expect(pipelineService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(pipelineService.extraInfo).toEqual([]);

    // Storage Service
    const storageService = getDataAssetsHeaderInfo(
      EntityType.STORAGE_SERVICE,
      MOCK_STORAGE_SERVICE,
      's3_storage_sample',
      []
    );

    expect(storageService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(storageService.extraInfo).toEqual([]);

    // Metadata Service
    const metaDataService = getDataAssetsHeaderInfo(
      EntityType.METADATA_SERVICE,
      MOCK_METADATA_SERVICE,
      'elasticsearch_sample',
      []
    );

    expect(metaDataService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(metaDataService.extraInfo).toEqual([]);

    // Search Service
    const searchService = getDataAssetsHeaderInfo(
      EntityType.SEARCH_SERVICE,
      MOCK_SEARCH_SERVICE,
      'elasticsearch_sample',
      []
    );

    expect(searchService.breadcrumbs).toEqual([
      { name: 'entityName', url: 'url' },
    ]);
    expect(searchService.extraInfo).toEqual([]);
  });
});

describe('ExtraInfoLabel', () => {
  it('should handle React node as value', () => {
    const nodeValue = (
      <Tooltip title="Full text value">
        <Typography ellipsis className="w-full">
          Truncated text value
        </Typography>
      </Tooltip>
    );

    const { container, getByText } = render(
      <ExtraInfoLabel label="MIME Type" value={nodeValue} />
    );

    expect(
      container.querySelector('.extra-info-container')
    ).toBeInTheDocument();
    expect(getByText('MIME Type')).toBeInTheDocument();
  });

  it('should not render the label element when label is empty', () => {
    const { queryByTestId, getByTestId } = render(
      <ExtraInfoLabel
        dataTestId="partition-info"
        label=""
        value="Non-partitioned"
      />
    );

    expect(queryByTestId('partition-info-label')).not.toBeInTheDocument();
    expect(getByTestId('partition-info')).toHaveTextContent('Non-partitioned');
  });

  it('should render the label element when label is provided', () => {
    const { getByTestId } = render(
      <ExtraInfoLabel dataTestId="size-info" label="Size" value="1 KB" />
    );

    expect(getByTestId('size-info-label')).toHaveTextContent('Size');
    expect(getByTestId('size-info')).toHaveTextContent('1 KB');
  });
});
