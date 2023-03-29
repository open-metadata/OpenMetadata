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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { ServiceCategory } from '../../enums/service.enum';
import AddService from './AddService.component';

jest.mock(
  'components/containers/PageLayoutV1',
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

jest.mock('../AddIngestion/AddIngestion.component', () => () => (
  <>AddIngestion</>
));

jest.mock('../common/title-breadcrumb/title-breadcrumb.component', () => () => (
  <>TitleBreadcrumb.component</>
));

jest.mock('../ServiceConfig/ConnectionConfigForm', () => () => (
  <>ConnectionConfigForm</>
));

jest.mock('../IngestionStepper/IngestionStepper.component', () => {
  return jest.fn().mockImplementation(() => <div>IngestionStepper</div>);
});

jest.mock('./Steps/ServiceRequirements', () => {
  return jest.fn().mockReturnValue(<div>Service Requirements</div>);
});

jest.mock('../common/ServiceRightPanel/ServiceRightPanel', () => {
  return jest.fn().mockReturnValue(<div>Right Panel</div>);
});

describe('Test AddService component', () => {
  it('AddService component should render', async () => {
    const { container } = render(
      <AddService
        addIngestion={false}
        handleAddIngestion={jest.fn()}
        ingestionAction="Creating"
        ingestionProgress={0}
        isIngestionCreated={false}
        isIngestionDeployed={false}
        newServiceData={undefined}
        serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
        slashedBreadcrumb={[
          {
            name: 'breadcrumb',
            url: '',
          },
        ]}
        onAddIngestionSave={jest.fn()}
        onAddServiceSave={jest.fn()}
      />
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
