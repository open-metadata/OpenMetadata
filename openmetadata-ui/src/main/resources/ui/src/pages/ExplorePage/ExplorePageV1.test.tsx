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
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ExploreQuickFilterField } from '../../components/Explore/ExplorePage.interface';
import ExploreV1 from '../../components/ExploreV1/ExploreV1.component';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { usePaging } from '../../hooks/paging/usePaging';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import ExplorePageV1 from './ExplorePageV1.component';

const mockHandlePageChange = jest.fn();
const mockHandlePageSizeChange = jest.fn();
const mockLocation = { pathname: 'pathname', search: '' };

jest.mock(
  '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="advance-search-provider-mock">{children}</div>
    ),
    useAdvanceSearch: jest.fn().mockImplementation(() => ({
      toggleModal: jest.fn(),
      sqlQuery: '',
      onResetAllFilters: jest.fn(),
    })),
  })
);

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/ExploreV1/ExploreV1.component', () => {
  return jest.fn().mockReturnValue(<p>ExploreV1</p>);
});

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    searchCriteria: '',
  })),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => mockLocation);
});

jest.mock('../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn(() => ({
    preferences: {
      globalPageSize: 25,
    },
  })),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    currentPage: 3,
    handlePageChange: mockHandlePageChange,
    handlePageSizeChange: mockHandlePageSizeChange,
    pageSize: 25,
  })),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => {
    return {
      tab: 'tables',
    };
  }),
  useNavigate: jest.fn(),
}));

const mockProps = {
  pageTitle: 'explore',
};

describe('ExplorePageV1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.pathname = 'pathname';
    mockLocation.search = '';
    (useCustomLocation as jest.Mock).mockImplementation(() => mockLocation);
    (useCurrentUserPreferences as jest.Mock).mockReturnValue({
      preferences: {
        globalPageSize: 25,
      },
    });
  });

  it('renders without crashing', async () => {
    render(<ExplorePageV1 {...mockProps} />);

    expect(await screen.findByText('ExploreV1')).toBeInTheDocument();
    expect(usePaging).toHaveBeenCalledWith(25);
  });

  it('calls navigate exactly once with quickFilter when filter changes', async () => {
    const mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);

    let capturedCallback:
      | ((filter?: Record<string, unknown>) => void)
      | undefined;
    (ExploreV1 as jest.Mock).mockImplementationOnce(
      ({
        onChangeAdvancedSearchQuickFilters,
      }: {
        onChangeAdvancedSearchQuickFilters?: (
          filter?: Record<string, unknown>
        ) => void;
      }) => {
        capturedCallback = onChangeAdvancedSearchQuickFilters;

        return <p>ExploreV1</p>;
      }
    );

    render(<ExplorePageV1 {...mockProps} />);
    await screen.findByText('ExploreV1');

    const testFilter = {
      query: {
        bool: {
          must: [{ bool: { should: [{ term: { entityType: 'table' } }] } }],
        },
      },
    };

    act(() => {
      capturedCallback!(testFilter);
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate.mock.calls[0][0].search).toContain('quickFilter');
  });

  it('preserves currentPage and pageSize when quick filter changes', async () => {
    const mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (useCustomLocation as jest.Mock).mockReturnValue({
      pathname: 'pathname',
      search: '?currentPage=3&pageSize=25&search=orders',
    });

    let capturedCallback:
      | ((filter?: Record<string, unknown>) => void)
      | undefined;
    (ExploreV1 as jest.Mock).mockImplementationOnce(
      ({
        onChangeAdvancedSearchQuickFilters,
      }: {
        onChangeAdvancedSearchQuickFilters?: (
          filter?: Record<string, unknown>
        ) => void;
      }) => {
        capturedCallback = onChangeAdvancedSearchQuickFilters;

        return <p>ExploreV1</p>;
      }
    );

    render(<ExplorePageV1 {...mockProps} />);
    await screen.findByText('ExploreV1');

    act(() => {
      capturedCallback?.({
        query: {
          bool: {
            must: [{ bool: { should: [{ term: { entityType: 'table' } }] } }],
          },
        },
      });
    });

    const searchParams = new URLSearchParams(
      mockNavigate.mock.calls[0][0].search
    );

    expect(searchParams.get('currentPage')).toBe('3');
    expect(searchParams.get('pageSize')).toBe('25');
  });

  it('preserves currentPage and pageSize when browse filter changes', async () => {
    const mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (useCustomLocation as jest.Mock).mockReturnValue({
      pathname: 'pathname',
      search: '?currentPage=3&pageSize=25',
    });

    let capturedCallback:
      | ((payload: {
          browseFields: ExploreQuickFilterField[];
          quickFilter?: Record<string, unknown>;
        }) => void)
      | undefined;
    (ExploreV1 as jest.Mock).mockImplementationOnce(
      ({
        onTreeSelect,
      }: {
        onTreeSelect?: (payload: {
          browseFields: ExploreQuickFilterField[];
          quickFilter?: Record<string, unknown>;
        }) => void;
      }) => {
        capturedCallback = onTreeSelect;

        return <p>ExploreV1</p>;
      }
    );

    render(<ExplorePageV1 {...mockProps} />);
    await screen.findByText('ExploreV1');

    act(() => {
      capturedCallback?.({
        browseFields: [
          {
            key: 'serviceType',
            label: 'Service Type',
            value: [{ key: 'BigQuery', label: 'BigQuery' }],
          },
        ],
      });
    });

    const searchParams = new URLSearchParams(
      mockNavigate.mock.calls[0][0].search
    );

    expect(searchParams.get('currentPage')).toBe('3');
    expect(searchParams.get('pageSize')).toBe('25');
  });
});
