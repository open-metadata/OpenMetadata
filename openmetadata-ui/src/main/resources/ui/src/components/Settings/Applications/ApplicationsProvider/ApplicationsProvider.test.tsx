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

import { render, screen, waitFor } from '@testing-library/react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getInstalledApplicationList } from '../../../../rest/applicationAPI';
import ApplicationsProvider from './ApplicationsProvider';

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));
jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));
jest.mock('../../../../rest/applicationAPI', () => ({
  getInstalledApplicationList: jest.fn(),
}));

const mockUsePermissionProvider = usePermissionProvider as jest.Mock;
const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;
const mockGetInstalledApplicationList =
  getInstalledApplicationList as jest.Mock;
const mockSetApplicationsName = jest.fn();
const mockSetApplicationsLoaded = jest.fn();
const APPLICATION_CHILDREN_TEST_ID = 'application-children';

describe('ApplicationsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePermissionProvider.mockReturnValue({
      permissions: { app: {} },
    });
    mockUseApplicationStore.mockReturnValue({
      setApplicationsName: mockSetApplicationsName,
      setApplicationsLoaded: mockSetApplicationsLoaded,
    });
  });

  it('keeps children hidden until installed applications are loaded', async () => {
    mockGetInstalledApplicationList.mockResolvedValue([]);

    render(
      <ApplicationsProvider>
        <div data-testid={APPLICATION_CHILDREN_TEST_ID} />
      </ApplicationsProvider>
    );

    expect(screen.getByTestId('full-screen-loader')).toBeInTheDocument();
    expect(
      screen.queryByTestId(APPLICATION_CHILDREN_TEST_ID)
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByTestId(APPLICATION_CHILDREN_TEST_ID)
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId('full-screen-loader')).not.toBeInTheDocument();
    expect(mockSetApplicationsLoaded).toHaveBeenCalledWith(true);
  });

  it('renders children when application permissions are unavailable', async () => {
    mockUsePermissionProvider.mockReturnValue({ permissions: {} });

    render(
      <ApplicationsProvider>
        <div data-testid={APPLICATION_CHILDREN_TEST_ID} />
      </ApplicationsProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId(APPLICATION_CHILDREN_TEST_ID)
      ).toBeInTheDocument();
    });

    expect(mockGetInstalledApplicationList).not.toHaveBeenCalled();
    expect(mockSetApplicationsLoaded).toHaveBeenCalledWith(true);
  });
});
