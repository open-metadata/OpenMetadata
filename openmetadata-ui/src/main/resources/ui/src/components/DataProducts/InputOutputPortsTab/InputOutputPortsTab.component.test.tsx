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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import {
  getDataProductInputPorts,
  getDataProductOutputPorts,
  getDataProductPortsView,
} from '../../../rest/dataProductAPI';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { InputOutputPortsTab } from './InputOutputPortsTab.component';
import { InputOutputPortsTabProps } from './InputOutputPortsTab.types';

jest.mock('../../../rest/dataProductAPI', () => ({
  getDataProductPortsView: jest.fn(),
  getDataProductInputPorts: jest.fn(),
  getDataProductOutputPorts: jest.fn(),
}));

jest.mock('./PortsLineageView/PortsLineageView.component', () => ({
  __esModule: true,
  default: () => <div data-testid="ports-lineage-view" />,
}));

jest.mock('./PortsListView/PortsListView.component', () => ({
  __esModule: true,
  default: () => <div data-testid="ports-list-view" />,
}));

const mockAssetSelectionDrawer = jest.fn();

jest.mock('../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer', () => ({
  AssetSelectionDrawer: (props: unknown) => {
    mockAssetSelectionDrawer(props);

    return null;
  },
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

const mockGetDataProductPortsView = getDataProductPortsView as jest.Mock;

const setPortCounts = (inputTotal: number, outputTotal: number) => {
  mockGetDataProductPortsView.mockResolvedValue({
    inputPorts: { data: [], paging: { total: inputTotal } },
    outputPorts: { data: [], paging: { total: outputTotal } },
  });
};

describe('InputOutputPortsTab — port pickers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides the input ports from the output port picker', async () => {
    setPortCounts(1, 0);
    (getDataProductInputPorts as jest.Mock).mockResolvedValue({
      data: [{ id: 'input-port-id' }],
      paging: { total: 1 },
    });
    render(
      <InputOutputPortsTab
        {...defaultProps}
        permissions={
          { ...basePermissions, EditAll: true } as OperationPermission
        }
      />
    );

    fireEvent.click(await screen.findByTestId('add-output-port-button'));

    await waitFor(() => {
      expect(mockAssetSelectionDrawer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          type: AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT,
          open: true,
          queryFilter: {
            query: {
              bool: {
                must: [
                  {
                    term: {
                      'dataProducts.fullyQualifiedName': 'test.dataproduct',
                    },
                  },
                ],
                must_not: [{ ids: { values: ['input-port-id'] } }],
              },
            },
          },
        })
      );
    });
  });

  it('keeps each picker on its own exclusions when the other picker is opened mid-fetch', async () => {
    setPortCounts(0, 0);
    let releaseInputPorts: (value: unknown) => void = jest.fn();
    (getDataProductInputPorts as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        releaseInputPorts = resolve;
      })
    );
    (getDataProductOutputPorts as jest.Mock).mockResolvedValue({
      data: [{ id: 'output-port-id' }],
      paging: { total: 1 },
    });
    render(
      <InputOutputPortsTab
        {...defaultProps}
        permissions={
          { ...basePermissions, EditAll: true } as OperationPermission
        }
      />
    );

    fireEvent.click(await screen.findByTestId('add-output-port-button'));
    fireEvent.click(screen.getByTestId('add-input-port-button'));
    await waitFor(() => expect(getDataProductOutputPorts).toHaveBeenCalled());
    releaseInputPorts({
      data: [{ id: 'input-port-id' }],
      paging: { total: 1 },
    });

    const lastPropsOf = (type: AssetsOfEntity) =>
      mockAssetSelectionDrawer.mock.calls
        .map(([props]) => props)
        .filter((props) => props.type === type)
        .pop();

    await waitFor(() => {
      expect(
        lastPropsOf(AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT)
      ).toMatchObject({
        open: true,
        queryFilter: {
          query: {
            bool: { must_not: [{ ids: { values: ['input-port-id'] } }] },
          },
        },
      });
    });

    expect(lastPropsOf(AssetsOfEntity.DATA_PRODUCT_INPUT_PORT)).toMatchObject({
      open: true,
      queryFilter: {
        query: {
          bool: { must_not: [{ ids: { values: ['output-port-id'] } }] },
        },
      },
    });
  });
});
