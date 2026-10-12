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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { ServicesType } from '../../../interface/service.interface';
import DataAssetsTab from './DataAssetsTab';

const DATA_PRODUCT = {
  id: 'dp-1',
  type: 'dataProduct',
  name: 'sales',
  fullyQualifiedName: 'sales',
};
const DOMAIN = { id: 'domain-1', type: 'domain', fullyQualifiedName: 'Sales' };
const FULL_PERMISSION = { EditAll: true, ViewAll: true };

const mockEntityRules = {
  canAddMultipleDataProducts: true,
  requireDomainForDataProduct: false,
};

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: mockEntityRules,
    isRulesLoaded: true,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Accordion: Passthrough,
    AccordionHeader: Passthrough,
    AccordionItem: Passthrough,
    AccordionPanel: Passthrough,
  };
});

jest.mock('../../../pages/ServiceDetailsPage/ServiceMainTabContent', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../common/EntityDescription/Description', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../common/GlossaryTermsSection/GlossaryTermsSection', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../common/TagsSection/TagsSection', () => ({
  __esModule: true,
  default: () => null,
}));

// The picker, search and chips are the container's own concern; this asserts what the tab hands it.
jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => ({
    __esModule: true,
    default: ({
      activeDomains,
      dataProducts,
      hasPermission,
      multiple,
      requireDomainForDataProduct,
      onSave,
    }: {
      activeDomains?: { fullyQualifiedName?: string }[];
      dataProducts: { fullyQualifiedName?: string }[];
      hasPermission: boolean;
      multiple?: boolean;
      requireDomainForDataProduct?: boolean;
      onSave?: (dataProducts: DataProduct[]) => Promise<void>;
    }) => (
      <div
        data-active-domains={activeDomains
          ?.map((domain) => domain.fullyQualifiedName)
          .join(',')}
        data-has-permission={String(hasPermission)}
        data-multiple={String(multiple)}
        data-require-domain={String(requireDomainForDataProduct)}
        data-testid="data-products-container">
        {dataProducts.map((dataProduct) => (
          <span key={dataProduct.fullyQualifiedName}>
            {dataProduct.fullyQualifiedName}
          </span>
        ))}
        <button
          onClick={() => onSave?.([DATA_PRODUCT as unknown as DataProduct])}>
          save-data-products
        </button>
      </div>
    ),
  })
);

const renderTab = ({
  serviceCategory = ServiceCategory.DASHBOARD_SERVICES,
  serviceDetails = {},
  servicePermission = FULL_PERMISSION,
  onDataProductUpdate = jest.fn(),
}: {
  serviceCategory?: ServiceCategory;
  serviceDetails?: Record<string, unknown>;
  servicePermission?: Record<string, boolean>;
  onDataProductUpdate?: jest.Mock;
} = {}) =>
  render(
    <DataAssetsTab
      currentPage={1}
      data={[]}
      isServiceLoading={false}
      paging={{ total: 0 }}
      pagingInfo={
        {} as React.ComponentProps<typeof DataAssetsTab>['pagingInfo']
      }
      saveUpdatedServiceData={jest.fn()}
      serviceCategory={serviceCategory}
      serviceDetails={
        {
          id: 'svc-1',
          name: 'power-bi',
          tags: [],
          domains: [DOMAIN],
          dataProducts: [DATA_PRODUCT],
          ...serviceDetails,
        } as unknown as ServicesType
      }
      servicePermission={
        servicePermission as unknown as React.ComponentProps<
          typeof DataAssetsTab
        >['servicePermission']
      }
      setFilters={jest.fn()}
      setIsServiceLoading={jest.fn()}
      showDeleted={false}
      onDataProductUpdate={onDataProductUpdate}
      onDescriptionUpdate={jest.fn()}
      onShowDeletedChange={jest.fn()}
    />
  );

// Issue #35270: classic shows data products in a right panel that AI mode hides.
describe('DataAssetsTab data products', () => {
  it('shows the service data products under its domains', () => {
    renderTab();

    const container = screen.getByTestId('data-products-container');

    expect(container).toHaveTextContent('sales');
    expect(container).toHaveAttribute('data-active-domains', 'Sales');
  });

  it('follows the data product entity rules', () => {
    renderTab();

    const container = screen.getByTestId('data-products-container');

    expect(container).toHaveAttribute('data-multiple', 'true');
    expect(container).toHaveAttribute('data-require-domain', 'false');
  });

  it('saves an edit through onDataProductUpdate', () => {
    const onDataProductUpdate = jest.fn().mockResolvedValue(undefined);
    renderTab({ onDataProductUpdate });

    fireEvent.click(screen.getByText('save-data-products'));

    expect(onDataProductUpdate).toHaveBeenCalledWith([DATA_PRODUCT]);
  });

  it('lets a user who may edit the service change them', () => {
    renderTab();

    expect(screen.getByTestId('data-products-container')).toHaveAttribute(
      'data-has-permission',
      'true'
    );
  });

  it('is read-only for a user who may only view the service', () => {
    renderTab({ servicePermission: { ViewAll: true } });

    expect(screen.getByTestId('data-products-container')).toHaveAttribute(
      'data-has-permission',
      'false'
    );
  });

  it('is read-only on a soft-deleted service', () => {
    renderTab({ serviceDetails: { deleted: true } });

    expect(screen.getByTestId('data-products-container')).toHaveAttribute(
      'data-has-permission',
      'false'
    );
  });

  it('shows an empty, editable section for a service with no data products yet', () => {
    renderTab({ serviceDetails: { dataProducts: undefined } });

    expect(screen.getByTestId('data-products-container')).not.toHaveTextContent(
      'sales'
    );
  });

  it('has no data products section for a metadata service', () => {
    renderTab({ serviceCategory: ServiceCategory.METADATA_SERVICES });

    expect(
      screen.queryByTestId('data-products-container')
    ).not.toBeInTheDocument();
  });
});
