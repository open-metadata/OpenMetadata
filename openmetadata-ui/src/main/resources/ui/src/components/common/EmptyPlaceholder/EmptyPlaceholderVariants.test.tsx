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

import { fireEvent, render, screen } from '@testing-library/react';
import NoFilteredResultsPlaceholder from './NoFilteredResultsPlaceholder';
import NoSearchResultsPlaceholder from './NoSearchResultsPlaceholder';
import SomethingWentWrongPlaceholder from './SomethingWentWrongPlaceholder';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

describe('NoSearchResultsPlaceholder', () => {
  it('should render the default title and description', () => {
    render(<NoSearchResultsPlaceholder />);

    expect(
      screen.getByText('label.no-matching-result-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.check-spelling-or-try-shorter-term')
    ).toBeInTheDocument();
  });

  it('should not render any action button by default', () => {
    render(<NoSearchResultsPlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should allow overriding the title and description', () => {
    render(
      <NoSearchResultsPlaceholder
        description="custom description"
        title="custom title"
      />
    );

    expect(screen.getByText('custom title')).toBeInTheDocument();
    expect(screen.getByText('custom description')).toBeInTheDocument();
    expect(
      screen.queryByText('label.no-matching-result-plural')
    ).not.toBeInTheDocument();
  });
});

describe('NoFilteredResultsPlaceholder', () => {
  it('should render the default title and description', () => {
    render(<NoFilteredResultsPlaceholder />);

    expect(
      screen.getByText('label.no-result-for-these-filter-plural')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.nothing-matches-current-filter')
    ).toBeInTheDocument();
  });

  it('should not render the clear filters action without a handler', () => {
    render(<NoFilteredResultsPlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render the clear filters action and fire the handler', () => {
    const onClearFilters = jest.fn();
    render(<NoFilteredResultsPlaceholder onClearFilters={onClearFilters} />);

    const button = screen.getByRole('button', {
      name: 'label.clear-filter-plural',
    });

    fireEvent.click(button);

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('should let custom actions replace the default clear filters action', () => {
    const onClearFilters = jest.fn();
    render(
      <NoFilteredResultsPlaceholder
        actions={[{ key: 'custom', label: 'Custom Action' }]}
        onClearFilters={onClearFilters}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Custom Action' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.clear-filter-plural' })
    ).not.toBeInTheDocument();
  });
});

describe('SomethingWentWrongPlaceholder', () => {
  it('should render the default title and description', () => {
    render(<SomethingWentWrongPlaceholder />);

    expect(
      screen.getByText('message.something-went-wrong')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.temporary-error-try-reloading')
    ).toBeInTheDocument();
  });

  it('should render the reload action and fire the handler', () => {
    const onReload = jest.fn();
    render(<SomethingWentWrongPlaceholder onReload={onReload} />);

    const button = screen.getByRole('button', { name: 'label.reload' });

    fireEvent.click(button);

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('should not render the reload action without a handler', () => {
    render(<SomethingWentWrongPlaceholder />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
