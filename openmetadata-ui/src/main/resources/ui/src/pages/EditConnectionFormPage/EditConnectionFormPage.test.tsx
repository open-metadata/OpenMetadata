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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { getServiceByFQN, patchService } from '../../rest/serviceAPI';
import EditConnectionFormPage from './EditConnectionFormPage.component';

const mockServiceData = {
  id: 'a831deb9-143e-4832-9eb2-82f635b6964b',
  name: 'mySQL',
  fullyQualifiedName: 'mySQL',
  serviceType: 'Mysql',
  connection: {
    config: {
      type: 'Mysql',
      scheme: 'mysql+pymysql',
      username: 'openmetadata_user',
      authType: {
        password: '*********',
      },
      hostPort: 'host.docker.internal:3306',
      supportsMetadataExtraction: true,
      supportsDBTExtraction: true,
      supportsProfiler: true,
      supportsQueryComment: true,
    },
  },
};

const SERVICE_CONFIG_UPDATE = 'Update ServiceConfig';
const SERVICE_CONFIG_FOCUS = 'Focus ServiceConfig';
const ERROR = 'Error';
const ACTIVE_FIELD = 'Active Field';

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation(
    () =>
      (Component: React.FC) =>
      (
        props: JSX.IntrinsicAttributes & {
          children?: React.ReactNode | undefined;
        }
      ) =>
        <Component {...props} />
  ),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn().mockImplementation(({ activeField }) => (
    <>
      <div>ServiceDocPanel</div>
      <p>{activeField}</p>
    </>
  ))
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

let withActiveField = true;
let updateServiceData = true;

jest.mock(
  '../../components/Settings/Services/ServiceConfig/ServiceConfig',
  () =>
    jest.fn().mockImplementation(({ onFocus, handleUpdate }) => (
      <>
        <p>ServiceConfig</p>
        <button
          onClick={() =>
            handleUpdate(
              updateServiceData
                ? {
                    ...mockServiceData.connection.config,
                    databaseSchema: 'openmetadata_db',
                  }
                : mockServiceData.connection.config
            )
          }>
          {SERVICE_CONFIG_UPDATE}
        </button>
        <button onClick={() => onFocus(withActiveField ? ACTIVE_FIELD : '')}>
          {SERVICE_CONFIG_FOCUS}
        </button>
      </>
    ))
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: '' })),
}));

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockServiceData)),
  patchService: jest.fn(),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getEntityMissingError: jest.fn(),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getPathByServiceFQN: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('../../utils/ServiceUtilClassBase', () => ({
  getServiceTypeLogo: jest.fn().mockReturnValue(''),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getServiceRouteFromServiceType: jest.fn(),
  getServiceType: jest.fn(),
}));

const mockShowErrorToast = jest.fn();

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((...args) => mockShowErrorToast(...args)),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({ serviceCategory: 'databaseServices' }),
}));

describe('EditConnectionFormPage component', () => {
  it('should render all necessary elements', async () => {
    const mockGetServiceByFQN = getServiceByFQN as jest.Mock;
    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    expect(mockGetServiceByFQN).toHaveBeenCalled();
    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(
      screen.getByText('message.edit-service-entity-connection')
    ).toBeInTheDocument();
    expect(screen.getByText('ServiceConfig')).toBeInTheDocument();
    expect(screen.getByText('ServiceDocPanel')).toBeInTheDocument();
  });

  it('should show ErrorPlaceHolder if get 404 error during service fetch', async () => {
    (getServiceByFQN as jest.Mock).mockRejectedValueOnce({
      response: {
        status: 404,
      },
    });

    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('actions check', async () => {
    const mockUpdateService = patchService as jest.Mock;
    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_UPDATE })
      );
    });

    expect(mockUpdateService).toHaveBeenCalledWith(
      'databaseServices',
      mockServiceData.id,
      [
        {
          op: 'add',
          path: '/connection/config/databaseSchema',
          value: 'openmetadata_db',
        },
      ]
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_FOCUS })
      );
    });

    await act(async () => {
      jest.runAllTimers();
    });

    expect(screen.getByText(ACTIVE_FIELD)).toBeInTheDocument();
  });

  it('call focus without active field', async () => {
    withActiveField = false;

    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_FOCUS })
      );
    });

    expect(screen.queryByText(ACTIVE_FIELD)).not.toBeInTheDocument();
  });

  it('showErrorTost should be call when GetServiceByFQN fails', async () => {
    (getServiceByFQN as jest.Mock).mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
  });

  it('showErrorTost should be call when updateService fails', async () => {
    (patchService as jest.Mock).mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_UPDATE })
      );
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
  });

  it('patchService should not call if there is no change', async () => {
    updateServiceData = false;
    const mockUpdateService = patchService as jest.Mock;
    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_UPDATE })
      );
    });

    expect(mockUpdateService).not.toHaveBeenCalled();
  });
});
