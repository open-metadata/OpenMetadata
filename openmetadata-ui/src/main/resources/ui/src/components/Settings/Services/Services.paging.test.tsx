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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { PIPELINE_SERVICE_PLATFORM } from '../../../constants/Services.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import { getServices, searchService } from '../../../rest/serviceAPI';
import Services from './Services';

jest.mock('../../../rest/serviceAPI', () => ({
  getServices: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'service-1',
        name: 'airbyte',
        fullyQualifiedName: 'airbyte',
        serviceType: 'Airbyte',
      },
    ],
    paging: { total: 40, after: 'next-cursor' },
  }),
  searchService: jest.fn(),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: {} }),
}));

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => ({
      isFetchingStatus: false,
      isAirflowAvailable: true,
      fetchAirflowStatus: jest.fn(),
      platform: PIPELINE_SERVICE_PLATFORM,
    }),
  })
);

jest.mock('../../../utils/PermissionsUtils', () => ({
  checkPermission: () => true,
}));

jest.mock('../../../hoc/LimitWrapper', () =>
  jest.fn(({ children }: { children: ReactNode }) => <>{children}</>)
);

jest.mock('../../PageHeader/PageHeader.component', () =>
  jest.fn(() => <div />)
);

jest.mock('../../common/DomainFilterChip/DomainFilterChip.component', () => ({
  DomainFilterChip: () => null,
}));

const mockGetServices = getServices as jest.Mock;
const mockSearchService = searchService as jest.Mock;

const LocationProbe = () => {
  const { search } = useLocation();

  return <div data-testid="location-search">{search}</div>;
};

const renderServices = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Services serviceName={ServiceCategory.PIPELINE_SERVICES} />
      <LocationProbe />
    </MemoryRouter>
  );

describe('Services paging across a view switch', () => {
  beforeEach(() => {
    mockGetServices.mockClear();
  });

  it('pages the card view on the grid scale from page 1 and drops the list paging from the URL', async () => {
    await act(async () => {
      renderServices('/settings/services/pipelines?currentPage=2&pageSize=25');
    });

    expect(mockGetServices).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 25 })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('grid'));
    });

    await waitFor(() => {
      expect(mockGetServices).toHaveBeenLastCalledWith(
        expect.objectContaining({ limit: 12 })
      );
    });

    const search = screen.getByTestId('location-search').textContent ?? '';

    expect(search).not.toContain('currentPage');
    expect(search).not.toContain('pageSize');
    expect(screen.getByTestId('page-indicator')).toHaveTextContent('1');
  });
});

const SEARCH_RESULTS = {
  hits: {
    hits: [
      {
        _source: {
          id: 'service-1',
          name: 'airbyte',
          fullyQualifiedName: 'airbyte',
          serviceType: 'Airbyte',
        },
      },
    ],
    total: { value: 40 },
  },
};

describe('Services search paging', () => {
  it('returns to page 1 and clears the old cursor when the service-type filter changes', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockSearchService.mockImplementation(
      async ({ currentPage }: { currentPage?: number }) => ({
        hits: {
          hits: currentPage === 1 ? SEARCH_RESULTS.hits.hits : [],
          total: { value: 1 },
        },
      })
    );

    await act(async () => {
      renderServices(
        '/settings/services/pipelines?currentPage=2&cursorType=after&cursorValue=next-cursor'
      );
    });

    expect(await screen.findByTestId('service-name-airbyte')).toBeVisible();

    await user.click(screen.getByTestId('filter-trigger'));
    await user.click(await screen.findByRole('checkbox', { name: 'Airbyte' }));

    await waitFor(() =>
      expect(mockSearchService).toHaveBeenLastCalledWith(
        expect.objectContaining({ currentPage: 1 })
      )
    );

    expect(
      mockSearchService.mock.calls.map(([params]) => params.currentPage)
    ).toEqual([1]);
    expect(await screen.findByTestId('service-name-airbyte')).toBeVisible();
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      /label\.page 1 /
    );

    const search = screen.getByTestId('location-search').textContent ?? '';

    expect(search).not.toContain('cursorType');
    expect(search).not.toContain('cursorValue');
  });

  it('fetches the next search page once, at the requested page number', async () => {
    mockSearchService.mockResolvedValue(SEARCH_RESULTS);

    await act(async () => {
      renderServices('/settings/services/pipelines');
    });

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'air' },
    });

    await waitFor(
      () =>
        expect(mockSearchService).toHaveBeenCalledWith(
          expect.objectContaining({ currentPage: 1 })
        ),
      { timeout: 3000 }
    );

    mockSearchService.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('page-indicator')).toHaveTextContent(
        /label\.page 2 /
      )
    );

    expect(mockSearchService).toHaveBeenCalledTimes(1);
    expect(mockSearchService).toHaveBeenCalledWith(
      expect.objectContaining({ currentPage: 2 })
    );
  });

  it('returns to page 1 when the deleted filter changes on a later search page', async () => {
    mockSearchService.mockResolvedValue(SEARCH_RESULTS);

    await act(async () => {
      renderServices('/settings/services/pipelines');
    });

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'air' },
    });

    await waitFor(
      () =>
        expect(mockSearchService).toHaveBeenCalledWith(
          expect.objectContaining({ currentPage: 1 })
        ),
      { timeout: 3000 }
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });

    await waitFor(() =>
      expect(mockSearchService).toHaveBeenLastCalledWith(
        expect.objectContaining({ currentPage: 2 })
      )
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('show-deleted-switch'));
    });

    await waitFor(() =>
      expect(mockSearchService).toHaveBeenLastCalledWith(
        expect.objectContaining({ currentPage: 1, deleted: true })
      )
    );

    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      /label\.page 1 /
    );
  });
});

describe('Services overlapping list requests', () => {
  afterEach(() => {
    mockGetServices.mockReset();
    mockGetServices.mockResolvedValue({
      data: [
        {
          id: 'service-1',
          name: 'airbyte',
          fullyQualifiedName: 'airbyte',
          serviceType: 'Airbyte',
        },
      ],
      paging: { total: 40, after: 'next-cursor' },
    });
  });

  it('keeps the newest deleted list when the stale-cursor request resolves last', async () => {
    let resolveStaleRequest: (value: unknown) => void = jest.fn();
    mockGetServices.mockImplementation(
      ({ before, include }: { before?: string; include?: string }) => {
        if (include === 'deleted' && before) {
          return new Promise((resolve) => {
            resolveStaleRequest = resolve;
          });
        }

        return Promise.resolve({
          data: [
            {
              id: include === 'deleted' ? 'service-deleted' : 'service-1',
              name: include === 'deleted' ? 'fivetran' : 'airbyte',
              fullyQualifiedName:
                include === 'deleted' ? 'fivetran' : 'airbyte',
              serviceType: 'Fivetran',
            },
          ],
          paging: { total: 1 },
        });
      }
    );

    await act(async () => {
      renderServices(
        '/settings/services/pipelines?currentPage=1&cursorType=before&cursorValue=prev-cursor'
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('show-deleted-switch'));
    });

    expect(await screen.findByTestId('service-name-fivetran')).toBeVisible();

    await act(async () => {
      resolveStaleRequest({
        data: [
          {
            id: 'service-stale',
            name: 'stale-service',
            fullyQualifiedName: 'stale-service',
            serviceType: 'Fivetran',
          },
        ],
        paging: { total: 1 },
      });
    });

    expect(screen.getByTestId('service-name-fivetran')).toBeVisible();
    expect(
      screen.queryByTestId('service-name-stale-service')
    ).not.toBeInTheDocument();
  });
});
