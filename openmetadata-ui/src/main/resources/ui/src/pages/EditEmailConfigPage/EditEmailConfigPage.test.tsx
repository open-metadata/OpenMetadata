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
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EditEmailConfigPage from './EditEmailConfigPage.component';

const ERROR = 'ERROR';
const ENTITY_FETCH_ERROR = 'server.entity-fetch-error';
const ENTITY_UPDATING_ERROR = 'server.entity-updating-error';
const UPDATE_ENTITY_SUCCESS = 'server.update-entity-success';
const ACTIVE_FIELD = 'activeField';

jest.mock('../../components/common/ServiceDocPanel/ServiceDocPanel', () =>
  jest.fn(({ activeField }) => (
    <>
      <p>{activeField}</p>
      <div>ServiceDocPanel</div>
    </>
  ))
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <div>TitleBreadcrumb</div>)
);

jest.mock(
  '../../components/Settings/Email/EmailConfigForm/EmailConfigForm.component',
  () =>
    jest.fn().mockImplementation(({ onCancel, onFocus, onSubmit }) => (
      <>
        EmailConfigForm
        <button onClick={onCancel}>Cancel EmailConfigForm</button>
        <button onClick={() => onFocus({ target: { id: ACTIVE_FIELD } })}>
          Focus EmailConfigForm
        </button>
        <button onClick={onSubmit}>Submit EmailConfigForm</button>
      </>
    ))
);

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const mockGetSettingsConfigFromConfigType = jest.fn().mockResolvedValue({
  data: {
    config_value: {
      customLogoUrlPath: 'https://custom-logo.png',
      customMonogramUrlPath: 'https://custom-monogram.png',
    },
  },
});

const mockUpdateSettingsConfig = jest.fn().mockResolvedValue({});

jest.mock('../../rest/settingConfigAPI', () => ({
  getSettingsConfigFromConfigType: jest.fn(() =>
    mockGetSettingsConfigFromConfigType()
  ),
  updateSettingsConfig: jest.fn(() => mockUpdateSettingsConfig()),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getSettingPath: jest.fn(),
}));

const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation((...args) => mockShowErrorToast(...args)),
  showSuccessToast: jest
    .fn()
    .mockImplementation((...args) => mockShowSuccessToast(...args)),
}));

const mockProps = {
  pageTitle: 'edit-email-config',
};

describe('EditEmailConfigPage', () => {
  it('should contain all necessary elements', async () => {
    await act(async () => {
      render(<EditEmailConfigPage {...mockProps} />);
    });

    expect(mockGetSettingsConfigFromConfigType).toHaveBeenCalled();

    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(screen.getByText('EmailConfigForm')).toBeInTheDocument();
    expect(screen.getByText('ServiceDocPanel')).toBeInTheDocument();
  });

  it('actions check', async () => {
    await act(async () => {
      render(<EditEmailConfigPage {...mockProps} />);
    });

    // Focus EmailConfigForm
    act(() => {
      userEvent.click(
        screen.getByRole('button', {
          name: 'Focus EmailConfigForm',
        })
      );
    });

    expect(await screen.findByText(ACTIVE_FIELD)).toBeInTheDocument();

    // Cancel EmailConfigForm
    userEvent.click(
      screen.getByRole('button', {
        name: 'Cancel EmailConfigForm',
      })
    );

    // Submit EmailConfigForm
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', {
          name: 'Submit EmailConfigForm',
        })
      );
    });

    await waitFor(() => {
      expect(mockUpdateSettingsConfig).toHaveBeenCalled();
      expect(mockShowSuccessToast).toHaveBeenCalledWith(UPDATE_ENTITY_SUCCESS);
    });

    // called in cancel and submit both actions
    expect(mockNavigate).toHaveBeenCalledTimes(2);
  });

  it('errors check', async () => {
    mockGetSettingsConfigFromConfigType.mockRejectedValueOnce(ERROR);
    mockUpdateSettingsConfig.mockRejectedValueOnce(ERROR);

    render(<EditEmailConfigPage {...mockProps} />);

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(
        ERROR,
        ENTITY_FETCH_ERROR
      );
    });

    // Submit EmailConfigForm

    userEvent.click(
      await screen.findByRole('button', {
        name: 'Submit EmailConfigForm',
      })
    );

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledWith(
        ERROR,
        ENTITY_UPDATING_ERROR
      );
    });
  });
});
