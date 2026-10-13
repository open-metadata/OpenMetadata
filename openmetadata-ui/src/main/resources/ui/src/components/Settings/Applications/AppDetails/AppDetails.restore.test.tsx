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
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { mockApplicationData } from '../../../../mocks/rests/applicationAPI.mock';
import AppDetails from './AppDetails.component';

jest.mock('../../../../constants/constants', () => ({
  DE_ACTIVE_COLOR: '#fefefe',
  MCP_APPLICATION_NAME: 'McpApplication',
}));

const mockIsAdminUser = jest.fn().mockReturnValue(true);

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({
    isAdminUser: mockIsAdminUser(),
  })),
}));

jest.mock('../McpApplicationConfiguration/McpApplicationConfiguration', () =>
  jest.fn().mockReturnValue(<div>MockMcpApplicationConfiguration</div>)
);

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../../PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock('../../../common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <span>{name}</span>)
);

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'mockFQN' }),
}));

jest.mock('../ApplicationsProvider/ApplicationsProvider', () => ({
  useApplicationsProvider: () => ({ applications: [], plugins: [] }),
}));

const mockRestoreApp = jest.fn();
const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();
const mockNavigate = jest.fn();
const mockGetApplicationByName = jest
  .fn()
  .mockImplementation(() =>
    Promise.resolve({ ...mockApplicationData, deleted: true })
  );
const mockImportSchema = jest.fn().mockReturnValue({ default: ['table'] });

jest.mock('../ApplicationConfiguration/ApplicationConfiguration', () =>
  jest.fn().mockImplementation(({ onConfigSave }) => (
    <div data-testid="application-configuration">
      <button onClick={() => onConfigSave({ formData: {} })}>
        Save Config
      </button>
    </div>
  ))
);

jest.mock('../../../../rest/applicationAPI', () => ({
  configureApp: jest.fn(),
  deployApp: jest.fn(),
  getApplicationByName: jest
    .fn()
    .mockImplementation(() => mockGetApplicationByName()),
  patchApplication: jest.fn(),
  restoreApp: jest.fn().mockImplementation(() => mockRestoreApp()),
  triggerOnDemandApp: jest.fn(),
  uninstallApp: jest.fn(),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  getRelativeTime: jest.fn().mockReturnValue('getRelativeTime'),
}));

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../../../utils/JSONSchemaFormUtils', () => ({
  formatFormDataForSubmit: jest.fn(),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getSettingPath: jest.fn().mockImplementation((path) => path),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast()),
  showSuccessToast: jest.fn().mockImplementation(() => mockShowSuccessToast()),
}));

jest.mock('../../../common/FormBuilder/FormBuilder', () =>
  jest
    .fn()
    .mockImplementation(({ onSubmit }) => (
      <button onClick={onSubmit}>Configure Save</button>
    ))
);

jest.mock(
  '../../../common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(({ name }) => <div>{name}</div>),
  })
);

// NOTE: ConfirmationModal is intentionally NOT mocked here. The existing
// AppDetails.test.tsx stubs it out, which hides the loading/disabled behavior of
// the antd confirm button and is exactly why this regression slipped through.
// Rendering the real ConfirmationModal exposes the `save-button` /
// `loading-button` testids (ConfirmationModal.tsx switches on the `isLoading`
// prop) so we can assert on the in-flight loading state.

jest.mock('../AppLogo/AppLogo.component', () =>
  jest.fn().mockImplementation(() => <>AppLogo</>)
);

jest.mock('../AppRunsHistory/AppRunsHistory.component', () =>
  jest.fn().mockReturnValue(<div>AppRunsHistory</div>)
);

jest.mock('../AppLiveIndexing/AppLiveIndexing.component', () =>
  jest.fn().mockReturnValue(<div>AppLiveIndexing</div>)
);

jest.mock('../AppSchedule/AppSchedule.component', () =>
  jest
    .fn()
    .mockImplementation(({ onSave, onDemandTrigger, onDeployTrigger }) => (
      <>
        AppSchedule
        <button onClick={onSave}>Save AppSchedule</button>
        <button onClick={onDemandTrigger}>DemandTrigger AppSchedule</button>
        <button onClick={onDeployTrigger}>DeployTrigger AppSchedule</button>
      </>
    ))
);

jest.mock('./ApplicationsClassBase', () => ({
  importSchema: jest.fn().mockImplementation(() => mockImportSchema()),
  getJSONUISchema: jest.fn().mockReturnValue({}),
  getApplicationConfigurationComponent: jest
    .fn()
    .mockReturnValue(() => <div>MockApplicationConfiguration</div>),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const renderAppDetails = async () => {
  render(<AppDetails />);
  await waitForElementToBeRemoved(() => screen.getByText('Loader'));
};

describe('AppDetails restore (enable) confirm action', () => {
  beforeEach(() => {
    mockImportSchema.mockReset();
    mockImportSchema.mockReturnValue({ default: ['table'] });
    mockIsAdminUser.mockReturnValue(true);
    mockGetApplicationByName.mockImplementation(() =>
      Promise.resolve({ ...mockApplicationData, deleted: true })
    );
    mockRestoreApp.mockReset();
    mockNavigate.mockReset();
    mockShowSuccessToast.mockReset();
    mockShowErrorToast.mockReset();
  });

  it('shows the loading state on the confirm button while restoreApp is in flight', async () => {
    // Hold the restore call open for the entire assertion so the in-flight
    // window is observable.
    mockRestoreApp.mockReturnValue(new Promise(() => {}));

    await renderAppDetails();

    fireEvent.click(screen.getByTestId('manage-button'));

    fireEvent.click(screen.getByRole('menuitem', { name: 'label.restore' }));

    const confirm = await screen.findByTestId('save-button');
    fireEvent.click(confirm);

    expect(await screen.findByTestId('loading-button')).toBeInTheDocument();
    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
  });

  it('blocks a second confirm click and prevents duplicate restoreApp requests', async () => {
    mockRestoreApp.mockReturnValue(new Promise(() => {}));

    await renderAppDetails();

    fireEvent.click(screen.getByTestId('manage-button'));

    fireEvent.click(screen.getByRole('menuitem', { name: 'label.restore' }));

    const confirm = await screen.findByTestId('save-button');
    fireEvent.click(confirm);
    // Second confirm click happens while the first restoreApp is still pending.
    fireEvent.click(confirm);

    expect(mockRestoreApp).toHaveBeenCalledTimes(1);
  });
});
