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
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EntityDetailPage from './EntityDetailPage';

jest.mock('../../Suggestions/SuggestionsProvider/SuggestionsProvider', () =>
  jest.fn(({ children }) => (
    <div data-testid="suggestions-provider">{children}</div>
  ))
);

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityDetailComponent: jest.fn((entityType: string) =>
      entityType === 'metric' ? () => <>MetricDetails</> : null
    ),
  },
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Navigate: jest.fn(({ to }) => <div>Redirected to {to}</div>),
}));

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route element={<EntityDetailPage />} path="/entity/:entityType/:fqn" />
      </Routes>
    </MemoryRouter>
  );

describe('EntityDetailPage', () => {
  it('renders the entity detail page inside the suggestions provider', () => {
    renderAt('/entity/metric/sample.metric');

    expect(screen.getByTestId('suggestions-provider')).toContainElement(
      screen.getByText('MetricDetails')
    );
  });

  it('redirects to not found for an unknown entity type', () => {
    renderAt('/entity/unknown/sample');

    expect(screen.getByText(/Redirected to/)).toBeInTheDocument();
    expect(
      screen.queryByTestId('suggestions-provider')
    ).not.toBeInTheDocument();
  });
});
