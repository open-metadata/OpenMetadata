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

import { findByTestId, findByText, render } from '@testing-library/react';
import React, { ReactNode } from 'react';
import AddServicePage from './AddServicePage.component';

const mockParam = {
  serviceCategory: 'databaseServices',
};

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/AddService/AddService.component', () => {
  return jest.fn().mockImplementation(() => <div>AddService.component</div>);
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => mockParam),
}));

describe('Test AddServicePage component', () => {
  it('AddServicePage component should render', async () => {
    const { container } = render(<AddServicePage />);

    const addServiceComponent = await findByText(
      container,
      /AddService.component/i
    );
    const pageContainerV1 = await findByTestId(container, 'PageContainerV1');

    expect(addServiceComponent).toBeInTheDocument();
    expect(pageContainerV1).toBeInTheDocument();
  });
});
