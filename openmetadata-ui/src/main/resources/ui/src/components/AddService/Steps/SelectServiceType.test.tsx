/*
 *  Copyright 2021 Collate
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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import SelectServiceType from './SelectServiceType';
import { SelectServiceTypeProps } from './Steps.interface';

const mockSelectServiceTypeProps: SelectServiceTypeProps = {
  showError: false,
  serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
  serviceCategoryHandler: jest.fn(),
  selectServiceType: '',
  handleServiceTypeClick: jest.fn(),
  onCancel: jest.fn(),
  onNext: jest.fn(),
};

describe('Test SelectServiceType component', () => {
  it('SelectServiceType component should render', async () => {
    const { container } = render(
      <SelectServiceType {...mockSelectServiceTypeProps} />
    );

    const serviceCategory = await findByTestId(container, 'service-category');
    const selectService = await findByTestId(container, 'select-service');
    const previousButton = await findByTestId(container, 'previous-button');
    const nextButton = await findByTestId(container, 'next-button');

    expect(serviceCategory).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(previousButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
  });
});
