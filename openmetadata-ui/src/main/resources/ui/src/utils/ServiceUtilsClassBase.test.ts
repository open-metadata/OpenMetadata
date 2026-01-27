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
import { EntityType } from '../enums/entity.enum';
import { ExplorePageTabs } from '../enums/Explore.enum';
import serviceUtilClassBase, {
  ServiceUtilClassBase,
} from './ServiceUtilClassBase';

// Mock dependencies to avoid compilation errors
jest.mock('./CommonUtils', () => ({
  getEntityName: jest.fn(),
  getServiceLogo: jest.fn(),
}));

jest.mock(
  '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget',
  () => 'AgentsStatusWidget'
);
jest.mock(
  '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget',
  () => 'PlatformInsightsWidget'
);
jest.mock(
  '../components/ServiceInsights/TotalDataAssetsWidget/TotalDataAssetsWidget',
  () => 'TotalDataAssetsWidget'
);
jest.mock(
  '../components/Settings/Services/Ingestion/MetadataAgentsWidget/MetadataAgentsWidget',
  () => 'MetadataAgentsWidget'
);

jest.mock('./APIServiceUtils', () => ({ getAPIConfig: jest.fn() }));
jest.mock('./DashboardServiceUtils', () => ({ getDashboardConfig: jest.fn() }));
jest.mock('./DatabaseServiceUtils', () => ({ getDatabaseConfig: jest.fn() }));
jest.mock('./MessagingServiceUtils', () => ({ getMessagingConfig: jest.fn() }));
jest.mock('./MetadataServiceUtils', () => ({ getMetadataConfig: jest.fn() }));
jest.mock('./MlmodelServiceUtils', () => ({ getMlmodelConfig: jest.fn() }));
jest.mock('./PipelineServiceUtils', () => ({ getPipelineConfig: jest.fn() }));
jest.mock('./SearchServiceUtils', () => ({
  getSearchServiceConfig: jest.fn(),
}));
jest.mock('./SecurityServiceUtils', () => ({ getSecurityConfig: jest.fn() }));
jest.mock('./ServiceUtils', () => ({ getTestConnectionName: jest.fn() }));
jest.mock('./StorageServiceUtils', () => ({ getStorageConfig: jest.fn() }));
jest.mock('./StringsUtils', () => ({ customServiceComparator: jest.fn() }));

describe('ServiceUtilClassBase', () => {
  it('should create an instance of ServiceUtilClassBase', () => {
    expect(serviceUtilClassBase).toBeInstanceOf(ServiceUtilClassBase);
  });

  it('should return object wih key and value in lowercase for enum', () => {
    const originalEnum = {
      VALUE1: 'FirstValue',
      VALUE2: 'SecondValue',
      VALUE3: 'ThirdValue',
    };

    const result = serviceUtilClassBase.convertEnumToLowerCase<
      typeof originalEnum,
      typeof originalEnum
    >(originalEnum);

    expect(result).toEqual({
      VALUE1: 'firstvalue',
      VALUE2: 'secondvalue',
      VALUE3: 'thirdvalue',
    });
  });

  it('should handle an empty object', () => {
    const originalEnum = {};

    const result = serviceUtilClassBase.convertEnumToLowerCase<
      typeof originalEnum,
      typeof originalEnum
    >(originalEnum);

    expect(result).toEqual({});
  });

  // getDataAssetsService

  it('should return table tab if service type is database', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.DatabaseServiceTypeSmallCase.Clickhouse
    );

    expect(result).toEqual(ExplorePageTabs.TABLES);
  });

  it('should return topic tab if service type is messaging', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.MessagingServiceTypeSmallCase.Kafka
    );

    expect(result).toEqual(ExplorePageTabs.TOPICS);
  });

  it('should return dashboard tab if service type is dashboard', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.DashboardServiceTypeSmallCase.DomoDashboard
    );

    expect(result).toEqual(ExplorePageTabs.DASHBOARDS);
  });

  it('should return pipeline tab if service type is pipeline', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.PipelineServiceTypeSmallCase.Dagster
    );

    expect(result).toEqual(ExplorePageTabs.PIPELINES);
  });

  it('should return MlModel tab if service type is Ml Model', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.MlModelServiceTypeSmallCase.Mlflow
    );

    expect(result).toEqual(ExplorePageTabs.MLMODELS);
  });

  it('should return Container tab if service type is storage', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.StorageServiceTypeSmallCase.S3
    );

    expect(result).toEqual(ExplorePageTabs.CONTAINERS);
  });

  it('should return SearchIndex tab if service type is Search', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.SearchServiceTypeSmallCase.ElasticSearch
    );

    expect(result).toEqual(ExplorePageTabs.SEARCH_INDEX);
  });

  // getServiceTypeLogo tests
  describe('getServiceTypeLogo', () => {
    it('should return TagIcon for TAG entity when serviceType is empty', () => {
      const searchSource = {
        serviceType: '',
        entityType: EntityType.TAG,
        fullyQualifiedName: 'test.tag',
        name: 'test',
        tag_id: 'tag123',
        tag_name: 'test',
      };

      const result = serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(result).toEqual({ ReactComponent: 'svg-mock' });
    });

    it('should return GlossaryIcon for GLOSSARY_TERM entity when serviceType is empty', () => {
      const searchSource = {
        serviceType: '',
        entityType: EntityType.GLOSSARY_TERM,
        fullyQualifiedName: 'test.glossary',
        name: 'test',
        glossary_id: 'glossary123',
        glossary_name: 'test',
      };

      const result = serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(result).toEqual({ ReactComponent: 'svg-mock' });
    });

    it('should return DatabaseIcon for DATABASE entity when serviceType is empty', () => {
      const searchSource = {
        serviceType: '',
        entityType: EntityType.DATABASE,
        fullyQualifiedName: 'test.database',
        name: 'test',
        database_id: 'db123',
        database_name: 'test',
      };

      const result = serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(result).toEqual({ ReactComponent: 'svg-mock' });
    });

    it('should return DatabaseSchemaIcon for DATABASE_SCHEMA entity when serviceType is empty', () => {
      const searchSource = {
        serviceType: '',
        entityType: EntityType.DATABASE_SCHEMA,
        fullyQualifiedName: 'test.schema',
        name: 'test',
        database_schema_id: 'schema123',
        database_schema_name: 'test',
      };

      const result = serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(result).toEqual({ ReactComponent: 'svg-mock' });
    });

    it('should return MetricIcon for METRIC entity when serviceType is empty', () => {
      const searchSource = {
        serviceType: '',
        entityType: EntityType.METRIC,
        fullyQualifiedName: 'test.metric',
        name: 'test',
        metric_id: 'metric123',
        metric_name: 'test',
      };

      const result = serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(result).toEqual({ ReactComponent: 'svg-mock' });
    });

    it('should return DataProductIcon for DATA_PRODUCT entity when serviceType is empty', () => {
      const searchSource = {
        serviceType: '',
        entityType: EntityType.DATA_PRODUCT,
        fullyQualifiedName: 'test.dataproduct',
        name: 'test',
        data_product_id: 'dp123',
        data_product_name: 'test',
      };

      const result = serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(result).toEqual({ ReactComponent: 'svg-mock' });
    });

    it('should call getServiceLogo when serviceType is present', () => {
      const searchSource = {
        serviceType: 'BigQuery',
        entityType: EntityType.TABLE,
        fullyQualifiedName: 'test.table',
        name: 'test',
        table_id: 'table123',
        table_name: 'test',
      };

      const getServiceLogoSpy = jest.spyOn(
        serviceUtilClassBase,
        'getServiceLogo'
      );

      serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(getServiceLogoSpy).toHaveBeenCalledWith('BigQuery');

      getServiceLogoSpy.mockRestore();
    });

    it('should call getServiceLogo for unknown entity types when serviceType is empty', () => {
      const searchSource = {
        serviceType: '',
        entityType: 'UNKNOWN_ENTITY' as EntityType,
        fullyQualifiedName: 'test.unknown',
        name: 'test',
      };

      const getServiceLogoSpy = jest.spyOn(
        serviceUtilClassBase,
        'getServiceLogo'
      );

      serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(getServiceLogoSpy).toHaveBeenCalledWith('');

      getServiceLogoSpy.mockRestore();
    });

    it('should handle missing serviceType and entityType properties', () => {
      const searchSource = {
        fullyQualifiedName: 'test.entity',
        name: 'test',
      };

      const result = serviceUtilClassBase.getServiceTypeLogo(searchSource);

      expect(result).toBeDefined();
    });
  });
});
