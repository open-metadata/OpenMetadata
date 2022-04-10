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
import { ServiceCategory } from '../../enums/service.enum';
import AddService from './AddService.component';

jest.mock(
  '../containers/PageLayout',
  () =>
    ({
      children,
      rightPanel,
    }: {
      children: React.ReactNode;
      rightPanel: React.ReactNode;
    }) =>
      (
        <div data-testid="PageLayout">
          <div data-testid="right-panel-content">{rightPanel}</div>
          {children}
        </div>
      )
);

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
}));

describe('Test AddService component', () => {
  it('AddService component should render', async () => {
    const { container } = render(
      <AddService serviceCategory={ServiceCategory.DASHBOARD_SERVICES} />
    );

    const pageLayout = await findByTestId(container, 'PageLayout');
    const rightPanel = await findByTestId(container, 'right-panel-content');
    const addNewServiceContainer = await findByTestId(
      container,
      'add-new-service-container'
    );
    const header = await findByTestId(container, 'header');

    expect(addNewServiceContainer).toBeInTheDocument();
    expect(pageLayout).toBeInTheDocument();
    expect(rightPanel).toBeInTheDocument();
    expect(header).toBeInTheDocument();
  });
});
