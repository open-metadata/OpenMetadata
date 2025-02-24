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

import { findByText, render } from '@testing-library/react';
import React from 'react';
import AddServicePage from './AddServicePage.component';

const mockParam = {
  serviceCategory: 'databaseServices',
};

jest.mock(
  '../../components/Settings/Services/AddService/AddService.component',
  () => {
    return jest.fn().mockImplementation(() => <div>AddService.component</div>);
  }
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation(
    () =>
      (Component: React.FC) =>
      (
        props: JSX.IntrinsicAttributes & {
          children?: React.ReactNode | undefined;
        }
      ) =>
        <Component {...props} />
  ),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => mockParam),
}));

jest.mock('../../constants/constants', () => ({
  DEPLOYED_PROGRESS_VAL: 0,
  INGESTION_PROGRESS_END_VAL: 0,
  INGESTION_PROGRESS_START_VAL: 0,
}));

jest.mock('../../rest/serviceAPI', () => ({
  postService: jest.fn(),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getSettingPath: jest.fn(),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getServiceRouteFromServiceType: jest.fn(),
}));

describe('Test AddServicePage component', () => {
  it('AddServicePage component should render', async () => {
    const { container } = render(<AddServicePage />);

    const addServiceComponent = await findByText(
      container,
      /AddService.component/i
    );

    expect(addServiceComponent).toBeInTheDocument();
  });
});
