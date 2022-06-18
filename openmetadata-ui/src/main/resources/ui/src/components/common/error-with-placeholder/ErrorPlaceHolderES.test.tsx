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

import { getByTestId, getByText, render } from '@testing-library/react';
import React from 'react';
import ErrorPlaceHolderES from './ErrorPlaceHolderES';

jest.mock('../../../AppState', () => ({
  userDetails: {
    name: 'testUser',
    displayName: 'Test User',
  },
  users: [{ name: 'user1', displayName: 'User1DN' }],
}));

jest.mock('../../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      authConfig: {},
      isAuthDisabled: true,
      setIsAuthenticated: jest.fn(),
      onLogoutHandler: jest.fn(),
    })),
  };
});

const mockErrorMessage =
  'An exception with message [Elasticsearch exception [type=index_not_found_exception, reason=no such index [test_search_index]]] was thrown while processing request.';

describe('Test Error placeholder ingestion Component', () => {
  it('Component should render error placeholder', () => {
    const { container } = render(<ErrorPlaceHolderES type="error" />);

    expect(getByTestId(container, 'es-error')).toBeInTheDocument();
  });

  it('Component should render no data placeholder', () => {
    const { container } = render(<ErrorPlaceHolderES type="noData" />);

    expect(getByTestId(container, 'no-search-results')).toBeInTheDocument();
  });

  it('Component should render no data placeholder for search text', () => {
    const { container } = render(
      <ErrorPlaceHolderES query="test" type="noData" />
    );
    const noDataES = getByTestId(container, 'no-search-results');
    const searchText = getByText(noDataES, 'test');

    expect(searchText).toBeInTheDocument();
  });

  it('Component should render error placeholder with ES index', () => {
    const { container } = render(
      <ErrorPlaceHolderES errorMessage={mockErrorMessage} type="error" />
    );
    const errorES = getByTestId(container, 'es-error');
    const errMsg = getByTestId(errorES, 'error-text');

    expect(errMsg.textContent).toMatch(/test_search_index/i);
  });
});
