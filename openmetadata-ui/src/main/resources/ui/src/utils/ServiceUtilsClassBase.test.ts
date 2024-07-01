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
import { ExplorePageTabs } from '../enums/Explore.enum';
import serviceUtilClassBase, {
  ServiceUtilClassBase,
} from './ServiceUtilClassBase';

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
});
