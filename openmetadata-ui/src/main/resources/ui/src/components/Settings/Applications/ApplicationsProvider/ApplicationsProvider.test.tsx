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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useState } from 'react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getInstalledApplicationList } from '../../../../rest/applicationAPI';
import ApplicationsProvider, {
  useApplicationsProvider,
} from './ApplicationsProvider';

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
const APPLICATION_STATUS_TEST_ID = 'application-loading-status';
const STATEFUL_CHILD_TEST_ID = 'stateful-child';

const createDeferredPromise = <T,>() => {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

const ApplicationsLoadingStatus = () => {
  const { isLoading } = useApplicationsProvider();

  return (
    <div data-loading={isLoading} data-testid={APPLICATION_STATUS_TEST_ID} />
  );
};

const StatefulChild = () => {
  const [count, setCount] = useState(0);

  return (
    <button
      data-testid={STATEFUL_CHILD_TEST_ID}
      onClick={() => setCount((currentCount) => currentCount + 1)}>
      {count}
    </button>
  );
};

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

  it('renders children while installed applications are loading', async () => {
    const applicationsRequest = createDeferredPromise<EntityReference[]>();
    mockGetInstalledApplicationList.mockReturnValue(
      applicationsRequest.promise
    );

    render(
      <ApplicationsProvider>
        <div data-testid={APPLICATION_CHILDREN_TEST_ID} />
        <ApplicationsLoadingStatus />
      </ApplicationsProvider>
    );

    expect(
      screen.getByTestId(APPLICATION_CHILDREN_TEST_ID)
    ).toBeInTheDocument();
    expect(screen.getByTestId(APPLICATION_STATUS_TEST_ID)).toHaveAttribute(
      'data-loading',
      'true'
    );
    expect(screen.queryByTestId('full-screen-loader')).not.toBeInTheDocument();

    await act(async () => {
      applicationsRequest.resolve([]);
      await applicationsRequest.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId(APPLICATION_STATUS_TEST_ID)).toHaveAttribute(
        'data-loading',
        'false'
      );
    });

    expect(mockSetApplicationsLoaded).toHaveBeenCalledWith(true);
  });

  it('preserves child state when the permissions object changes', async () => {
    mockGetInstalledApplicationList.mockResolvedValue([]);
    const { rerender } = render(
      <ApplicationsProvider>
        <StatefulChild />
      </ApplicationsProvider>
    );

    await waitFor(() => {
      expect(mockSetApplicationsLoaded).toHaveBeenCalledWith(true);
    });

    fireEvent.click(screen.getByTestId(STATEFUL_CHILD_TEST_ID));

    expect(screen.getByTestId(STATEFUL_CHILD_TEST_ID)).toHaveTextContent('1');

    mockUsePermissionProvider.mockReturnValue({
      permissions: { app: {}, user: {} },
    });
    rerender(
      <ApplicationsProvider>
        <StatefulChild />
      </ApplicationsProvider>
    );

    expect(screen.getByTestId(STATEFUL_CHILD_TEST_ID)).toHaveTextContent('1');
    expect(mockGetInstalledApplicationList).toHaveBeenCalledTimes(1);
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
