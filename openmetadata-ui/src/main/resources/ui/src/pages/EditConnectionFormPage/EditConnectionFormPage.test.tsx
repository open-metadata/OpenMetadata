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
import React from 'react';
import EditConnectionFormPage from './EditConnectionFormPage.component';

const SERVICE_CONFIG_UPDATE = 'Update ServiceConfig';
const SERVICE_CONFIG_FOCUS = 'Focus ServiceConfig';
const ERROR = 'Error';
const ACTIVE_FIELD = 'Active Field';

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div>ErrorPlaceHolder</div>)
);

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

jest.mock(
  '../../components/Settings/Services/ServiceConfig/ServiceConfig',
  () =>
    jest.fn().mockImplementation(({ onFocus, handleUpdate }) => (
      <>
        ServiceConfig
        <button onClick={handleUpdate}>{SERVICE_CONFIG_UPDATE}</button>
        <button onClick={() => onFocus(withActiveField ? ACTIVE_FIELD : '')}>
          {SERVICE_CONFIG_FOCUS}
        </button>
      </>
    ))
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: '' })),
}));

const mockGetServiceByFQN = jest.fn();
const mockUpdateService = jest.fn();

jest.mock('../../rest/serviceAPI', () => ({
  getServiceByFQN: jest.fn(() => mockGetServiceByFQN()),
  updateService: jest.fn(() => mockUpdateService()),
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
  useParams: jest.fn().mockReturnValue({}),
}));

describe('EditConnectionFormPage component', () => {
  it('should render all necessary elements', async () => {
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
    mockGetServiceByFQN.mockRejectedValueOnce({
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
    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    await act(async () => {
      userEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_UPDATE })
      );
    });

    expect(mockUpdateService).toHaveBeenCalled();

    // not doing await as it just do state update
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_FOCUS })
      );
    });

    jest.runAllTimers();

    expect(screen.getByText(ACTIVE_FIELD)).toBeInTheDocument();
  });

  it('call focus without active field', async () => {
    withActiveField = false;

    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_FOCUS })
      );
    });

    expect(screen.queryByText(ACTIVE_FIELD)).not.toBeInTheDocument();
  });

  it('other errors check', async () => {
    mockGetServiceByFQN.mockRejectedValueOnce(ERROR);
    mockUpdateService.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<EditConnectionFormPage />);
    });

    await act(async () => {
      userEvent.click(
        screen.getByRole('button', { name: SERVICE_CONFIG_UPDATE })
      );
    });

    expect(mockShowErrorToast).toHaveBeenCalledTimes(2);
  });
});
