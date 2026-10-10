/*
 *  Copyright 2024 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AlertRecentEventFilters } from '../../../../enums/Alerts.enum';
import {
  mockAlertDetails,
  MOCK_TYPED_EVENT_LIST_RESPONSE,
} from '../../../../mocks/Alerts.mock';
import { getAlertEventsFromId } from '../../../../rest/alertsAPI';
import AlertRecentEventsTab from './AlertRecentEventsTab';

// Only useCurrentUserPreferences is stubbed: the real usePaging hook, its
// useTableFilters URL-write path, and the real NextPreviousWithOffset
// component are all exercised under MemoryRouter.
jest.mock('../../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { globalPageSize: 5 },
    setPreference: jest.fn(),
  }),
}));

jest.mock('../../../../rest/alertsAPI', () => ({
  getAlertEventsFromId: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: MOCK_TYPED_EVENT_LIST_RESPONSE.data,
      paging: { total: 100 },
    })
  ),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockImplementation(() => <div>SchemaEditor</div>)
);

const lastCallParams = () => {
  const calls = (getAlertEventsFromId as jest.Mock).mock.calls;

  return calls[calls.length - 1][0].params;
};

const indicator = () => screen.getByTestId('page-indicator');

const clickNext = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('next'));
  });
};

const clickPrevious = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('previous'));
  });
};

const selectFilter = async (label: string) => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('filter-button'));
  });

  const filterOption = await screen.findByText(label);
  await act(async () => {
    fireEvent.click(filterOption);
  });
};

const LocationProbe = () => {
  const location = useLocation();

  return <span data-testid="location-search">{location.search}</span>;
};

const renderWithRouter = async (initialEntry = '/') => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <AlertRecentEventsTab alertDetails={mockAlertDetails} />
      </MemoryRouter>
    );
  });

  // Wait for the mount fetch to finish so the paginator renders.
  await screen.findByTestId('page-indicator');
};

describe('AlertRecentEventsTab pagination/filter reset (real usePaging + real NextPreviousWithOffset)', () => {
  it('resets currentPage to 1 on filter change and keeps Next navigation contiguous', async () => {
    await renderWithRouter();

    expect(indicator()).toHaveTextContent('1/20');

    await clickNext();

    expect(indicator()).toHaveTextContent('2/20');

    await clickNext();

    expect(indicator()).toHaveTextContent('3/20');
    expect(lastCallParams().paginationOffset).toBe(10);

    await selectFilter('label.successful');

    expect(await screen.findByTestId('applied-filter-text')).toHaveTextContent(
      ': label.successful'
    );
    expect(indicator()).toHaveTextContent('1/20');
    expect(lastCallParams().paginationOffset).toBe(0);
    expect(lastCallParams().status).toBe(AlertRecentEventFilters.SUCCESSFUL);

    await clickNext();

    expect(indicator()).toHaveTextContent('2/20');
    expect(lastCallParams().paginationOffset).toBe(5);

    await clickPrevious();

    expect(indicator()).toHaveTextContent('1/20');
    expect(lastCallParams().paginationOffset).toBe(0);
  });

  it('writes currentPage=1 to the router URL on filter change', async () => {
    await renderWithRouter();

    await clickNext();
    await clickNext();

    expect(screen.getByTestId('location-search').textContent).toContain(
      'currentPage=3'
    );

    await selectFilter('label.failed');

    expect(await screen.findByTestId('applied-filter-text')).toHaveTextContent(
      ': label.failed'
    );

    // handlePageChange(1) → navigate(replace) writes currentPage=1 to the URL.
    expect(screen.getByTestId('location-search').textContent).toContain(
      'currentPage=1'
    );
  });

  it('self-heals a URL-restored currentPage on the next filter interaction', async () => {
    // usePaging restores currentPage=3 from the URL; the mount effect still
    // fetches offset 0 (the documented mount desync, out of scope here).
    await renderWithRouter('/alert?currentPage=3');

    expect(indicator()).toHaveTextContent('3/20');
    expect(lastCallParams().paginationOffset).toBe(0);

    // Changing the filter resets the page to 1 and rewrites the URL.
    await selectFilter('label.successful');

    expect(await screen.findByTestId('applied-filter-text')).toHaveTextContent(
      ': label.successful'
    );
    expect(indicator()).toHaveTextContent('1/20');
    expect(lastCallParams().paginationOffset).toBe(0);
    expect(lastCallParams().status).toBe(AlertRecentEventFilters.SUCCESSFUL);
    expect(screen.getByTestId('location-search').textContent).toContain(
      'currentPage=1'
    );
  });
});
