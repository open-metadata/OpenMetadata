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
  queryByTestId,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { ROUTES } from '../../../../constants/constants';
import { mockApplicationData } from '../../../../mocks/rests/applicationAPI.mock';
import MarketPlaceAppDetails from './MarketPlaceAppDetails.component';

const mockNavigate = jest.fn();
const mockShowErrorToast = jest.fn();
let mockGetApplicationByName = jest.fn().mockReturnValue(mockApplicationData);
let mockGetMarketPlaceApplicationByFqn = jest.fn().mockReturnValue({
  description: 'marketplace description',
  fullyQualifiedName: 'marketplace fqn',
  supportEmail: 'support@email.com',
  developerUrl: 'https://xyz.com',
  privacyPolicyUrl: 'https://xyz.com',
  appScreenshots: ['screenshot1', 'screenshot2'],
  preview: false,
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn().mockReturnValue(<>RichTextEditorPreviewer</>)
);

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('../../../PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ leftPanel, children }) => (
    <div>
      {leftPanel}
      {children}
    </div>
  ))
);

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'mockFQN' }),
}));

jest.mock('../../../../rest/applicationAPI', () => ({
  getApplicationByName: jest
    .fn()
    .mockImplementation(() => mockGetApplicationByName()),
}));

jest.mock('../../../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationByFqn: jest
    .fn()
    .mockImplementation((...args) =>
      mockGetMarketPlaceApplicationByFqn(...args)
    ),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getAppInstallPath: jest.fn().mockReturnValue('app install path'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest
    .fn()
    .mockImplementation((...args) => mockShowErrorToast(...args)),
}));

jest.mock('../AppLogo/AppLogo.component', () =>
  jest.fn().mockImplementation(() => <>AppLogo</>)
);

describe('MarketPlaceAppDetails component', () => {
  it('should render all necessary elements if app details fetch successfully', async () => {
    const { container } = render(<MarketPlaceAppDetails />);

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(mockGetMarketPlaceApplicationByFqn).toHaveBeenCalledWith('mockFQN', {
      fields: expect.anything(),
    });
    expect(mockGetApplicationByName).toHaveBeenCalled();

    expect(screen.getByText('AppLogo')).toBeInTheDocument();

    expect(
      screen.getByText('message.marketplace-verify-msg')
    ).toBeInTheDocument();
    expect(screen.getByText('label.get-app-support')).toBeInTheDocument();
    expect(
      screen.getByText('label.visit-developer-website')
    ).toBeInTheDocument();
    expect(screen.getByText('label.privacy-policy')).toBeInTheDocument();
    expect(screen.getByText('label.get-app-support')).toBeInTheDocument();

    const appName = queryByTestId(container, 'appName');

    expect(appName).not.toBeInTheDocument();

    // actions check
    fireEvent.click(
      screen.getByRole('button', { name: 'left label.browse-app-plural' })
    );

    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.MARKETPLACE);
  });

  it('should show install button disabled', async () => {
    mockGetApplicationByName = jest.fn().mockReturnValue([]);
    mockGetMarketPlaceApplicationByFqn = jest.fn().mockReturnValue({
      description: 'marketplace description',
      fullyQualifiedName: 'marketplace fqn',
      supportEmail: 'support@email.com',
      developerUrl: 'https://xyz.com',
      privacyPolicyUrl: 'https://xyz.com',
      appScreenshots: ['screenshot1', 'screenshot2'],
      preview: true,
    });

    render(<MarketPlaceAppDetails />);

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(mockGetMarketPlaceApplicationByFqn).toHaveBeenCalledWith('mockFQN', {
      fields: expect.anything(),
    });
    expect(mockGetApplicationByName).toHaveBeenCalled();

    expect(screen.getByTestId('install-application')).toBeDisabled();
    expect(screen.getByTestId('appName')).toBeInTheDocument();
  });

  it('should show toast error, if failed to fetch app details', async () => {
    const MARKETPLACE_APP_DETAILS_ERROR = 'marketplace app data fetch failed.';
    const APP_DETAILS_ERROR = 'app data fetch failed.';
    mockGetMarketPlaceApplicationByFqn.mockRejectedValueOnce(
      MARKETPLACE_APP_DETAILS_ERROR
    );
    mockGetApplicationByName.mockRejectedValueOnce(APP_DETAILS_ERROR);

    render(<MarketPlaceAppDetails />);

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(mockGetMarketPlaceApplicationByFqn).toHaveBeenCalledWith('mockFQN', {
      fields: expect.anything(),
    });
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      MARKETPLACE_APP_DETAILS_ERROR
    );

    // app install action check
    // making install button enable by rejecting promise in getApplicationByName
    fireEvent.click(screen.getByRole('button', { name: 'label.install' }));

    expect(mockNavigate).toHaveBeenCalledWith('app install path');
  });

  it("should render the correct support email url with 'mailto:' schema", async () => {
    render(<MarketPlaceAppDetails />);

    await waitForElementToBeRemoved(() => screen.getByText('Loader'));

    expect(screen.getByTestId('app-support-email')).toHaveAttribute(
      'href',
      'mailto:support@email.com'
    );
  });
});
