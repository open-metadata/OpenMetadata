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

import { act, render, screen, within } from '@testing-library/react';
import React from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  mockedGlossaries,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import {
  getFirstLevelGlossaryTermsPaginated,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import { useGlossaryStore } from '../useGlossary.store';
import GlossaryDetails from './GlossaryDetails.component';

jest.mock('../GlossaryTermTab/GlossaryTermTab.component', () => {
  return jest.fn().mockReturnValue(<p>GlossaryTermTab.component</p>);
});
jest.mock('../GlossaryHeader/GlossaryHeader.component', () => {
  return jest.fn().mockReturnValue(<p>GlossaryHeader.component</p>);
});
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    )),
  useParams: jest.fn().mockImplementation(() => ({
    glossaryName: 'GlossaryName',
    tab: 'terms',
  })),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <p>testActivityFeedTab</p>),
  })
);

jest.mock('../../common/EntityDescription/Description', () =>
  jest.fn().mockImplementation(() => <div>Description</div>)
);

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: null,
    navigation: null,
    isLoading: false,
  }),
}));

const mockProps = {
  glossary: mockedGlossaries[0],
  glossaryTerms: [],
  termsLoading: false,
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  updateGlossary: jest.fn(),
  handleGlossaryDelete: jest.fn(),
  refreshGlossaryTerms: jest.fn(),
  onAddGlossaryTerm: jest.fn(),
  onEditGlossaryTerm: jest.fn(),
  updateVote: jest.fn(),
  onThreadLinkSelect: jest.fn(),
  toggleTabExpanded: jest.fn(),
  isTabExpanded: false,
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  ...jest.requireActual('../../Customization/GenericProvider/GenericContext'),
  useGenericContext: jest.fn().mockImplementation(() => ({
    permissions: MOCK_PERMISSIONS,
  })),
}));

jest.mock('../../Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <div>GenericTab</div>),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  getFirstLevelGlossaryTermsPaginated: jest.fn(),
  searchGlossaryTermsPaginated: jest.fn(),
}));

const mockGetFirstLevelGlossaryTermsPaginated =
  getFirstLevelGlossaryTermsPaginated as jest.Mock;
const mockSearchGlossaryTermsPaginated =
  searchGlossaryTermsPaginated as jest.Mock;

describe('Test Glossary-details component', () => {
  it('Should render Glossary-details component', async () => {
    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });

    const glossaryDetails = screen.getByTestId('glossary-details');
    const headerComponent = await screen.findByText('GlossaryHeader.component');

    expect(headerComponent).toBeInTheDocument();
    expect(glossaryDetails).toBeInTheDocument();
    expect(await screen.findByText('GenericTab')).toBeInTheDocument();
  });

  describe('Terms tab count badge', () => {
    afterEach(() => {
      useGlossaryStore.setState({
        activeGlossary: {},
        termsStatusFilter: undefined,
        termsSearchTerm: undefined,
        childrenCounts: {},
      } as never);
    });

    it('requests a status-filtered, count-only page of direct children for the active glossary', async () => {
      useGlossaryStore.setState({
        activeGlossary: { fullyQualifiedName: 'Mock Glossary' },
        termsStatusFilter: 'Approved,Draft,In Review',
      } as never);
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 4 },
      });

      await act(async () => {
        render(<GlossaryDetails {...mockProps} />);
      });

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
        'Mock Glossary',
        0,
        undefined,
        'Approved,Draft,In Review'
      );
    });

    it('shows the filtered paging.total on the Terms tab once the fetch resolves', async () => {
      useGlossaryStore.setState({
        activeGlossary: { fullyQualifiedName: 'Mock Glossary' },
        termsStatusFilter: 'Approved,Draft,In Review',
      } as never);
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 4 },
      });

      await act(async () => {
        render(<GlossaryDetails {...mockProps} />);
      });

      const termsTab = await screen.findByTestId('terms');

      expect(
        await within(termsTab).findByTestId('filter-count')
      ).toHaveTextContent('4');
    });

    // useGlossary.store seeds termsStatusFilter with the default filter string,
    // so a genuinely undefined termsStatusFilter here only happens once the
    // table has mounted and the user explicitly selected "All" statuses and
    // saved — it must NOT be defaulted, since that would silently re-apply a
    // filter the user just turned off and disagree with the (now unfiltered)
    // table.
    it('sends no entityStatus filter when termsStatusFilter is undefined (user selected All statuses)', async () => {
      useGlossaryStore.setState({
        activeGlossary: { fullyQualifiedName: 'Mock Glossary' },
        termsStatusFilter: undefined,
      } as never);
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 9 },
      });

      await act(async () => {
        render(<GlossaryDetails {...mockProps} />);
      });

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
        'Mock Glossary',
        0,
        undefined,
        undefined
      );

      const termsTab = await screen.findByTestId('terms');

      expect(
        await within(termsTab).findByTestId('filter-count')
      ).toHaveTextContent('9');
    });

    it('re-fetches when termsStatusFilter changes, e.g. after the table status filter is saved', async () => {
      useGlossaryStore.setState({
        activeGlossary: { fullyQualifiedName: 'Mock Glossary' },
        termsStatusFilter: 'Approved,Draft,In Review',
      } as never);
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 4 },
      });

      let renderResult: ReturnType<typeof render>;
      await act(async () => {
        renderResult = render(<GlossaryDetails {...mockProps} />);
      });

      const termsTab = await screen.findByTestId('terms');

      expect(
        await within(termsTab).findByTestId('filter-count')
      ).toHaveTextContent('4');
      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);

      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [],
        paging: { total: 1 },
      });

      await act(async () => {
        useGlossaryStore.setState({
          activeGlossary: { fullyQualifiedName: 'Mock Glossary' },
          termsStatusFilter: 'Approved',
        } as never);
        renderResult.rerender(<GlossaryDetails {...mockProps} />);
      });

      expect(
        await within(termsTab).findByTestId('filter-count')
      ).toHaveTextContent('1');
      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenLastCalledWith(
        'Mock Glossary',
        0,
        undefined,
        'Approved'
      );
      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(2);
    });

    // Same root cause as the entityStatus mismatch: the table switches from
    // the plain listing API to the search API the moment a search term is
    // active, so the badge must switch with it via termsSearchTerm, or it
    // keeps counting the unfiltered listing while the table shows only the
    // search matches.
    //
    // Uses AGGREGATE_PAGE_SIZE_LARGE (1000) + data.length, not limit: 0 +
    // paging.total: the search endpoint's `limit` has a server-side @Min(1)
    // constraint (limit: 0 is rejected outright), and even with a valid
    // limit its paging.total is a pagination heuristic
    // (offset + terms.size() + (hasMore ? 1 : 0)), not a real count — the
    // table itself already works around this the same way (its own
    // fetchAllTerms uses data.length for the search branch). 1000, not the
    // table's own PAGE_SIZE_LARGE (50): a 50-row cap would silently
    // undercount any term with more than 50 matching children. The store's
    // fetchChildrenCount pages through offset/hasMore beyond a single 1000
    // response, mirroring fetchAllTerms's own "load more" — covered by its
    // own tests in GlossaryTermUtils.test.tsx.
    it('uses the search API with AGGREGATE_PAGE_SIZE_LARGE and counts the returned rows, not paging.total, when termsSearchTerm is set', async () => {
      useGlossaryStore.setState({
        activeGlossary: { fullyQualifiedName: 'Mock Glossary' },
        termsStatusFilter: 'Approved,Draft,In Review',
        termsSearchTerm: 'bridge',
      } as never);
      mockSearchGlossaryTermsPaginated.mockResolvedValueOnce({
        data: [{ id: 'bridge-term' }],
        // Deliberately misleading paging.total (the search endpoint's own
        // pagination heuristic) to prove the count comes from data.length.
        paging: { total: 99 },
      });

      await act(async () => {
        render(<GlossaryDetails {...mockProps} />);
      });

      const termsTab = await screen.findByTestId('terms');

      expect(mockSearchGlossaryTermsPaginated).toHaveBeenCalledWith({
        q: 'bridge',
        glossaryFqn: 'Mock Glossary',
        limit: 1000,
        offset: 0,
        entityStatus: 'Approved,Draft,In Review',
      });
      expect(mockGetFirstLevelGlossaryTermsPaginated).not.toHaveBeenCalled();
      // The badge must show 1 (data.length), not 99 (the misleading
      // paging.total above).
      expect(
        await within(termsTab).findByTestId('filter-count')
      ).toHaveTextContent('1');
    });

    // The concrete regression this guards: with the old PAGE_SIZE_LARGE
    // (50) limit, a glossary with more than 50 matching terms would have
    // its badge silently capped at 50 while the table (which can "load
    // more") displays the true, larger count.
    it('does not cap the count at 50 when more than 50 terms match the search', async () => {
      useGlossaryStore.setState({
        activeGlossary: { fullyQualifiedName: 'Mock Glossary' },
        termsSearchTerm: 'bridge',
      } as never);
      mockSearchGlossaryTermsPaginated.mockResolvedValueOnce({
        data: Array.from({ length: 60 }, (_, i) => ({ id: `term-${i}` })),
        paging: { total: 60 },
      });

      await act(async () => {
        render(<GlossaryDetails {...mockProps} />);
      });

      const termsTab = await screen.findByTestId('terms');

      expect(
        await within(termsTab).findByTestId('filter-count')
      ).toHaveTextContent('60');
    });
  });
});
