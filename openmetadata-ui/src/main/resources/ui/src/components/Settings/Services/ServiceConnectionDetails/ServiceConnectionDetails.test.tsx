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
import { ServiceCategory } from '../../../../enums/service.enum';
import { PipelineServiceType } from '../../../../generated/entity/data/pipeline';
import { MetadataServiceType } from '../../../../generated/entity/services/metadataService';
import { ConfigData } from '../../../../interface/service.interface';
import {
  AIR_BYTE_CONNECTION,
  ATLAS_CONNECTION,
  MOCK_ATHENA_SERVICE,
} from '../../../../mocks/Service.mock';
import { getDashboardConfig } from '../../../../utils/DashboardServiceUtils';
import { getMessagingConfig } from '../../../../utils/MessagingServiceUtils';
import { getMetadataConfig } from '../../../../utils/MetadataServiceUtils';
import { getMlmodelConfig } from '../../../../utils/MlmodelServiceUtils';
import { getPipelineConfig } from '../../../../utils/PipelineServiceUtils';
import { getSearchServiceConfig } from '../../../../utils/SearchServiceUtils';
import ServiceConnectionDetails from './ServiceConnectionDetails.component';

jest.mock('../../../../utils/DatabaseServiceUtils', () => ({
  getDatabaseConfig: jest.fn().mockReturnValue({
    schema: MOCK_ATHENA_SERVICE,
  }),
}));

jest.mock('../../../../utils/DashboardServiceUtils', () => ({
  getDashboardConfig: jest.fn().mockReturnValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/MessagingServiceUtils', () => ({
  getMessagingConfig: jest.fn().mockReturnValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/MetadataServiceUtils', () => ({
  getMetadataConfig: jest.fn().mockReturnValue({
    schema: ATLAS_CONNECTION,
  }),
}));

jest.mock('../../../../utils/MlmodelServiceUtils', () => ({
  getMlmodelConfig: jest.fn().mockReturnValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/PipelineServiceUtils', () => ({
  getPipelineConfig: jest.fn().mockReturnValue({
    schema: AIR_BYTE_CONNECTION,
  }),
}));

jest.mock('../../../../utils/SearchServiceUtils', () => ({
  getSearchServiceConfig: jest.fn().mockReturnValue({
    schema: {},
  }),
}));

const databaseSchema = {
  hostPort: 'localhost:5432',
  password: 'testPassword',
  username: 'testUsername',
  database: 'test_db',
  scope: ['test_scope1', 'test_scope2'],
  connectionArguments: {
    arg1: 'connectionArguments1',
    arg2: 'connectionArguments2',
  },
  connectionOptions: {
    option1: 'connectionOptions1',
    option2: 'connectionOptions2',
  },
};

const pipelineSchema = {
  hostPort: 'localhost:5432',
  type: PipelineServiceType.Airbyte,
  numberOfStatus: 2,
  username: 'testUser',
  host: 'Dagster',
};

const metaDataSchema = {
  type: MetadataServiceType.Atlas,
  username: 'AtlasUsername',
  password: 'AtlasPassword',
  hostPort: 'localhost:5432',
  projectName: 'AtlasProject',
};

const services = [
  {
    name: ServiceCategory.DASHBOARD_SERVICES,
    configVal: getDashboardConfig as jest.Mock,
  },
  {
    name: ServiceCategory.MESSAGING_SERVICES,
    configVal: getMessagingConfig as jest.Mock,
  },
  {
    name: ServiceCategory.METADATA_SERVICES,
    configVal: getMetadataConfig as jest.Mock,
  },
  {
    name: ServiceCategory.ML_MODEL_SERVICES,
    configVal: getMlmodelConfig as jest.Mock,
  },
  {
    name: ServiceCategory.PIPELINE_SERVICES,
    configVal: getPipelineConfig as jest.Mock,
  },
  {
    name: ServiceCategory.SEARCH_SERVICES,
    configVal: getSearchServiceConfig as jest.Mock,
  },
];

describe('ServiceConnectionDetails', () => {
  it('renders Service Connection Details', async () => {
    render(
      <ServiceConnectionDetails
        connectionDetails={databaseSchema}
        serviceCategory={ServiceCategory.DATABASE_SERVICES}
        serviceFQN="test"
      />
    );

    expect(
      await screen.findByTestId('service-connection-details')
    ).toBeInTheDocument();
  });

  it('render data with databaseServices schema', async () => {
    await act(async () => {
      render(
        <ServiceConnectionDetails
          connectionDetails={databaseSchema}
          serviceCategory={ServiceCategory.DATABASE_SERVICES}
          serviceFQN="test"
        />
      );
    });

    expect(
      await screen.findByTestId('service-connection-details')
    ).toBeInTheDocument();
    expect(await screen.findByText('hostPort:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[0]).toHaveValue(
      'localhost:5432'
    );

    expect(await screen.findByText('password:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[1]).toHaveValue(
      'testPassword'
    );
    expect(await screen.findByText('password:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[2]).toHaveValue(
      'testUsername'
    );
    expect(await screen.findByText('database:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[3]).toHaveValue(
      'test_db'
    );
    expect(await screen.findByText('scope:')).toBeInTheDocument();
    expect(
      await screen
        .queryAllByTestId('input-field')[4]
        .querySelector('span[title=test_scope1]')
    ).toHaveTextContent('test_scope1');
    expect(
      await screen
        .queryAllByTestId('input-field')[4]
        .querySelector('span[title=test_scope2]')
    ).toHaveTextContent('test_scope2');
  });

  services.map((service) => {
    it(`should render ${service.name} service`, async () => {
      render(
        <ServiceConnectionDetails
          connectionDetails={databaseSchema}
          serviceCategory={service.name}
          serviceFQN="test"
        />
      );
      await act(async () => {
        expect(service.configVal).toHaveBeenCalled();
      });
    });
  });

  it('render data with pipeline schema', async () => {
    await act(async () => {
      render(
        <ServiceConnectionDetails
          connectionDetails={pipelineSchema as ConfigData}
          serviceCategory={ServiceCategory.PIPELINE_SERVICES}
          serviceFQN="test"
        />
      );
    });

    expect(
      await screen.findByTestId('service-connection-details')
    ).toBeInTheDocument();
    expect(await screen.findByText('hostPort:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[0]).toHaveValue(
      'localhost:5432'
    );
    expect(await screen.findByText('numberOfStatus:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[1]).toHaveValue('2');
    expect(await screen.findByText('username:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[2]).toHaveValue(
      'testUser'
    );
    expect(await screen.findByText('host:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[3]).toHaveValue(
      'Dagster'
    );
  });

  it('should render metadata service', async () => {
    render(
      <ServiceConnectionDetails
        connectionDetails={metaDataSchema as ConfigData}
        serviceCategory={ServiceCategory.METADATA_SERVICES}
        serviceFQN="test"
      />
    );

    expect(await screen.findByText('username:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[0]).toHaveValue(
      'AtlasUsername'
    );
    expect(await screen.findByText('password:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[1]).toHaveValue(
      'AtlasPassword'
    );
    expect(await screen.findByText('hostPort:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[2]).toHaveValue(
      'localhost:5432'
    );
    expect(await screen.findByText('projectName:')).toBeInTheDocument();
    expect(await screen.queryAllByTestId('input-field')[3]).toHaveValue(
      'AtlasProject'
    );
  });
});
