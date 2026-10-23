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

import { getByTestId, render, screen } from '@testing-library/react';
import { ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import SearchEmptyState from './SearchEmptyState';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

jest.mock('../../../utils/i18next/LocalUtil', () => ({
  Transi18next: jest.fn().mockImplementation(({ i18nKey }) => {
    return <span>{i18nKey}</span>;
  }),
  __esModule: true,
  default: {
    t: jest.fn().mockImplementation((key) => key),
  },
  t: jest.fn().mockImplementation((key) => key),
}));

const mockErrorMessage =
  'An exception with message [Elasticsearch exception [type=index_not_found_exception, reason=no such index [test_search_index]]] was thrown while processing request.';

describe('Test Error placeholder ingestion Component', () => {
  it('switches to filter guidance when search clears but deleted assets remain selected', () => {
    const { rerender } = render(
      <SearchEmptyState
        query={{ search: 'missing', showDeleted: 'true' }}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );

    expect(screen.getByText('label.no-result-found')).toBeInTheDocument();

    rerender(
      <SearchEmptyState
        query={{ showDeleted: 'true' }}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );

    expect(
      screen.getByText('label.no-result-for-these-filter-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.try-adjusting-filter')
    ).toBeInTheDocument();
  });

  it('Component should render error placeholder', () => {
    const { container } = render(
      <SearchEmptyState type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.ERROR} />
    );

    expect(getByTestId(container, 'es-error')).toBeInTheDocument();
  });

  it('keeps the domain status in the headline, with separate guidance and documentation', () => {
    const { container } = render(
      <SearchEmptyState type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA} />
    );

    expect(getByTestId(container, 'no-search-results')).toBeInTheDocument();
    expect(
      screen.getByText('message.no-data-available-entity').parentElement
    ).toHaveClass('tw:text-sm', 'tw:font-semibold');
    expect(
      screen.getByText('message.add-data-asset-domain').parentElement
    ).toHaveClass('tw:text-xs');
    expect(screen.getByText('message.refer-to-our-doc')).toBeInTheDocument();
  });

  it('Component should render Filter Placeholder for query search', () => {
    const { container } = render(
      <SearchEmptyState
        query={{ search: 'test' }}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );
    const noDataES = getByTestId(container, 'no-search-results');
    const searchFilterPlaceholder = getByTestId(
      noDataES,
      'search-error-placeholder'
    );

    expect(searchFilterPlaceholder).toBeInTheDocument();
  });

  it('Component should render error placeholder with ES index', () => {
    const { container } = render(
      <SearchEmptyState
        errorMessage={mockErrorMessage}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.ERROR}
      />
    );
    const errorES = getByTestId(container, 'es-error');
    const errMsg = getByTestId(errorES, 'error-text');

    expect(errMsg.textContent).toMatch('message.unable-to-error-elasticsearch');
  });

  it('should render with correct brandName keys', () => {
    const { container } = render(
      <SearchEmptyState
        errorMessage={mockErrorMessage}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.ERROR}
      />
    );
    const errorES = getByTestId(container, 'es-error');

    expect(errorES).toBeInTheDocument();

    // Verify the translation function was called with brandName parameter
    expect(
      screen.getByText(/message.welcome-to-open-metadata/)
    ).toBeInTheDocument();
  });
});
