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

import { act, render, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { ServiceCategoryPlural } from '../../../enums/service.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { MOCK_TAG_DATA, MOCK_TAG_ENCODED_FQN } from '../../../mocks/Tags.mock';
import { getAlertsFromName } from '../../../rest/alertsAPI';
import { getApiCollectionByFQN } from '../../../rest/apiCollectionsAPI';
import { getApiEndPointByFQN } from '../../../rest/apiEndpointsAPI';
import { getApplicationByName } from '../../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../../rest/applicationMarketPlaceAPI';
import { getChartByFqn } from '../../../rest/chartsAPI';
import { getContract } from '../../../rest/contractAPI';
import { getDataProductByName } from '../../../rest/dataProductAPI';
import { getDomainByName } from '../../../rest/domainAPI';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
} from '../../../rest/glossaryAPI';
import { getIngestionPipelineByFqn } from '../../../rest/ingestionPipelineAPI';
import { getKPIByName } from '../../../rest/KpiAPI';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { getMetricByFqn } from '../../../rest/metricsAPI';
import { getPersonaByName } from '../../../rest/PersonaAPI';
import { getQueryByFqn } from '../../../rest/queryAPI';
import { getPolicyByName, getRoleByName } from '../../../rest/rolesAPIV1';
import { getSearchIndexDetailsByFQN } from '../../../rest/SearchIndexAPI';
import { getServiceByFQN } from '../../../rest/serviceAPI';
import { getTagByFqn } from '../../../rest/tagAPI';
import { getTeamByName } from '../../../rest/teamsAPI';
import { getTestCaseByFqn, getTestSuiteByName } from '../../../rest/testAPI';
import { getBotByName, getUserByName } from '../../../rest/userAPI';
import EntityPopOverCard, { PopoverContent } from './EntityPopOverCard';

const updateCachedEntityData = jest.fn();

jest.mock('../../../utils/CommonUtils', () => ({
  getTableFQNFromColumnFQN: jest.fn(),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../../utils/StringsUtils', () => ({
  getDecodedFqn: jest.fn(),
  getEncodedFqn: jest.fn(),
}));

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

jest.mock('../../ExploreV1/ExploreSearchCard/ExploreSearchCard', () => {
  return jest.fn().mockImplementation(() => <p>ExploreSearchCard</p>);
});

jest.mock('../../../rest/dashboardAPI', () => ({
  getDashboardByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/dataModelsAPI', () => ({
  getDataModelDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/dataProductAPI', () => ({
  getDataProductByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/databaseAPI', () => ({
  getDatabaseDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  getDatabaseSchemaDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/domainAPI', () => ({
  getDomainByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossariesByName: jest.fn().mockImplementation(() => Promise.resolve({})),
  getGlossaryTermByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/mlModelAPI', () => ({
  getMlModelByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/pipelineAPI', () => ({
  getPipelineByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/storageAPI', () => ({
  getContainerByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/storedProceduresAPI', () => ({
  getStoredProceduresDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/tableAPI', () => ({
  getTableDetailsByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/tagAPI', () => ({
  getTagByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/topicsAPI', () => ({
  getTopicByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/alertsAPI', () => ({
  getAlertsFromName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/apiCollectionsAPI', () => ({
  getApiCollectionByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/apiEndpointsAPI', () => ({
  getApiEndPointByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/applicationAPI', () => ({
  getApplicationByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/chartsAPI', () => ({
  getChartByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/contractAPI', () => ({
  getContract: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/KpiAPI', () => ({
  getKPIByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/metricsAPI', () => ({
  getMetricByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/PersonaAPI', () => ({
  getPersonaByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getPolicyByName: jest.fn().mockImplementation(() => Promise.resolve({})),
  getRoleByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/SearchIndexAPI', () => ({
  getSearchIndexDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/testAPI', () => ({
  getTestCaseByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
  getTestSuiteByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/teamsAPI', () => ({
  getTeamByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/userAPI', () => ({
  getBotByName: jest.fn().mockImplementation(() => Promise.resolve({})),
  getUserByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/queryAPI', () => ({
  getQueryByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    cachedEntityData: {},
    updateCachedEntityData,
  })),
}));

describe('Test EntityPopoverCard component', () => {
  beforeEach(() => {
    updateCachedEntityData.mockClear();

    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      cachedEntityData: {},
      updateCachedEntityData,
    }));
  });

  it('EntityPopoverCard should render element', () => {
    render(
      <EntityPopOverCard
        entityFQN={MOCK_TAG_ENCODED_FQN}
        entityType={EntityType.TAG}>
        <div data-testid="popover-container">Test_Popover</div>
      </EntityPopOverCard>
    );

    expect(screen.getByTestId('popover-container')).toBeInTheDocument();
  });

  it('EntityPopoverCard should render loader on initial render', async () => {
    render(
      <PopoverContent
        entityFQN={MOCK_TAG_ENCODED_FQN}
        entityType={EntityType.TAG}
      />
    );

    const loader = screen.getByText('Loader');

    expect(loader).toBeInTheDocument();
  });

  it("EntityPopoverCard should show no data placeholder if entity type doesn't match", async () => {
    await act(async () => {
      render(
        <PopoverContent
          entityFQN={MOCK_TAG_ENCODED_FQN}
          entityType={EntityType.APPLICATION}
        />
      );
    });

    expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
  });

  it('EntityPopoverCard should show no data placeholder if api call fail', async () => {
    (getTagByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data: { message: 'Error!' },
        },
      })
    );

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={MOCK_TAG_ENCODED_FQN}
          entityType={EntityType.TAG}
        />
      );
    });

    expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
  });

  it('EntityPopoverCard should call tags api if entity type is tag card', async () => {
    const mockTagAPI = getTagByFqn as jest.Mock;

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={MOCK_TAG_ENCODED_FQN}
          entityType={EntityType.TAG}
        />
      );
    });

    expect(mockTagAPI.mock.calls[0][0]).toBe(MOCK_TAG_ENCODED_FQN);
  });

  it('EntityPopoverCard should call api and trigger updateCachedEntityData in provider', async () => {
    const mockTagAPI = getTagByFqn as jest.Mock;

    (getTagByFqn as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(MOCK_TAG_DATA)
    );

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={MOCK_TAG_ENCODED_FQN}
          entityType={EntityType.TAG}
        />
      );
    });

    expect(mockTagAPI.mock.calls[0][0]).toBe(MOCK_TAG_ENCODED_FQN);

    expect(updateCachedEntityData).toHaveBeenCalledWith({
      id: MOCK_TAG_ENCODED_FQN,
      entityDetails: MOCK_TAG_DATA,
    });
  });

  it('EntityPopoverCard should not call api if cached data is available', async () => {
    const mockTagAPI = getTagByFqn as jest.Mock;

    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      cachedEntityData: {
        [MOCK_TAG_ENCODED_FQN]: {
          name: 'test',
        },
      },
    }));

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={MOCK_TAG_ENCODED_FQN}
          entityType={EntityType.TAG}
        />
      );
    });

    expect(mockTagAPI.mock.calls).toEqual([]);
    expect(screen.getByText('ExploreSearchCard')).toBeInTheDocument();
  });

  it('EntityPopoverCard should call bot API if entity type is BOT', async () => {
    const mockBotFQN = 'test-bot';

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockBotFQN} entityType={EntityType.BOT} />
      );
    });

    expect(getBotByName).toHaveBeenCalledWith(mockBotFQN, {
      fields: [EntityType.BOT],
    });
  });

  it('EntityPopoverCard should call alerts API if entity type is EVENT_SUBSCRIPTION', async () => {
    const mockAlertFQN = 'test-alert';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockAlertFQN}
          entityType={EntityType.EVENT_SUBSCRIPTION}
        />
      );
    });

    expect(getAlertsFromName).toHaveBeenCalledWith(mockAlertFQN);
  });

  it('EntityPopoverCard should call bot API and trigger updateCachedEntityData', async () => {
    const mockBotFQN = 'test-bot';
    const mockBotData = { id: 'bot-id', name: 'test-bot' };

    (getBotByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockBotData)
    );

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockBotFQN} entityType={EntityType.BOT} />
      );
    });

    expect(getBotByName).toHaveBeenCalledWith(mockBotFQN, {
      fields: [EntityType.BOT],
    });
    expect(updateCachedEntityData).toHaveBeenCalledWith({
      id: mockBotFQN,
      entityDetails: mockBotData,
    });
  });

  it('EntityPopoverCard should call alerts API and trigger updateCachedEntityData', async () => {
    const mockAlertFQN = 'test-alert';
    const mockAlertData = { id: 'alert-id', name: 'test-alert' };

    (getAlertsFromName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockAlertData)
    );

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockAlertFQN}
          entityType={EntityType.EVENT_SUBSCRIPTION}
        />
      );
    });

    expect(getAlertsFromName).toHaveBeenCalledWith(mockAlertFQN);
    expect(updateCachedEntityData).toHaveBeenCalledWith({
      id: mockAlertFQN,
      entityDetails: mockAlertData,
    });
  });

  it('EntityPopoverCard should call role API if entity type is ROLE', async () => {
    const mockRoleFQN = 'test-role';

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockRoleFQN} entityType={EntityType.ROLE} />
      );
    });

    expect(getRoleByName).toHaveBeenCalledWith(mockRoleFQN, '');
  });

  it('EntityPopoverCard should call role API and trigger updateCachedEntityData', async () => {
    const mockRoleFQN = 'test-role';
    const mockRoleData = { id: 'role-id', name: 'test-role' };

    (getRoleByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockRoleData)
    );

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockRoleFQN} entityType={EntityType.ROLE} />
      );
    });

    expect(getRoleByName).toHaveBeenCalledWith(mockRoleFQN, '');
    expect(updateCachedEntityData).toHaveBeenCalledWith({
      id: mockRoleFQN,
      entityDetails: mockRoleData,
    });
  });

  it('EntityPopoverCard should call policy API if entity type is POLICY', async () => {
    const mockPolicyFQN = 'test-policy';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockPolicyFQN}
          entityType={EntityType.POLICY}
        />
      );
    });

    expect(getPolicyByName).toHaveBeenCalledWith(mockPolicyFQN, '');
  });

  it('EntityPopoverCard should call policy API and trigger updateCachedEntityData', async () => {
    const mockPolicyFQN = 'test-policy';
    const mockPolicyData = { id: 'policy-id', name: 'test-policy' };

    (getPolicyByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(mockPolicyData)
    );

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockPolicyFQN}
          entityType={EntityType.POLICY}
        />
      );
    });

    expect(getPolicyByName).toHaveBeenCalledWith(mockPolicyFQN, '');
    expect(updateCachedEntityData).toHaveBeenCalledWith({
      id: mockPolicyFQN,
      entityDetails: mockPolicyData,
    });
  });

  it('EntityPopoverCard should call service API for all service types', async () => {
    const serviceTypes = [
      EntityType.DATABASE_SERVICE,
      EntityType.MESSAGING_SERVICE,
      EntityType.DASHBOARD_SERVICE,
      EntityType.PIPELINE_SERVICE,
      EntityType.MLMODEL_SERVICE,
      EntityType.STORAGE_SERVICE,
      EntityType.SEARCH_SERVICE,
      EntityType.API_SERVICE,
      EntityType.SECURITY_SERVICE,
      EntityType.METADATA_SERVICE,
      EntityType.SERVICE,
    ];

    for (const serviceType of serviceTypes) {
      const mockServiceFQN = `test-${serviceType}`;

      await act(async () => {
        render(
          <PopoverContent entityFQN={mockServiceFQN} entityType={serviceType} />
        );
      });

      const expectedServiceType =
        serviceType === EntityType.SERVICE
          ? serviceType
          : ServiceCategoryPlural[
              serviceType as keyof typeof ServiceCategoryPlural
            ];

      expect(getServiceByFQN).toHaveBeenCalledWith(
        expectedServiceType,
        mockServiceFQN
      );
    }
  });

  it('EntityPopoverCard should call type API if entity type is TYPE', async () => {
    const mockTypeFQN = 'test-type';

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockTypeFQN} entityType={EntityType.TYPE} />
      );
    });

    expect(getTypeByFQN).toHaveBeenCalledWith(mockTypeFQN);
  });

  it('EntityPopoverCard should call team API if entity type is TEAM', async () => {
    const mockTeamFQN = 'test-team';

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockTeamFQN} entityType={EntityType.TEAM} />
      );
    });

    expect(getTeamByName).toHaveBeenCalledWith(mockTeamFQN);
  });

  it('EntityPopoverCard should call user API if entity type is USER', async () => {
    const mockUserFQN = 'test-user';

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockUserFQN} entityType={EntityType.USER} />
      );
    });

    expect(getUserByName).toHaveBeenCalledWith(mockUserFQN);
  });

  it('EntityPopoverCard should call test suite API if entity type is TEST_SUITE', async () => {
    const mockTestSuiteFQN = 'test-test-suite';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockTestSuiteFQN}
          entityType={EntityType.TEST_SUITE}
        />
      );
    });

    expect(getTestSuiteByName).toHaveBeenCalledWith(mockTestSuiteFQN);
  });

  it('EntityPopoverCard should call KPI API if entity type is KPI', async () => {
    const mockKPIFQN = 'test-kpi';

    await act(async () => {
      render(
        <PopoverContent entityFQN={mockKPIFQN} entityType={EntityType.KPI} />
      );
    });

    expect(getKPIByName).toHaveBeenCalledWith(mockKPIFQN);
  });

  it('EntityPopoverCard should call search index API if entity type is SEARCH_INDEX', async () => {
    const mockSearchIndexFQN = 'test-search-index';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockSearchIndexFQN}
          entityType={EntityType.SEARCH_INDEX}
        />
      );
    });

    expect(getSearchIndexDetailsByFQN).toHaveBeenCalledWith(mockSearchIndexFQN);
  });

  it('EntityPopoverCard should call market place application API if entity type is APP_MARKET_PLACE_DEFINITION', async () => {
    const mockAppFQN = 'test-app-market-place';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockAppFQN}
          entityType={EntityType.APP_MARKET_PLACE_DEFINITION}
        />
      );
    });

    expect(getMarketPlaceApplicationByFqn).toHaveBeenCalledWith(mockAppFQN);
  });

  it('EntityPopoverCard should call application API if entity type is APPLICATION', async () => {
    const mockAppFQN = 'test-application';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockAppFQN}
          entityType={EntityType.APPLICATION}
        />
      );
    });

    expect(getApplicationByName).toHaveBeenCalledWith(mockAppFQN);
  });

  it('EntityPopoverCard should call persona API if entity type is PERSONA', async () => {
    const mockPersonaFQN = 'test-persona';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockPersonaFQN}
          entityType={EntityType.PERSONA}
        />
      );
    });

    expect(getPersonaByName).toHaveBeenCalledWith(mockPersonaFQN);
  });

  it('EntityPopoverCard should call ingestion pipeline API if entity type is INGESTION_PIPELINE', async () => {
    const mockIngestionPipelineFQN = 'test-ingestion-pipeline';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockIngestionPipelineFQN}
          entityType={EntityType.INGESTION_PIPELINE}
        />
      );
    });

    expect(getIngestionPipelineByFqn).toHaveBeenCalledWith(
      mockIngestionPipelineFQN
    );
  });

  it('EntityPopoverCard should call contract API if entity type is DATA_CONTRACT', async () => {
    const mockContractFQN = 'test-data-contract';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockContractFQN}
          entityType={EntityType.DATA_CONTRACT}
        />
      );
    });

    expect(getContract).toHaveBeenCalledWith(mockContractFQN);
  });

  it('EntityPopoverCard should call query API if entity type is QUERY', async () => {
    const mockQueryFQN = 'test-query';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockQueryFQN}
          entityType={EntityType.QUERY}
        />
      );
    });

    expect(getQueryByFqn).toHaveBeenCalledWith(mockQueryFQN);
  });

  it('EntityPopoverCard should call API collection API if entity type is API_COLLECTION', async () => {
    const mockApiCollectionFQN = 'test-api-collection';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockApiCollectionFQN}
          entityType={EntityType.API_COLLECTION}
        />
      );
    });

    expect(getApiCollectionByFQN).toHaveBeenCalledWith(
      mockApiCollectionFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call API endpoint API if entity type is API_ENDPOINT', async () => {
    const mockApiEndpointFQN = 'test-api-endpoint';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockApiEndpointFQN}
          entityType={EntityType.API_ENDPOINT}
        />
      );
    });

    expect(getApiEndPointByFQN).toHaveBeenCalledWith(
      mockApiEndpointFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call metric API if entity type is METRIC', async () => {
    const mockMetricFQN = 'test-metric';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockMetricFQN}
          entityType={EntityType.METRIC}
        />
      );
    });

    expect(getMetricByFqn).toHaveBeenCalledWith(
      mockMetricFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call chart API if entity type is CHART', async () => {
    const mockChartFQN = 'test-chart';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockChartFQN}
          entityType={EntityType.CHART}
        />
      );
    });

    expect(getChartByFqn).toHaveBeenCalledWith(
      mockChartFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call domain API if entity type is DOMAIN', async () => {
    const mockDomainFQN = 'test-domain';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockDomainFQN}
          entityType={EntityType.DOMAIN}
        />
      );
    });

    expect(getDomainByName).toHaveBeenCalledWith(
      mockDomainFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call data product API if entity type is DATA_PRODUCT', async () => {
    const mockDataProductFQN = 'test-data-product';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockDataProductFQN}
          entityType={EntityType.DATA_PRODUCT}
        />
      );
    });

    expect(getDataProductByName).toHaveBeenCalledWith(
      mockDataProductFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call glossary API if entity type is GLOSSARY', async () => {
    const mockGlossaryFQN = 'test-glossary';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockGlossaryFQN}
          entityType={EntityType.GLOSSARY}
        />
      );
    });

    expect(getGlossariesByName).toHaveBeenCalledWith(
      mockGlossaryFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call glossary term API if entity type is GLOSSARY_TERM', async () => {
    const mockGlossaryTermFQN = 'test-glossary-term';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockGlossaryTermFQN}
          entityType={EntityType.GLOSSARY_TERM}
        />
      );
    });

    expect(getGlossaryTermByFQN).toHaveBeenCalledWith(
      mockGlossaryTermFQN,
      expect.any(Object)
    );
  });

  it('EntityPopoverCard should call test case API if entity type is TEST_CASE', async () => {
    const mockTestCaseFQN = 'test-test-case';

    await act(async () => {
      render(
        <PopoverContent
          entityFQN={mockTestCaseFQN}
          entityType={EntityType.TEST_CASE}
        />
      );
    });

    expect(getTestCaseByFqn).toHaveBeenCalledWith(
      mockTestCaseFQN,
      expect.any(Object)
    );
  });
});
