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

import { findByText, render } from '@testing-library/react';
import React from 'react';
import { ReactNode } from 'react-markdown';
import MyDataPageComponent from './MyDataPage.component';

jest.mock('../../components/MyData/MyData.component', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="my-data-component">Mydata component</p>);
});

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        aggregations: {
          'sterms#Service': {
            buckets: [],
          },
        },
        hits: [],
      },
    })
  ),
}));

jest.mock('../../axiosAPIs/airflowPipelineAPI', () => ({
  getAirflowPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        data: [],
      },
    })
  ),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getAllServices: jest.fn().mockImplementation(() => Promise.resolve(['test'])),
  getEntityCountByService: jest.fn().mockReturnValue({
    tableCount: 0,
    topicCount: 0,
    dashboardCount: 0,
    pipelineCount: 0,
  }),
}));

const mockAuth = {
  isAuthDisabled: true,
};

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn(() => mockAuth),
}));

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({
    pathname: 'pathname',
  }),
}));

jest.mock('../../utils/APIUtils', () => ({
  formatDataResponse: jest.fn(),
}));

jest.mock('../../components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }: { children: ReactNode }) => (
      <div data-testid="PageContainerV1">{children}</div>
    ));
});

jest.mock('../../components/MyData/MyData.component', () => {
  return jest.fn().mockImplementation(() => <p>MyData.component</p>);
});

describe('Test MyData page component', () => {
  it('Component should render', async () => {
    const { container } = render(<MyDataPageComponent />);

    const myData = await findByText(container, /MyData.component/i);

    expect(myData).toBeInTheDocument();
  });
});
