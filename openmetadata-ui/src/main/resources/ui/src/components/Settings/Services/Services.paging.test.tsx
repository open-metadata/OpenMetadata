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
