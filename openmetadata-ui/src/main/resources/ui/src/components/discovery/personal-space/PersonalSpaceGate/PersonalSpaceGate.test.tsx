/*
 *  Copyright 2025 Collate.
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
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import PersonalSpaceGate from './PersonalSpaceGate';

const mockGetEntityPermission = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({
    getEntityPermission: mockGetEntityPermission,
  })),
}));

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn(() => mockUseAuth()),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({ currentUser: { id: 'user-id' } })),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<div>ErrorPlaceHolder</div>)
);

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

const renderGate = () =>
  render(
    <PersonalSpaceGate>
      <div>personal-space-children</div>
    </PersonalSpaceGate>
  );

describe('PersonalSpaceGate permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isAdminUser: false });
  });

  it('should render children when ViewAll is granted', async () => {
    mockGetEntityPermission.mockResolvedValue({
      ViewAll: true,
    } as OperationPermission);

    renderGate();

    expect(
      await screen.findByText('personal-space-children')
    ).toBeInTheDocument();
  });

  it('should render the permission placeholder when ViewAll is denied', async () => {
    mockGetEntityPermission.mockResolvedValue({
      ViewBasic: true,
    } as OperationPermission);

    renderGate();

    expect(await screen.findByText('ErrorPlaceHolder')).toBeInTheDocument();
    expect(
      screen.queryByText('personal-space-children')
    ).not.toBeInTheDocument();
  });

  it('should render children for an admin even without ViewAll', async () => {
    mockUseAuth.mockReturnValue({ isAdminUser: true });
    mockGetEntityPermission.mockResolvedValue({} as OperationPermission);

    renderGate();

    expect(
      await screen.findByText('personal-space-children')
    ).toBeInTheDocument();
  });

  it('should render the permission placeholder when the permission fetch fails', async () => {
    mockGetEntityPermission.mockRejectedValue(new Error('failed'));

    renderGate();

    await waitFor(() =>
      expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument()
    );
  });
});
