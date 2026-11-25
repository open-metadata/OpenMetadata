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

describe('Test Error placeholder ingestion Component', () => {
  it('switches to filter guidance when search clears but deleted assets remain selected', () => {
    const { rerender } = render(
      <SearchEmptyState query={{ search: 'missing', showDeleted: 'true' }} />
    );

    expect(screen.getByText('label.no-result-found')).toBeInTheDocument();

    rerender(<SearchEmptyState query={{ showDeleted: 'true' }} />);

    expect(
      screen.getByText('label.no-result-for-these-filter-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.try-adjusting-filter')
    ).toBeInTheDocument();
  });

  it('keeps the domain status in the headline, with separate guidance and documentation', () => {
    const { container } = render(<SearchEmptyState />);

    expect(getByTestId(container, 'no-search-results')).toBeInTheDocument();
    expect(screen.getByText('message.no-data-available-entity')).toHaveClass(
      'tw:text-sm',
      'tw:font-semibold'
    );
    expect(screen.getByText('message.add-data-asset-domain')).toHaveClass(
      'tw:text-xs'
    );
    expect(screen.getByText('message.refer-to-our-doc')).toBeInTheDocument();
  });

  it('Component should render Filter Placeholder for query search', () => {
    const { container } = render(
      <SearchEmptyState query={{ search: 'test' }} />
    );
    const noDataES = getByTestId(container, 'no-search-results');
    const searchFilterPlaceholder = getByTestId(
      noDataES,
      'search-error-placeholder'
    );

    expect(searchFilterPlaceholder).toBeInTheDocument();
  });
});
