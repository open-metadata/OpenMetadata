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
import { ServiceCategory } from '../enums/service.enum';
import { ServiceType } from '../generated/entity/services/serviceType';
import { ServicesType } from '../interface/service.interface';
import { getTestConnectionName } from './ServicePureUtils';
import serviceUtilClassBase, {
  ServiceUtilClassBase,
} from './ServiceUtilClassBase';

jest.mock('./ServiceIconUtils', () => ({
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

jest.mock('./APIServiceUtils', () => ({
  getAPIConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./DashboardServiceUtils', () => ({
  getDashboardConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./DatabaseServiceUtils', () => ({
  getDatabaseConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./MessagingServiceUtils', () => ({
  getMessagingConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./MetadataServiceUtils', () => ({
  getMetadataConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./MlmodelServiceUtils', () => ({
  getMlmodelConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./PipelineServiceUtils', () => ({
  getPipelineConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./SearchServiceUtils', () => ({
  getSearchServiceConfig: jest
    .fn()
    .mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./SecurityServiceUtils', () => ({
  getSecurityConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./ServicePureUtils', () => ({ getTestConnectionName: jest.fn() }));
jest.mock('./StorageServiceUtils', () => ({
  getStorageConfig: jest.fn().mockResolvedValue({ schema: {}, uiSchema: {} }),
}));
jest.mock('./StringUtils', () => ({ customServiceComparator: jest.fn() }));

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

  it('should return table tab if service type is database', () => {
    const result = serviceUtilClassBase.getDataAssetsService(
      serviceUtilClassBase.DatabaseServiceTypeSmallCase.Clickhouse
    );

    expect(result).toEqual(ExplorePageTabs.TABLES);
  });

  it.each([
    {
      connectionType: 'Snowflake',
      serviceType: ServiceType.Database,
      serviceName: 'snowflake_prod',
      configData: {
        type: 'Snowflake',
        account: 'org-account',
        username: 'openmetadata',
        password: 'secret',
      },
    },
    {
      connectionType: 'Snowflake',
      serviceType: ServiceType.Database,
      serviceName: 'snowflake_keypair',
      configData: {
        type: 'Snowflake',
        account: 'org-account',
        username: 'openmetadata',
        privateKey: 'pem',
        snowflakePrivatekeyPassphrase: 'phrase',
      },
    },
    {
      connectionType: 'Mysql',
      serviceType: ServiceType.Database,
      serviceName: 'mysql_iam',
      configData: {
        type: 'Mysql',
        hostPort: 'localhost:3306',
        authType: {
          awsConfig: {
            awsAccessKeyId: 'access-key',
            awsSecretAccessKey: 'secret-key',
            awsRegion: 'us-east-1',
          },
        },
      },
    },
    {
      connectionType: 'Kinesis',
      serviceType: ServiceType.Messaging,
      serviceName: 'kinesis_prod',
      configData: {
        type: 'Kinesis',
        awsConfig: {
          awsAccessKeyId: 'access-key',
          awsSecretAccessKey: 'secret-key',
          awsRegion: 'us-east-1',
        },
      },
    },
  ])(
    'builds backend test connection workflow payload for $connectionType $serviceName',
    ({ connectionType, serviceType, serviceName, configData }) => {
      (getTestConnectionName as jest.Mock).mockReturnValueOnce(
        `${serviceName}_test_connection`
      );

      expect(
        serviceUtilClassBase.getAddWorkflowData(
          connectionType,
          serviceType,
          serviceName,
          configData
        )
      ).toEqual({
        name: `${serviceName}_test_connection`,
        workflowType: 'TEST_CONNECTION',
        request: {
          connection: {
            config: configData,
          },
          serviceType,
          connectionType,
          serviceName,
        },
      });
    }
  );

  describe('getExtraIngestionMenuItems', () => {
    it('returns empty array when called with only serviceCategory', () => {
      const result = serviceUtilClassBase.getExtraIngestionMenuItems(
        ServiceCategory.DATABASE_SERVICES
      );

      expect(result).toEqual([]);
    });

    it('returns empty array when called with serviceCategory, serviceName and navigate', () => {
      const result = serviceUtilClassBase.getExtraIngestionMenuItems(
        ServiceCategory.DATABASE_SERVICES,
        'my-service',
        jest.fn()
      );

      expect(result).toEqual([]);
    });

    it('returns empty array when serviceDetails is provided', () => {
      const serviceDetails = {
        serviceType: 'Snowflake',
        connection: {
          config: {
            type: 'Snowflake',
            policyAgentConfig: { enabled: true },
          },
        },
      } as unknown as ServicesType;

      const result = serviceUtilClassBase.getExtraIngestionMenuItems(
        ServiceCategory.DATABASE_SERVICES,
        'my-snowflake-service',
        jest.fn(),
        serviceDetails
      );

      expect(result).toEqual([]);
    });

    it('allows a subclass override to receive and use serviceDetails', () => {
      class TestOverride extends ServiceUtilClassBase {
        public getExtraIngestionMenuItems(
          _serviceCategory: ServiceCategory,
          _serviceName?: string,
          _navigate?: (path: string) => void,
          serviceDetails?: ServicesType
        ) {
          const config = (
            serviceDetails as {
              connection?: {
                config?: { policyAgentConfig?: { enabled?: boolean } };
              };
            }
          )?.connection?.config;
          const enabled = config?.policyAgentConfig?.enabled;

          return enabled ? [{ key: 'custom-item', label: 'Custom' }] : [];
        }
      }

      const override = new TestOverride();

      const withEnabled = override.getExtraIngestionMenuItems(
        ServiceCategory.DATABASE_SERVICES,
        'svc',
        jest.fn(),
        {
          connection: { config: { policyAgentConfig: { enabled: true } } },
        } as unknown as ServicesType
      );

      const withDisabled = override.getExtraIngestionMenuItems(
        ServiceCategory.DATABASE_SERVICES,
        'svc',
        jest.fn(),
        {
          connection: { config: { policyAgentConfig: { enabled: false } } },
        } as unknown as ServicesType
      );

      expect(withEnabled).toHaveLength(1);
      expect(withDisabled).toHaveLength(0);
    });
  });
});
