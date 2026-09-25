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
import { act, render, screen } from '@testing-library/react';
import { DetailPageWidgetKeys } from '../../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { DataProductsWidget } from './DataProductsWidget';

jest.mock('../../../Customization/GenericProvider/GenericContext');

const mockContainer = jest.fn();

jest.mock(
  '../../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockContainer(props);

      return <div data-testid="data-products" />;
    },
  })
);

const mockOnUpdate = jest.fn();

describe('DataProductsWidget', () => {
  it('saves the selected data products as entity references', async () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { id: 'id-1', name: 'orders', domains: [] },
      permissions: { EditAll: true },
      entityRules: {
        canAddMultipleDataProducts: true,
        requireDomainForDataProduct: false,
      },
      isRulesLoaded: true,
      onUpdate: mockOnUpdate,
    });

    render(
      <DataProductsWidget
        showTaskHandler
        entityType={EntityType.TABLE}
        widgetConfig={{
          i: DetailPageWidgetKeys.DATA_PRODUCTS,
          x: 0,
          y: 0,
          w: 1,
          h: 1,
        }}
      />
    );
    await screen.findByTestId('data-products');

    const { onSave, dataProducts } = mockContainer.mock.calls[0][0];

    expect(dataProducts).toEqual([]);

    await act(async () => {
      await onSave([
        { id: 'dp-1', name: 'sales', fullyQualifiedName: 'sales' },
      ]);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        dataProducts: [
          expect.objectContaining({
            id: 'dp-1',
            type: EntityType.DATA_PRODUCT,
          }),
        ],
      })
    );
  });
});
