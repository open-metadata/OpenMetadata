/*
 *  Copyright 2026 Collate.
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
import { render, screen } from '@testing-library/react';
import PanelEmptyPlaceholder from './PanelEmptyPlaceholder';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

describe('PanelEmptyPlaceholder', () => {
  it('shows the no-data message when no search is active', () => {
    render(<PanelEmptyPlaceholder description="No test cases" />);

    expect(screen.getByTestId('no-data-placeholder')).toHaveTextContent(
      'No test cases'
    );
    expect(
      screen.queryByText('label.no-matching-result-plural')
    ).not.toBeInTheDocument();
  });

  it('reports no matching results while a search is active', () => {
    render(
      <PanelEmptyPlaceholder description="No test cases" searchText="zzz" />
    );

    expect(screen.getByTestId('no-data-placeholder')).toHaveTextContent(
      'label.no-matching-result-plural'
    );
    expect(screen.queryByText('No test cases')).not.toBeInTheDocument();
  });

  it('gives the search state its own test id when one is passed', () => {
    render(
      <PanelEmptyPlaceholder
        searchResultsTestId="no-matching-custom-properties"
        searchText="zzz"
      />
    );

    expect(
      screen.getByTestId('no-matching-custom-properties')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('no-data-placeholder')).not.toBeInTheDocument();
  });
});
