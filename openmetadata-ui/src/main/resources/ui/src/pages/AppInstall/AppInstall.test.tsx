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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleType } from '../../generated/entity/applications/app';
import { AppMarketPlaceDefinition } from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import AppInstall from './AppInstall.component';

const mockNavigate = jest.fn();
const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();
const mockFormatFormDataForSubmit = jest.fn();
const mockInstallApplication = jest.fn().mockResolvedValue({});
const mockGetMarketPlaceApplicationByFqn = jest
  .fn()
  .mockResolvedValue({} as AppMarketPlaceDefinition);
const ERROR = 'ERROR';
const MARKETPLACE_DATA = {
  allowConfiguration: true,
};

const NO_SCHEDULE_DATA = {
  scheduleType: ScheduleType.NoSchedule,
  allowConfiguration: true,
};

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock(
  '../../components/Settings/Services/AddIngestion/Steps/ScheduleInterval',
  () =>
    jest.fn().mockImplementation(({ onDeploy, onBack }) => (
      <div>
        ScheduleInterval
        <button onClick={onDeploy}>Submit ScheduleInterval</button>
        <button onClick={onBack}>Cancel ScheduleInterval</button>
      </div>
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Save AppInstallVerifyCard' })
    );

    expect(screen.getByText('ScheduleInterval')).toBeInTheDocument();
    expect(screen.queryByText('AppInstallVerifyCard')).not.toBeInTheDocument();

    // ScheduleInterval
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit ScheduleInterval' })
    );

    expect(mockInstallApplication).toHaveBeenCalled();

    await waitFor(() =>
      expect(mockShowSuccessToast).toHaveBeenCalledWith(
        'message.app-installed-successfully'
      )
    );

    // change ActiveServiceStep to 1
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel ScheduleInterval' })
    );

    expect(screen.getByText('AppInstallVerifyCard')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel AppInstallVerifyCard' })
    );

    // will call for Submit ScheduleInterval and Cancel AppInstallVerifyCard
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('actions check with allowConfiguration', async () => {
    mockGetMarketPlaceApplicationByFqn.mockResolvedValueOnce(MARKETPLACE_DATA);

    render(<AppInstall />);

    // change ActiveServiceStep to 2

    fireEvent.click(
      await screen.findByRole('button', { name: 'Save AppInstallVerifyCard' })
    );

    expect(screen.getByText('FormBuilder')).toBeInTheDocument();
    expect(screen.queryByText('AppInstallVerifyCard')).not.toBeInTheDocument();

    // change ActiveServiceStep to 3

    fireEvent.click(screen.getByRole('button', { name: 'Submit FormBuilder' }));

    expect(screen.getByText('ScheduleInterval')).toBeInTheDocument();

    // change ActiveServiceStep to 2
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel ScheduleInterval' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel FormBuilder' }));

    expect(screen.getByText('AppInstallVerifyCard')).toBeInTheDocument();
  });

  it('actions check with schedule type noSchedule', async () => {
    mockGetMarketPlaceApplicationByFqn.mockResolvedValueOnce(NO_SCHEDULE_DATA);

    await act(async () => {
      render(<AppInstall />);
    });

    // change ActiveServiceStep to 2

    fireEvent.click(
      screen.getByRole('button', { name: 'Save AppInstallVerifyCard' })
    );

    expect(await screen.findByText('FormBuilder')).toBeInTheDocument();
    expect(screen.queryByText('AppInstallVerifyCard')).not.toBeInTheDocument();

    // submit the form here
    fireEvent.click(screen.getByRole('button', { name: 'Submit FormBuilder' }));

    expect(mockInstallApplication).toHaveBeenCalled();
  });

  it('errors check in fetching application data', async () => {
    mockGetMarketPlaceApplicationByFqn.mockRejectedValueOnce(ERROR);

    await act(async () => {
      render(<AppInstall />);
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      'message.no-application-schema-found'
    );
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

    expect(await screen.findByText('ScheduleInterval')).toBeInTheDocument();

    await act(async () => {
      userEvent.click(
        screen.getByRole('button', { name: 'Submit ScheduleInterval' })
      );
    });

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalledWith(ERROR));
  });
});
