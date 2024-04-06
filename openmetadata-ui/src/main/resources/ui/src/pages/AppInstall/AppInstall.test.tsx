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
import { AppMarketPlaceDefinition } from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import AppInstall from './AppInstall.component';

const mockPush = jest.fn();
const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();
const mockFormatFormDataForSubmit = jest.fn();
const mockInstallApplication = jest.fn();
const mockGetMarketPlaceApplicationByFqn = jest
  .fn()
  .mockResolvedValue({} as AppMarketPlaceDefinition);
const ERROR = 'ERROR';
const MARKETPLACE_DATA = {
  allowConfiguration: true,
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
}));

jest.mock(
  '../../components/DataQuality/AddDataQualityTest/components/TestSuiteScheduler',
  () =>
    jest.fn().mockImplementation(({ onSubmit, onCancel }) => (
      <>
        TestSuiteScheduler
        <button onClick={onSubmit}>Submit TestSuiteScheduler</button>
        <button onClick={onCancel}>Cancel TestSuiteScheduler</button>
      </>
    ))
);

jest.mock(
  '../../components/Settings/Applications/AppDetails/ApplicationsClassBase',
  () => ({
    importSchema: jest.fn().mockResolvedValue({}),
    getJSONUISchema: jest.fn().mockReturnValue({}),
  })
);

jest.mock(
  '../../components/Settings/Applications/AppInstallVerifyCard/AppInstallVerifyCard.component',
  () =>
    jest.fn().mockImplementation(({ onSave, onCancel }) => (
      <>
        AppInstallVerifyCard
        <button onClick={onSave}>Save AppInstallVerifyCard</button>
        <button onClick={onCancel}>Cancel AppInstallVerifyCard</button>
      </>
    ))
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/common/FormBuilder/FormBuilder', () =>
  jest.fn().mockImplementation(({ onSubmit, onCancel }) => (
    <div>
      FormBuilder
      <button onClick={onSubmit}>Submit FormBuilder</button>
      <button onClick={onCancel}>Cancel FormBuilder</button>
    </div>
  ))
);

jest.mock(
  '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => jest.fn().mockImplementation(() => <div>IngestionStepper</div>)
);

jest.mock('../../components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ pageTitle, children }) => (
    <div>
      PageLayoutV1
      <p>{pageTitle}</p>
      {children}
      {}
    </div>
  ))
);

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-fqn' }),
}));

jest.mock('../../rest/applicationAPI', () => ({
  installApplication: jest.fn(() => mockInstallApplication()),
}));

jest.mock('../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationByFqn: jest.fn(() =>
    mockGetMarketPlaceApplicationByFqn()
  ),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getIngestionFrequency: jest.fn(),
  getEntityMissingError: jest.fn(),
}));

jest.mock('../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn(() => mockFormatFormDataForSubmit()),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getMarketPlaceAppDetailsPath: jest.fn(),
  getSettingPath: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn((...args) => mockShowErrorToast(...args)),
  showSuccessToast: jest.fn((...args) => mockShowSuccessToast(...args)),
}));

describe('AppInstall component', () => {
  it('should render necessary elements', async () => {
    await act(async () => {
      render(<AppInstall />);
    });

    expect(mockGetMarketPlaceApplicationByFqn).toHaveBeenCalled();

    expect(screen.getByText('PageLayoutV1')).toBeInTheDocument();
    expect(screen.getByText('IngestionStepper')).toBeInTheDocument();
    expect(screen.getByText('AppInstallVerifyCard')).toBeInTheDocument();
  });

  it('actions check without allowConfiguration', async () => {
    await act(async () => {
      render(<AppInstall />);
    });

    // change ActiveServiceStep to 3
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: 'Save AppInstallVerifyCard' })
      );
    });

    expect(screen.getByText('TestSuiteScheduler')).toBeInTheDocument();
    expect(screen.queryByText('AppInstallVerifyCard')).not.toBeInTheDocument();

    // TestSuiteScheduler
    await act(async () => {
      userEvent.click(
        screen.getByRole('button', { name: 'Submit TestSuiteScheduler' })
      );
    });

    expect(mockInstallApplication).toHaveBeenCalled();
    expect(mockShowSuccessToast).toHaveBeenCalledWith(
      'message.app-installed-successfully'
    );

    // change ActiveServiceStep to 1
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: 'Cancel TestSuiteScheduler' })
      );
    });

    expect(screen.getByText('AppInstallVerifyCard')).toBeInTheDocument();

    userEvent.click(
      screen.getByRole('button', { name: 'Cancel AppInstallVerifyCard' })
    );

    // will call for Submit TestSuiteScheduler and Cancel AppInstallVerifyCard
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('actions check with allowConfiguration', async () => {
    mockGetMarketPlaceApplicationByFqn.mockResolvedValueOnce(MARKETPLACE_DATA);

    await act(async () => {
      render(<AppInstall />);
    });

    // change ActiveServiceStep to 2
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: 'Save AppInstallVerifyCard' })
      );
    });

    expect(screen.getByText('FormBuilder')).toBeInTheDocument();
    expect(screen.queryByText('AppInstallVerifyCard')).not.toBeInTheDocument();

    // change ActiveServiceStep to 3
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: 'Submit FormBuilder' })
      );
    });

    expect(screen.getByText('TestSuiteScheduler')).toBeInTheDocument();

    // change ActiveServiceStep to 2
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: 'Cancel TestSuiteScheduler' })
      );
    });

    // change ActiveServiceStep to 1
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: 'Cancel FormBuilder' })
      );
    });

    expect(screen.getByText('AppInstallVerifyCard')).toBeInTheDocument();
  });

  it('errors check in fetching application data', async () => {
    mockGetMarketPlaceApplicationByFqn.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<AppInstall />);
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(ERROR);
    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('error check in installing application', async () => {
    mockInstallApplication.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<AppInstall />);
    });

    // change ActiveServiceStep to 3
    act(() => {
      userEvent.click(
        screen.getByRole('button', { name: 'Save AppInstallVerifyCard' })
      );
    });

    expect(screen.getByText('TestSuiteScheduler')).toBeInTheDocument();

    await act(async () => {
      userEvent.click(
        screen.getByRole('button', { name: 'Submit TestSuiteScheduler' })
      );
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(ERROR);
  });
});
