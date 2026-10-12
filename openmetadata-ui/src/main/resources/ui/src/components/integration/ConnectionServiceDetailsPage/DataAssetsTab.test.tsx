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
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ServiceCategory } from '../../../enums/service.enum';
import { ServicesType } from '../../../interface/service.interface';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import DataAssetsTab from './DataAssetsTab';

let mockEntityRules = {
  entityRules: {
    canAddMultipleDataProducts: true,
    requireDomainForDataProduct: false,
  },
  isRulesLoaded: true,
};

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => mockEntityRules,
}));

jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => jest.fn(() => <div data-testid="data-products-container" />)
);

jest.mock('../../../pages/ServiceDetailsPage/ServiceMainTabContent', () =>
  jest.fn(() => <div data-testid="service-main-tab-content" />)
);

jest.mock('../../common/EntityDescription/Description', () =>
  jest.fn(() => null)
);

jest.mock('../../common/GlossaryTermsSection/GlossaryTermsSection', () =>
  jest.fn(() => null)
);

jest.mock('../../common/TagsSection/TagsSection', () => jest.fn(() => null));

jest.mock('@openmetadata/ui-core-components', () => {
  const Passthrough = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );

  return {
    Accordion: Passthrough,
    AccordionHeader: Passthrough,
    AccordionItem: Passthrough,
    AccordionPanel: Passthrough,
  };
});

const DOMAIN = { id: 'domain-1', type: 'domain', name: 'Sales' };
const DATA_PRODUCT = { id: 'dp-1', type: 'dataProduct', name: 'Revenue' };

const EDIT_ALL = {
  ...DEFAULT_ENTITY_PERMISSION,
  EditAll: true,
  ViewAll: true,
} as OperationPermission;

const onDataProductUpdate = jest.fn();

const renderTab = ({
  serviceCategory = ServiceCategory.DATABASE_SERVICES,
  permission = EDIT_ALL,
  deleted = false,
}: {
  serviceCategory?: ServiceCategory;
  permission?: OperationPermission;
  deleted?: boolean;
} = {}) =>
  render(
    <DataAssetsTab
      currentPage={1}
      data={[]}
      isServiceLoading={false}
      paging={{ total: 0 }}
      pagingInfo={{} as never}
      saveUpdatedServiceData={jest.fn()}
      serviceCategory={serviceCategory}
      serviceDetails={
        {
          id: 'svc-1',
          name: 'svc',
          deleted,
          domains: [DOMAIN],
          dataProducts: [DATA_PRODUCT],
        } as unknown as ServicesType
      }
      servicePermission={permission}
      setFilters={jest.fn()}
      setIsServiceLoading={jest.fn()}
      showDeleted={false}
      onDataProductUpdate={onDataProductUpdate}
      onDescriptionUpdate={jest.fn()}
      onShowDeletedChange={jest.fn()}
    />
  );

const lastDataProductsProps = () =>
  (DataProductsContainer as unknown as jest.Mock).mock.calls.at(-1)?.[0];

describe('DataAssetsTab — data products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEntityRules = {
      entityRules: {
        canAddMultipleDataProducts: true,
        requireDomainForDataProduct: false,
      },
      isRulesLoaded: true,
    };
  });

  // Classic shows these in the right panel, which this tab hides.
  it("shows the service's data products against its domains", () => {
    renderTab();

    expect(screen.getByTestId('service-data-products')).toBeInTheDocument();
    expect(lastDataProductsProps()).toEqual(
      expect.objectContaining({
        activeDomains: [DOMAIN],
        dataProducts: [DATA_PRODUCT],
        hasPermission: true,
        onSave: onDataProductUpdate,
      })
    );
  });

  it('follows the entity rules for multiple data products and a required domain', () => {
    renderTab();

    expect(lastDataProductsProps()).toEqual(
      expect.objectContaining({
        multiple: true,
        requireDomainForDataProduct: false,
      })
    );
  });

  it('allows one data product and requires a domain until the rules load', () => {
    mockEntityRules = { ...mockEntityRules, isRulesLoaded: false };
    renderTab();

    expect(lastDataProductsProps()).toEqual(
      expect.objectContaining({
        multiple: false,
        requireDomainForDataProduct: true,
      })
    );
  });

  it('is read-only without EditAll', () => {
    renderTab({
      permission: { ...EDIT_ALL, EditAll: false } as OperationPermission,
    });

    expect(lastDataProductsProps()).toEqual(
      expect.objectContaining({ hasPermission: false })
    );
  });

  it('is read-only on a soft-deleted service', () => {
    renderTab({ deleted: true });

    expect(lastDataProductsProps()).toEqual(
      expect.objectContaining({ hasPermission: false })
    );
  });

  it('is not offered for a metadata service, as in classic', () => {
    renderTab({ serviceCategory: ServiceCategory.METADATA_SERVICES });

    expect(screen.getByTestId('service-main-tab-content')).toBeInTheDocument();
    expect(
      screen.queryByTestId('service-data-products')
    ).not.toBeInTheDocument();
  });
});
