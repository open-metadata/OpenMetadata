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
import { getPipelineServiceHostIp } from '../../../../rest/ingestionPipelineAPI';
import * as LocalUtils from '../../../../utils/i18next/LocalUtil';
import { formatFormDataForSubmit } from '../../../../utils/JSONSchemaFormUtils';
import { getConnectionSchemas } from '../../../../utils/ServiceConnectionUtils';
import EmbeddedConnectionConfigForm from './EmbeddedConnectionConfigForm';

const formData = {
  type: 'Mysql',
  scheme: 'mysql+pymysql',
  username: 'admin',
  authType: { password: '*********' },
  hostPort: 'host.docker.internal:3306',
};

jest.mock('../../../../utils/DatabaseServiceUtils', () => ({
  getDatabaseConfig: jest.fn().mockReturnValue({ schema: MOCK_ATHENA_SERVICE }),
}));

jest.mock('../../../../utils/DashboardServiceUtils', () => ({
  getDashboardConfig: jest.fn().mockReturnValue({ schema: {} }),
}));

jest.mock('../../../../utils/MessagingServiceUtils', () => ({
  getMessagingConfig: jest.fn().mockReturnValue({ schema: {} }),
}));

jest.mock('../../../../utils/MetadataServiceUtils', () => ({
  getMetadataConfig: jest.fn().mockReturnValue({ schema: {} }),
}));

jest.mock('../../../../utils/MlmodelServiceUtils', () => ({
  getMlmodelConfig: jest.fn().mockReturnValue({ schema: {} }),
}));

jest.mock('../../../../utils/PipelineServiceUtils', () => ({
  getPipelineConfig: jest.fn().mockReturnValue({ schema: {} }),
}));

jest.mock('../../../../utils/SearchServiceUtils', () => ({
  getSearchServiceConfig: jest.fn().mockReturnValue({ schema: {} }),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn(),
}));

jest.mock('../../../../utils/ServiceConnectionUtils', () => ({
  getConnectionSchemas: jest.fn().mockReturnValue({
    connSch: { schema: { name: 'test' }, uiSchema: {} },
    validConfig: {},
  }),
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

jest.mock('../../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: { getPageTitle: jest.fn().mockReturnValue('OpenMetadata') },
}));

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
    render(<EmbeddedConnectionConfigForm {...mockProps} />);

    expect(screen.queryByTestId('no-config-available')).not.toBeInTheDocument();
  });

  it('shows no-config message when schema is empty', async () => {
    (getConnectionSchemas as jest.Mock).mockReturnValueOnce({
      connSch: { schema: {}, uiSchema: {} },
      validConfig: {},
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

    render(<EmbeddedConnectionConfigForm {...mockProps} />);

    fireEvent.click(await screen.findByTestId('submit-button'));

    expect(formatFormDataForSubmit).toHaveBeenCalledWith(formData);
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('does not show IP alert when host IP fetch fails', async () => {
    (getPipelineServiceHostIp as jest.Mock).mockRejectedValue(new Error());

    render(<EmbeddedConnectionConfigForm {...mockProps} />);

    await act(async () => {
      expect(screen.queryByTestId('ip-address')).not.toBeInTheDocument();
    });
  });
});
