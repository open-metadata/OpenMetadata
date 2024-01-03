/*
 *  Copyright 2022 Collate.
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
import React from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { MOCK_TAG_ENCODED_FQN } from '../../../mocks/Tags.mock';
import { getTagByName } from '../../../rest/tagAPI';
import { useApplicationConfigContext } from '../../ApplicationConfigProvider/ApplicationConfigProvider';
import EntityPopOverCard, { PopoverContent } from './EntityPopOverCard';

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

jest.mock('../../Loader/Loader', () => {
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
  getTagByName: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../../rest/topicsAPI', () => ({
  getTopicByFqn: jest.fn().mockImplementation(() => Promise.resolve({})),
}));

jest.mock('../../ApplicationConfigProvider/ApplicationConfigProvider', () => ({
  useApplicationConfigContext: jest.fn().mockImplementation(() => ({
    cachedEntityData: {},
    updateCachedEntityData: jest.fn(),
  })),
}));

describe('Test EntityPopoverCard component', () => {
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

  it('EntityPopoverCard should call tags api if entity type is tag card', async () => {
    const mockTagAPI = getTagByName as jest.Mock;

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

  it('EntityPopoverCard should not call api if cached data is available', async () => {
    const mockTagAPI = getTagByName as jest.Mock;

    (useApplicationConfigContext as jest.Mock).mockImplementation(() => ({
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
});
