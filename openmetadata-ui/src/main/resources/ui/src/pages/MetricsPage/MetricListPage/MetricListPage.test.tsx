/*
 *  Copyright 2025 Collate.
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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { METRICS_DOCS } from '../../../constants/docs.constants';

import MetricListPage from './MetricListPage';

const mockLocationPathname = '/mock-path';
// Mocking react-router-dom hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
  })),
  useNavigate: jest.fn(),
}));

// Mock permission provider to simulate access rights
jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      metric: { ViewAll: true, ViewBasic: true, Create: true },
    },
    getResourcePermission: jest.fn().mockResolvedValue({
      ViewAll: true,
      ViewBasic: true,
      Create: true,
    }),
  }),
}));

// Mock metrics API to return an empty list
jest.mock('../../../rest/metricsAPI', () => ({
  getMetrics: jest.fn().mockResolvedValue({
    data: [],
    paging: {},
  }),
}));

// Mock the empty state placeholder to render a docs link
jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => ({
    __esModule: true,
    default: ({ doc }: { doc: string }) => (
      <div data-testid="error-placeholder">
        <a href={doc} rel="noreferrer" target="_blank">
          docs
        </a>
      </div>
    ),
  })
);

// Mock PageLayoutV1 to simply render children without layout logic
jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('MetricListPage', () => {
  it('renders the docs link with correct URL when empty state is shown', async () => {
    render(
      <MemoryRouter>
        <MetricListPage />
      </MemoryRouter>
    );

    const link = await screen.findByText('docs');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', METRICS_DOCS);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });
});
