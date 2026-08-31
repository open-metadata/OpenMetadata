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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { getDataProductPortsView } from '../../../rest/dataProductAPI';
import { InputOutputPortsTab } from './InputOutputPortsTab.component';
import { InputOutputPortsTabProps } from './InputOutputPortsTab.types';

// Consumer via prop — `permissions` stays the raw OperationPermission fed from
// DataProductUtils.tsx's `dataProductPermission` (DataProductsDetailsPage's
// useEntityPermissions owner, Batch 1). No prior test coverage existed for this
// component, so this is a new characterization suite covering the 4 flagged raw
// `permissions.EditAll` reads (now a single `canEditAll` derivation).

jest.mock('../../../rest/dataProductAPI', () => ({
  getDataProductPortsView: jest.fn(),
}));

jest.mock('./PortsLineageView', () => ({
  PortsLineageView: () => <div data-testid="ports-lineage-view" />,
}));

jest.mock('./PortsListView', () => ({
  PortsListView: () => <div data-testid="ports-list-view" />,
}));

jest.mock('../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer', () => ({
  AssetSelectionDrawer: () => null,
}));

const mockDataProduct: DataProduct = {
  id: 'dp-id',
  name: 'test-data-product',
  fullyQualifiedName: 'test.dataproduct',
  description: 'Test description',
} as DataProduct;

const basePermissions = {} as OperationPermission;

const defaultProps: InputOutputPortsTabProps = {
  dataProduct: mockDataProduct,
  dataProductFqn: 'test.dataproduct',
  permissions: basePermissions,
  assetCount: 5,
  onPortsUpdate: jest.fn(),
};

const mockGetDataProductPortsView =
  getDataProductPortsView as jest.Mock;

const setPortCounts = (inputTotal: number, outputTotal: number) => {
  mockGetDataProductPortsView.mockResolvedValue({
    inputPorts: { data: [], paging: { total: inputTotal } },
    outputPorts: { data: [], paging: { total: outputTotal } },
  });
};

describe('InputOutputPortsTab — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the header add-port buttons when EditAll is granted and ports exist', async () => {
    setPortCounts(3, 3);
    render(
      <InputOutputPortsTab
        {...defaultProps}
        permissions={{ ...basePermissions, EditAll: true } as OperationPermission}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('add-input-port-button')[0]).toBeInTheDocument();
    });
    expect(
      screen.getAllByTestId('add-output-port-button')[0]
    ).toBeInTheDocument();
  });

  it('hides the header add-port buttons when EditAll is denied', async () => {
    setPortCounts(3, 3);
    render(
      <InputOutputPortsTab
        {...defaultProps}
        permissions={{ ...basePermissions, EditAll: false } as OperationPermission}
      />
    );

    await waitFor(() => {
      expect(mockGetDataProductPortsView).toHaveBeenCalled();
    });
    expect(
      screen.queryByTestId('add-input-port-button')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-output-port-button')
    ).not.toBeInTheDocument();
  });

  it('shows the empty-state add-port buttons when EditAll is granted and no ports exist', async () => {
    setPortCounts(0, 0);
    render(
      <InputOutputPortsTab
        {...defaultProps}
        permissions={{ ...basePermissions, EditAll: true } as OperationPermission}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('add-input-port-button')).toBeInTheDocument();
    });
    expect(screen.getByTestId('add-output-port-button')).toBeInTheDocument();
  });

  it('hides the empty-state add-port buttons when EditAll is denied', async () => {
    setPortCounts(0, 0);
    render(
      <InputOutputPortsTab
        {...defaultProps}
        permissions={{ ...basePermissions, EditAll: false } as OperationPermission}
      />
    );

    await waitFor(() => {
      expect(mockGetDataProductPortsView).toHaveBeenCalled();
    });
    expect(
      screen.queryByTestId('add-input-port-button')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('add-output-port-button')
    ).not.toBeInTheDocument();
  });
});
