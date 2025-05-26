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

import React from 'react';
import { EntityType } from '../enums/entity.enum';
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
  getDataAssetsHeaderInfo,
  getEntityExtraInfoLength,
} from './DataAssetsHeader.utils';

jest.mock('./DataAssetsHeader.utils', () => ({
  ...jest.requireActual('./DataAssetsHeader.utils'),
  ExtraInfoLabel: jest.fn().mockImplementation(({ value }) => value),
  ExtraInfoLink: jest.fn().mockImplementation(({ value }) => value),
}));
jest.mock('./EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('entityName'),
  getEntityBreadcrumbs: jest.fn().mockReturnValue([
    {
      name: 'entityName',
      url: 'url',
    },
  ]),
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
}));

jest.mock('./StringsUtils', () => ({
  getEncodedFqn: jest.fn().mockImplementation((fqn) => fqn),
  bytesToSize: jest.fn().mockReturnValue('bytesToSize'),
}));

jest.mock('./TableUtils', () => ({
  getUsagePercentile: jest.fn().mockReturnValue('getUsagePercentile'),
}));

jest.mock('../constants/constants', () => ({
  ...jest.requireActual('../constants/constants'),
  NO_DATA_PLACEHOLDER: jest.fn().mockReturnValue('---'),
  getEntityDetailsPath: jest.fn().mockReturnValue('getDashboardDetailsPath'),
}));

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

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.type');
    expect(JSON.stringify(assetData.extraInfo)).toContain('Regular');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.usage');
    expect(JSON.stringify(assetData.extraInfo)).toContain('getUsagePercentile');

    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'label.column-plural'
    );
    expect(JSON.stringify(assetData.extraInfo)).toContain('12');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.row-plural');
    expect(JSON.stringify(assetData.extraInfo)).toContain('14567');

    //  If Data does not present
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.TABLE,
      {
        ...MOCK_TABLE,
        tableType: undefined,
        retentionPeriod: undefined,
        usageSummary: undefined,
        profile: undefined,
      },
      'Redshift',
      []
    );

    // contains all extra data

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.type'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'Regular'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.usage'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'getUsagePercentile'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.column-plural'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain('12');

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.row-plural'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      '14567'
    );
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
    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'label.partition-plural'
    );
    expect(JSON.stringify(assetData.extraInfo)).toContain('128');

    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'label.replication-factor'
    );
    expect(JSON.stringify(assetData.extraInfo)).toContain('4');

    //  If Data does not present
    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.TOPIC,
      { ...mockTopicData, partitions: undefined, replicationFactor: undefined },
      'customer_contacts',
      []
    );

    // contains all extra data
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.partition-plural'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain('128');

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.replication-factor'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain('4');
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
    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'label.entity-type-plural'
    );
    expect(JSON.stringify(assetData.extraInfo)).toContain('Dashboard');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.project');
    expect(JSON.stringify(assetData.extraInfo)).toContain('workspace');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.usage');
    expect(JSON.stringify(assetData.extraInfo)).toContain('getUsagePercentile');

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
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.entity-type-plural'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'Dashboard'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.project'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'workspace'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.usage'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'getUsagePercentile'
    );
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
    expect(JSON.stringify(assetData.extraInfo)).toContain('label.algorithm');
    expect(JSON.stringify(assetData.extraInfo)).toContain('Neural Network');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.target');
    expect(JSON.stringify(assetData.extraInfo)).toContain('ETA_time');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.server');
    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'http://my-server.ai'
    );

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.dashboard');
    expect(JSON.stringify(assetData.extraInfo)).toContain('forecast_sales');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.usage');
    expect(JSON.stringify(assetData.extraInfo)).toContain('getUsagePercentile');

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

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.algorithm'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'Neural Network'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.target'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'ETA_time'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.server'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'http://my-server.ai'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.dashboard'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'forecast_sales'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.usage'
    );
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'getUsagePercentile'
    );
  });

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
    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'label.non-partitioned'
    );

    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'label.number-of-object-plural'
    );
    expect(JSON.stringify(assetData.extraInfo)).toContain('10');

    expect(JSON.stringify(assetData.extraInfo)).toContain('label.size');
    expect(JSON.stringify(assetData.extraInfo)).toContain('bytesToSize');

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

    expect(JSON.stringify(assetWithZeroData.extraInfo)).toContain(
      'label.number-of-object-plural'
    );

    expect(JSON.stringify(assetWithZeroData.extraInfo)).toContain('label.size');

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
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).toContain(
      'label.partitioned'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'http://localhost:8585/api/v1/databaseSchemas/48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.number-of-object-plural'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.size'
    );
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
    expect(JSON.stringify(assetData.extraInfo)).toContain(
      'label.data-model-type'
    );

    expect(JSON.stringify(assetData.extraInfo)).toContain('LookMlExplore');
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
    expect(JSON.stringify(assetData.extraInfo)).toContain('label.language');
    expect(JSON.stringify(assetData.extraInfo)).toContain('SQL');

    //  If Data does not present

    const assetWithNoExtraData = getDataAssetsHeaderInfo(
      EntityType.STORED_PROCEDURE,
      { ...mockStoredProcedureData[0], sourceUrl: '', storedProcedureCode: '' },
      'update_dim_address_table',
      []
    );

    // contains extra data
    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'label.language'
    );

    expect(JSON.stringify(assetWithNoExtraData.extraInfo)).not.toContain(
      'http://localhost:8585/api/v1/databaseSchemas/48261b8c-4c99-4c5d-9ec7-cb758cc9f9c1'
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
    expect(assetData.extraInfo).toEqual(<React.Fragment />);
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
    expect(databaseService.extraInfo).toEqual(<React.Fragment />);

    // Database
    const database = getDataAssetsHeaderInfo(
      EntityType.DATABASE,
      MOCK_DATABASE,
      'ecommerce_db',
      []
    );

    expect(database.breadcrumbs).toEqual([{ name: 'entityName', url: 'url' }]);
    expect(database.extraInfo).toEqual(<React.Fragment />);

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
    expect(databaseSchema.extraInfo).toEqual(<React.Fragment />);

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
    expect(messagingService.extraInfo).toEqual(<React.Fragment />);

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
    expect(dashboardService.extraInfo).toEqual(<React.Fragment />);

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
    expect(mlModelService.extraInfo).toEqual(<React.Fragment />);

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
    expect(pipelineService.extraInfo).toEqual(<React.Fragment />);

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
    expect(storageService.extraInfo).toEqual(<React.Fragment />);

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
    expect(metaDataService.extraInfo).toEqual(<React.Fragment />);

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
    expect(searchService.extraInfo).toEqual(<React.Fragment />);
  });
});

describe('getEntityExtraInfoLength', () => {
  it('should return 0 for non-React elements', () => {
    expect(getEntityExtraInfoLength(null)).toBe(0);
    expect(getEntityExtraInfoLength(undefined)).toBe(0);
    expect(getEntityExtraInfoLength('string')).toBe(0);
    expect(getEntityExtraInfoLength(123)).toBe(0);
  });

  it('should return 0 for React elements without children', () => {
    const element = <div />;

    expect(getEntityExtraInfoLength(element)).toBe(0);
  });

  it('should return 0 for React elements with non-array children', () => {
    const element = <div>Single child</div>;

    expect(getEntityExtraInfoLength(element)).toBe(0);
  });

  it('should count non-null/undefined children in array', () => {
    const element = (
      <div>
        {null}
        <span>Child 1</span>
        {undefined}
        <span>Child 2</span>
        <span>Child 3</span>
      </div>
    );

    expect(getEntityExtraInfoLength(element)).toBe(3);
  });

  it('should handle nested elements correctly', () => {
    const element = (
      <div>
        <span>Child 1</span>
        <div>
          <span>Nested Child</span>
        </div>
        <span>Child 3</span>
      </div>
    );

    expect(getEntityExtraInfoLength(element)).toBe(3);
  });

  it('should handle empty array of children', () => {
    const element = <div>{[]}</div>;

    expect(getEntityExtraInfoLength(element)).toBe(0);
  });

  it('should handle fragments', () => {
    const element = (
      <>
        <span>Child 1</span>
        <span>Child 2</span>
      </>
    );

    expect(getEntityExtraInfoLength(element)).toBe(2);
  });

  it('should handle conditional rendering', () => {
    const showExtra = true;
    const element = (
      <div>
        <span>Always shown</span>
        {showExtra && <span>Conditional child</span>}
        {false && <span>Never shown</span>}
        {null}
        {undefined}
      </div>
    );

    expect(getEntityExtraInfoLength(element)).toBe(2);
  });
});
