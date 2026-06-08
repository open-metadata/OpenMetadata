/*
 *  Copyright 2026 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import { act, forwardRef } from 'react';
import { LOADING_STATE } from '../../../../enums/common.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { MOCK_ATHENA_SERVICE } from '../../../../mocks/Service.mock';
import * as LocalUtils from '../../../../utils/i18next/LocalUtil';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import { loadConnectionSchema } from '../../../../utils/ServiceConnectionUtils';
import EmbeddedConnectionConfigForm from './EmbeddedConnectionConfigForm';

const formData = {
  type: 'Mysql',
  scheme: 'mysql+pymysql',
  username: 'admin',
  authType: { password: '*********' },
  hostPort: 'host.docker.internal:3306',
};

jest.mock('../../../../utils/DatabaseServiceUtils', () => ({
  getDatabaseConfig: jest
    .fn()
    .mockResolvedValue({ schema: MOCK_ATHENA_SERVICE }),
}));

jest.mock('../../../../utils/DashboardServiceUtils', () => ({
  getDashboardConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/MessagingServiceUtils', () => ({
  getMessagingConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/MetadataServiceUtils', () => ({
  getMetadataConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/MlmodelServiceUtils', () => ({
  getMlmodelConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/PipelineServiceUtils', () => ({
  getPipelineConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/SearchServiceUtils', () => ({
  getSearchServiceConfig: jest.fn().mockResolvedValue({ schema: {} }),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn(),
}));

jest.mock('../../../../utils/ServiceConnectionUtils', () => ({
  buildValidConfig: jest.fn().mockReturnValue({}),
  loadConnectionSchema: jest
    .fn()
    .mockResolvedValue({ schema: { name: 'test' }, uiSchema: {} }),
  EMPTY_CONNECTION_SCHEMA: { schema: {}, uiSchema: {} },
  getFilteredSchema: jest.fn().mockReturnValue({}),
  getUISchemaWithNestedDefaultFilterFieldsHidden: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../common/AirflowMessageBanner/AirflowMessageBanner', () =>
  jest
    .fn()
    .mockReturnValue(
      <div data-testid="airflowMessageBanner">AirflowMessageBanner</div>
    )
);

jest.mock('../../../common/FormBuilderV1/FormBuilderV1', () =>
  forwardRef(
    jest.fn().mockImplementation(({ children, onSubmit, onCancel }) => (
      <div data-testid="form-builder-v1">
        {children}
        <button
          data-testid="submit-button"
          onClick={() => onSubmit({ formData })}>
          Submit
        </button>
        <button onClick={onCancel}>Cancel</button>
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
    data: { ip: '192.168.0.1' },
    status: 200,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({ t: (label: string) => label }),
}));

jest.mock(
  '../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      reason: 'reason message',
      isAirflowAvailable: true,
      platform: 'Argo',
    })),
  })
);

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    inlineAlertDetails: undefined,
  }),
}));

const mockOnSave = jest.fn().mockImplementation(() => Promise.resolve());
const mockOnFocus = jest.fn();

const mockProps = {
  disableTestConnection: false,
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  serviceType: 'testType',
  status: LOADING_STATE.SUCCESS,
  onFocus: mockOnFocus,
  onSave: mockOnSave,
};

describe('EmbeddedConnectionConfigForm', () => {
  beforeEach(() => {
    jest
      .spyOn(LocalUtils, 'Transi18next')
      .mockImplementation(() => <>message.airflow-host-ip-address</>);
  });

  it('renders the form builder v1', async () => {
    render(<EmbeddedConnectionConfigForm {...mockProps} />);

    expect(
      await screen.findByTestId('airflowMessageBanner')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('form-builder-v1')).toBeInTheDocument();
  });

  it('does not show no-config message when schema has content', async () => {
    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(screen.queryByTestId('no-config-available')).not.toBeInTheDocument();
  });

  it('shows no-config message when schema is empty', async () => {
    (loadConnectionSchema as jest.Mock).mockResolvedValueOnce({
      schema: {},
      uiSchema: {},
    });

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-config-available')
    ).toBeInTheDocument();
  });

  it('shows IP alert when airflow is available and host IP is fetched', async () => {
    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });

    expect(await screen.findByTestId('ip-address')).toBeInTheDocument();
  });

  it('calls onSave with formatted form data when submit button clicked', async () => {
    const mockFormatted = { ...formData };
    (formatFormDataForSubmit as jest.Mock).mockReturnValue(mockFormatted);

    await act(async () => {
      render(<EmbeddedConnectionConfigForm {...mockProps} />);
    });
    const submitButton = await screen.findByTestId('submit-button');

    fireEvent.click(submitButton);

    expect(formatFormDataForSubmit).toHaveBeenCalledWith(formData);
    expect(mockOnSave).toHaveBeenCalledWith({
      formData: mockFormatted,
    });
  });
});
