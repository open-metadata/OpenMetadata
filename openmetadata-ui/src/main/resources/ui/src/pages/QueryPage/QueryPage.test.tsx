/*
 *  Copyright 2023 Collate.
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
import { MOCK_QUERIES } from '../../mocks/Queries.mock';
import { MOCK_TABLE } from '../../mocks/TableData.mock';
import QueryPage from './QueryPage.component';

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ search: '' }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({
    fqn: 'testDatasetFQN',
    queryId: 'queryId',
  })),
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockReturnValue({
      ViewAll: true,
      EditAll: true,
    }),
  }),
}));
jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);
jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});
jest.mock('../../components/Database/TableQueries/QueryCard', () => {
  return jest.fn().mockImplementation(() => <div>QueryCard</div>);
});
jest.mock('../../rest/queryAPI', () => ({
  ...jest.requireActual('../../rest/queryAPI'),
  getQueryById: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_QUERIES[0])),
}));
jest.mock('../../rest/tableAPI', () => ({
  ...jest.requireActual('../../rest/queryAPI'),
  getTableDetailsByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TABLE)),
}));

describe('QueryFilters component test', () => {
  it('Component should render', async () => {
    await act(async () => {
      render(<QueryPage />);
    });

    expect(await screen.findByText('TitleBreadcrumb')).toBeInTheDocument();
    expect(await screen.findByText('QueryCard')).toBeInTheDocument();
  });
});
