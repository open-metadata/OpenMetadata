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
import userEvent from '@testing-library/user-event';
import React, { forwardRef } from 'react';
import { LOADING_STATE } from '../../../../enums/common.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { MOCK_ATHENA_SERVICE } from '../../../../mocks/Service.mock';
import { getPipelineServiceHostIp } from '../../../../rest/ingestionPipelineAPI';
import { getDashboardConfig } from '../../../../utils/DashboardServiceUtils';
import { getDatabaseConfig } from '../../../../utils/DatabaseServiceUtils';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import { getMessagingConfig } from '../../../../utils/MessagingServiceUtils';
import { getMetadataConfig } from '../../../../utils/MetadataServiceUtils';
import { getMlmodelConfig } from '../../../../utils/MlmodelServiceUtils';
import { getPipelineConfig } from '../../../../utils/PipelineServiceUtils';
import { getSearchServiceConfig } from '../../../../utils/SearchServiceUtils';
import ConnectionConfigForm from './ConnectionConfigForm';

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

const mockServicesData = {
  id: '1',
  description: 'Test service',
  ingestionSchedule: {
    repeatFrequency: 'daily',
    startDate: '2022-01-01',
  },
  name: 'Test Service',
  serviceType: 'database',
  schema: {
    hostPort: 'localhost:5432',
    password: 'password',
    username: 'username',
    database: 'test_db',
    connectionArguments: {
      arg1: 'value1',
      arg2: 'value2',
    },
    connectionOptions: {
      option1: 'value1',
      option2: 'value2',
    },
  },
  brokers: ['broker1', 'broker2'],
  schemaRegistry: 'http://localhost:8081',
  sourceUrl: 'http://localhost:8080',
  username: 'username',
  password: 'password',
  url: 'http://localhost:8080',
  api_key: 'api_key',
  site_name: 'site_name',
  api_version: 'v1',
  server: 'localhost',
  env: 'development',
};

const formData = {
  type: 'Mysql',
  scheme: 'mysql+pymysql',
  username: 'admin',
  authType: {
    password: '*********',
  },
  hostPort: 'host.docker.internal:3306',
  sslKey: 'test',
  supportsMetadataExtraction: true,
  supportsDBTExtraction: true,
  supportsProfiler: true,
  supportsQueryComment: true,
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

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
    schema: {},
  }),
}));

jest.mock('../../../../utils/MlmodelServiceUtils', () => ({
  getMlmodelConfig: jest.fn().mockReturnValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/PipelineServiceUtils', () => ({
  getPipelineConfig: jest.fn().mockReturnValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/SearchServiceUtils', () => ({
  getSearchServiceConfig: jest.fn().mockReturnValue({
    schema: {},
  }),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn(),
}));

jest.mock('../../../common/AirflowMessageBanner/AirflowMessageBanner', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="airflowMessageBanner">AirflowMessageBanner</div>
    );
});

jest.mock('../../../common/FormBuilder/FormBuilder', () =>
  forwardRef(
    jest.fn().mockImplementation(({ children, onSubmit, onCancel }) => (
      <div data-testid="form-builder">
        {children}
        <button
          data-testid="submit-button"
          onClick={() => onSubmit({ formData })}>
          Submit FormBuilder
        </button>
        <button onClick={onCancel}>Cancel FormBuilder</button>
      </div>
    ))
  )
);

jest.mock('../../../common/TestConnection/TestConnection', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <p data-testid="test-connection">TestConnection</p>
    ))
);

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  getPipelineServiceHostIp: jest.fn().mockReturnValue({
    data: {
      ip: '192.168.0.1',
    },
    status: 200,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (label: string) => label,
  }),
}));

jest.mock('../../../../hooks/useAirflowStatus', () => ({
  useAirflowStatus: jest.fn().mockImplementation(() => ({
    reason: 'reason message',
    isAirflowAvailable: true,
  })),
}));

const mockHandleUpdate = jest
  .fn()
  .mockImplementation(() => Promise.resolve(mockServicesData));

const mockOnFocus = jest.fn();
const mockProps = {
  disableTestConnection: false,
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceType: 'testType',
  status: LOADING_STATE.SUCCESS,
  onFocus: mockOnFocus,
  onSave: mockHandleUpdate,
};

describe('ServiceConfig', () => {
  it('should render Service Config', async () => {
    render(<ConnectionConfigForm {...mockProps} />);

    expect(
      await screen.findByTestId('airflowMessageBanner')
    ).toBeInTheDocument();

    expect(await screen.findByTestId('form-builder')).toBeInTheDocument();
  });

  it('should not render no config available message if form data has schema', async () => {
    render(<ConnectionConfigForm {...mockProps} />);

    expect(screen.queryByTestId('no-config-available')).not.toBeInTheDocument();
  });

  it('should display airflow-host-ip-address', async () => {
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });
    await act(async () => {
      expect(await screen.findByTestId('ip-address')).toBeInTheDocument();
      expect(
        await screen.findByText('message.airflow-host-ip-address')
      ).toBeInTheDocument();
    });
  });

  it('should render no config available if form data has no schema', async () => {
    (getDatabaseConfig as jest.Mock).mockReturnValue({ schema: {} });
    await act(async () => {
      render(<ConnectionConfigForm {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-config-available')
    ).toBeInTheDocument();
  });

  it('should call onSubmit when submit button is clicked', async () => {
    const mockSubmit = (
      formatFormDataForSubmit as jest.Mock
    ).mockImplementation(() => ({
      ...formData,
    }));
    render(<ConnectionConfigForm {...mockProps} />);
    const submitButton = await screen.findByTestId('submit-button');

    await act(async () => {
      userEvent.click(submitButton);
    });

    expect(mockSubmit).toHaveBeenCalledWith(formData);
  });

  it('should not display host ip if unable to fetch', async () => {
    (getPipelineServiceHostIp as jest.Mock).mockRejectedValue(new Error());
    render(<ConnectionConfigForm {...mockProps} />);
    await act(async () => {
      expect(await screen.queryByTestId('ip-address')).not.toBeInTheDocument();
    });
  });

  it('should not display host ip if status is is not 200', async () => {
    (getPipelineServiceHostIp as jest.Mock).mockImplementationOnce(() => ({
      data: {
        ip: '192.168.0.1',
      },
      status: 201,
    }));
    render(<ConnectionConfigForm {...mockProps} />);
    await act(async () => {
      expect(await screen.queryByTestId('ip-address')).not.toBeInTheDocument();
    });
  });

  services.map((service) => {
    it(`should render ${service.name} service`, async () => {
      render(
        <ConnectionConfigForm
          disableTestConnection={false}
          serviceCategory={service.name}
          serviceType="testType"
          status={LOADING_STATE.SUCCESS}
          onFocus={mockOnFocus}
          onSave={mockHandleUpdate}
        />
      );
      await act(async () => {
        expect(service.configVal).toHaveBeenCalled();
      });
    });
  });
});
