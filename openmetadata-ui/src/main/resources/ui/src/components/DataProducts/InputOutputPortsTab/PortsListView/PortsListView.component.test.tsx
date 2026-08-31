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
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { getDataProductInputPorts } from '../../../../rest/dataProductAPI';
import PortsListView from './PortsListView.component';
import { PortsListViewProps } from './PortsListView.types';

// Consumer via prop — `permissions` stays the raw OperationPermission fed from
// InputOutputPortsTab (same DataProductUtils.tsx-owned `dataProductPermission` as
// the sibling file). No prior test coverage existed for this component, so this is
// a new characterization suite for the 1 flagged raw `permissions.EditAll` read
// (now `canEditAll`), which gates the row's action-menu Dropdown trigger.

jest.mock('../../../../rest/dataProductAPI', () => ({
  getDataProductInputPorts: jest.fn(),
  getDataProductOutputPorts: jest.fn(),
}));

// ExploreSearchCard is a large real card renderer — mocked so the test asserts
// directly on the `actionPopoverContent` prop the component computes, rather than
// driving the real card's DOM.
jest.mock('../../../ExploreV1/ExploreSearchCard/ExploreSearchCard', () =>
  jest.fn().mockImplementation(({ actionPopoverContent, id }) => (
    <div data-testid={`explore-card-${id}`}>{actionPopoverContent}</div>
  ))
);

const mockGetDataProductInputPorts =
  getDataProductInputPorts as jest.Mock;

const defaultProps: PortsListViewProps = {
  dataProductFqn: 'test.dataproduct',
  portType: 'input',
  permissions: {} as OperationPermission,
  onRemovePort: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDataProductInputPorts.mockResolvedValue({
    data: [{ id: 'port-1', name: 'port-1', entityType: 'table' }],
    paging: { total: 1 },
  });
});

describe('PortsListView — permissions', () => {
  it('shows the row action menu trigger when EditAll is granted', async () => {
    render(
      <MemoryRouter>
        <PortsListView
          {...defaultProps}
          permissions={{ EditAll: true } as OperationPermission}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('port-actions-port-1')).toBeInTheDocument();
    });
  });

  it('hides the row action menu trigger when EditAll is denied', async () => {
    render(
      <MemoryRouter>
        <PortsListView
          {...defaultProps}
          permissions={{ EditAll: false } as OperationPermission}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('explore-card-port-1')).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('port-actions-port-1')
    ).not.toBeInTheDocument();
  });
});
