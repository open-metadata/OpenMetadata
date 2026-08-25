/*
 *  Copyright 2022 Collate.
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
  findByTestId,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  ALL_SERVICES_CATEGORY,
  excludedService,
} from '../../../../../constants/Services.constant';
import { ServiceCategory } from '../../../../../enums/service.enum';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import SelectServiceType from './SelectServiceType';
import { SelectServiceTypeProps } from './Steps.interface';

const mockHandleServiceTypeClick = jest.fn();

const mockSelectServiceTypeProps: SelectServiceTypeProps = {
  showError: false,
  serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
  serviceCategoryHandler: jest.fn(),
  handleServiceTypeClick: mockHandleServiceTypeClick,
};

jest.mock('../../../../common/SearchBarComponent/SearchBar.component', () =>
  jest.fn().mockImplementation(() => <div>Searchbar</div>)
);

const supportedServices =
  serviceUtilClassBase.getSupportedServiceFromList() as Record<
    string,
    string[]
  >;

const connectorsFor = (category: ServiceCategory) =>
  (supportedServices[category] ?? []).filter(
    (type) => !excludedService.includes(type as never)
  );

describe('Test SelectServiceType component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('SelectServiceType component should render', async () => {
    const { container } = render(
      <SelectServiceType {...mockSelectServiceTypeProps} />
    );

    const serviceCategory = await findByTestId(container, 'service-category');
    const selectService = await findByTestId(container, 'select-service');

    expect(serviceCategory).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
  });

  it('shows only the given category connectors when a concrete category is set', () => {
    render(
      <SelectServiceType
        {...mockSelectServiceTypeProps}
        serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
      />
    );

    const dashboardConnectors = connectorsFor(
      ServiceCategory.DASHBOARD_SERVICES
    );

    expect(screen.getByTestId('select-service').children).toHaveLength(
      dashboardConnectors.length
    );
    // A connector from another category must not leak into a scoped grid.
    expect(
      screen.queryByTestId(connectorsFor(ServiceCategory.DATABASE_SERVICES)[0])
    ).not.toBeInTheDocument();
  });

  it('flattens every category connector when the all sentinel is set', () => {
    render(
      <SelectServiceType
        {...mockSelectServiceTypeProps}
        serviceCategory={ALL_SERVICES_CATEGORY}
      />
    );

    const expectedCount = Object.values(ServiceCategory).reduce(
      (total, category) => total + connectorsFor(category).length,
      0
    );

    expect(screen.getByTestId('select-service').children).toHaveLength(
      expectedCount
    );
    // Connectors from unrelated categories are on screen together.
    expect(
      screen.getByTestId(connectorsFor(ServiceCategory.DATABASE_SERVICES)[0])
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(connectorsFor(ServiceCategory.API_SERVICES)[0])
    ).toBeInTheDocument();
  });

  it('reports the category a flattened card belongs to on click', () => {
    render(
      <SelectServiceType
        {...mockSelectServiceTypeProps}
        serviceCategory={ALL_SERVICES_CATEGORY}
      />
    );

    const apiConnector = connectorsFor(ServiceCategory.API_SERVICES)[0];

    fireEvent.click(screen.getByTestId(apiConnector));

    // The second argument is what lets the page continue in the right category's wizard.
    expect(mockHandleServiceTypeClick).toHaveBeenCalledWith(
      apiConnector,
      ServiceCategory.API_SERVICES
    );
  });

  it('passes the current category for a card in a scoped grid', () => {
    render(
      <SelectServiceType
        {...mockSelectServiceTypeProps}
        serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
      />
    );

    const dashboardConnector = connectorsFor(
      ServiceCategory.DASHBOARD_SERVICES
    )[0];

    fireEvent.click(screen.getByTestId(dashboardConnector));

    expect(mockHandleServiceTypeClick).toHaveBeenCalledWith(
      dashboardConnector,
      ServiceCategory.DASHBOARD_SERVICES
    );
  });

  it('falls back to the first category for an unrecognized value', () => {
    render(
      <SelectServiceType
        {...mockSelectServiceTypeProps}
        serviceCategory={'notACategory' as ServiceCategory}
      />
    );

    // Unknown values still degrade to databases — only the `all` sentinel is a real selection.
    expect(screen.getByTestId('select-service').children).toHaveLength(
      connectorsFor(ServiceCategory.DATABASE_SERVICES).length
    );
  });

  it('excludes unsupported connectors from the flattened grid', () => {
    render(
      <SelectServiceType
        {...mockSelectServiceTypeProps}
        serviceCategory={ALL_SERVICES_CATEGORY}
      />
    );

    excludedService.forEach((type) => {
      expect(screen.queryByTestId(type)).not.toBeInTheDocument();
    });
  });
});
