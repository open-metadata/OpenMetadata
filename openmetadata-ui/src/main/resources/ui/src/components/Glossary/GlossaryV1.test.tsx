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

import {
  act,
  findByText,
  fireEvent,
  queryByText,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  mockedGlossaries,
  mockedGlossaryTerms,
} from '../../mocks/Glossary.mock';
import { addGlossaryTerm } from '../../rest/glossaryAPI';
import GlossaryV1 from './GlossaryV1.component';
import { GlossaryV1Props } from './GlossaryV1.interfaces';

const mockAddGlossaryTerm = addGlossaryTerm as jest.Mock;

const params = {
  glossaryName: 'GlossaryName',
  action: '',
};

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermission: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
    permissions: {
      glossaryTerm: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
      glossary: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
  }),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  DEFAULT_ENTITY_PERMISSION: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  },
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => params),
  Link: jest
    .fn()
    .mockImplementation(({ children }) => <a href="/">{children}</a>),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
  useLocation: jest.fn().mockImplementation(() => ({ pathname: 'mockPath' })),
}));

jest.mock('./GlossaryDetails/GlossaryDetails.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Details component</>);
});

jest.mock('./GlossaryTerms/GlossaryTermsV1.component', () => {
  return jest.fn().mockReturnValue(<>Glossary-Term component</>);
});

jest.mock('../common/TitleBreadcrumb/TitleBreadcrumb.component', () => {
  return jest.fn().mockReturnValue(<>TitleBreadcrumb</>);
});

jest.mock('../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn().mockReturnValue(<div>Breadcrumb</div>)
);

jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<span>U</span>)
);

jest.mock('../ActivityFeed/FeedEditor/FeedEditor', () => {
  return jest.fn().mockReturnValue(<p>FeedEditor</p>);
});

jest.mock('../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  addGlossaryTerm: jest.fn(),
  getFirstLevelGlossaryTermsPaginated: jest.fn().mockResolvedValue({
    data: [],
    paging: { after: undefined },
  }),
  patchGlossaryTerm: jest.fn(),
}));

jest.mock('./GlossaryTermModal/GlossaryTermModal.component', () =>
  jest.fn().mockImplementation(({ onSave }) => (
    <button type="button" onClick={() => onSave({ name: 'NewTerm' })}>
      SaveGlossaryTermModal
    </button>
  ))
);

const mockSetTermsStatusFilter = jest.fn();
const mockSetTermsSearchTerm = jest.fn();
const mockResetChildrenCounts = jest.fn();
const mockSetGlossaryFunctionRef = jest.fn();
const mockFetchChildrenCount = jest.fn();
const mockUseGlossaryStore = jest.fn().mockImplementation(() => ({
  activeGlossary: mockedGlossaryTerms[0],
  updateActiveGlossary: jest.fn(),
  setGlossaryFunctionRef: mockSetGlossaryFunctionRef,
  termsLoading: false,
  setTermsLoading: jest.fn(),
  glossaryChildTerms: [],
  setGlossaryChildTerms: jest.fn(),
  insertNewGlossaryTermToChildTerms: jest.fn(),
  setTermsStatusFilter: mockSetTermsStatusFilter,
  setTermsSearchTerm: mockSetTermsSearchTerm,
  resetChildrenCounts: mockResetChildrenCounts,
  fetchChildrenCount: mockFetchChildrenCount,
}));

jest.mock('./useGlossary.store', () => ({
  useGlossaryStore: (...args: unknown[]) => mockUseGlossaryStore(...args),
}));

jest.mock(
  '../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

jest.mock('../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: null,
    navigation: null,
    isLoading: false,
  }),
}));

const mockProps: GlossaryV1Props = {
  selectedData: mockedGlossaries[0],
  isGlossaryActive: true,
  onGlossaryTermUpdate: jest.fn(),
  updateGlossary: jest.fn(),
  onGlossaryDelete: jest.fn(),
  onGlossaryTermDelete: jest.fn(),
  isVersionsView: false,
  isSummaryPanelOpen: false,
};

describe('Test Glossary component', () => {
  it('Should render Glossary-details', async () => {
    const { container } = render(<GlossaryV1 {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const glossaryDetails = await findByText(
      container,
      /Glossary-Details component/i
    );

    const glossaryTerm = await queryByText(
      container,
      /Glossary-Term component/i
    );

    expect(glossaryDetails).toBeInTheDocument();
    expect(glossaryTerm).not.toBeInTheDocument();
  });

  it('Should render Glossary-term', async () => {
    const { container } = render(
      <GlossaryV1
        {...mockProps}
        isGlossaryActive={false}
        selectedData={mockedGlossaryTerms[0]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const glossaryTerm = await findByText(
      container,
      /Glossary-Term component/i
    );

    const glossaryDetails = await queryByText(
      container,
      /Glossary-Details component/i
    );

    expect(glossaryTerm).toBeInTheDocument();
    expect(glossaryDetails).not.toBeInTheDocument();
  });

  describe('termsStatusFilter reset on active-entity change', () => {
    const storeStateFor = (id: string) => ({
      activeGlossary: { ...mockedGlossaryTerms[0], id },
      updateActiveGlossary: jest.fn(),
      setGlossaryFunctionRef: jest.fn(),
      termsLoading: false,
      setTermsLoading: jest.fn(),
      glossaryChildTerms: [],
      setGlossaryChildTerms: jest.fn(),
      insertNewGlossaryTermToChildTerms: jest.fn(),
      setTermsStatusFilter: mockSetTermsStatusFilter,
      setTermsSearchTerm: mockSetTermsSearchTerm,
      resetChildrenCounts: mockResetChildrenCounts,
    });

    beforeEach(() => {
      mockSetTermsStatusFilter.mockClear();
      mockSetTermsSearchTerm.mockClear();
      mockResetChildrenCounts.mockClear();
    });

    // GlossaryV1 resets the shared useGlossaryStore termsStatusFilter back to
    // the table's default whenever the active glossary/term changes, so a
    // stale filter from a previously-viewed entity can't flash on the new
    // page's badge before its own GlossaryTermTab mounts and pushes a fresh
    // value (mirrors the existing glossaryChildTerms reset on entity switch).
    it('resets termsStatusFilter to the default on mount and again when the active id changes', async () => {
      mockUseGlossaryStore.mockImplementation(() => storeStateFor('id-1'));

      const { rerender } = render(<GlossaryV1 {...mockProps} />, {
        wrapper: MemoryRouter,
      });

      await findByText(document.body, /Glossary-Details component/i);

      expect(mockSetTermsStatusFilter).toHaveBeenCalledWith(
        'Approved,Draft,In Review'
      );

      mockSetTermsStatusFilter.mockClear();
      mockUseGlossaryStore.mockImplementation(() => storeStateFor('id-2'));

      rerender(<GlossaryV1 {...mockProps} />);

      await waitFor(() => {
        expect(mockSetTermsStatusFilter).toHaveBeenCalledWith(
          'Approved,Draft,In Review'
        );
      });
    });

    // Same category of bug as the termsStatusFilter staleness above, just not
    // applied to the newer termsSearchTerm field: without this, an active
    // search from a previously-viewed entity would still be set the next
    // time fetchChildrenCount runs for the new entity, silently switching
    // its badge to the (wrong, leftover) search API.
    it('resets termsSearchTerm to undefined on mount and again when the active id changes', async () => {
      mockUseGlossaryStore.mockImplementation(() => storeStateFor('id-1'));

      const { rerender } = render(<GlossaryV1 {...mockProps} />, {
        wrapper: MemoryRouter,
      });

      await findByText(document.body, /Glossary-Details component/i);

      expect(mockSetTermsSearchTerm).toHaveBeenCalledWith(undefined);

      mockSetTermsSearchTerm.mockClear();
      mockUseGlossaryStore.mockImplementation(() => storeStateFor('id-2'));

      rerender(<GlossaryV1 {...mockProps} />);

      await waitFor(() => {
        expect(mockSetTermsSearchTerm).toHaveBeenCalledWith(undefined);
      });
    });

    // childrenCounts is keyed by fqn and persists in the store across
    // navigation. Without clearing it here, re-visiting the same fqn later
    // would briefly show its last cached count (computed under whatever
    // filter/search was active last time) before the fresh fetch overwrites
    // it — a stale-flash bug distinct from, but the same category as, the
    // termsStatusFilter/termsSearchTerm ones above.
    it('clears cached childrenCounts on mount and again when the active id changes', async () => {
      mockUseGlossaryStore.mockImplementation(() => storeStateFor('id-1'));

      const { rerender } = render(<GlossaryV1 {...mockProps} />, {
        wrapper: MemoryRouter,
      });

      await findByText(document.body, /Glossary-Details component/i);

      expect(mockResetChildrenCounts).toHaveBeenCalled();

      mockResetChildrenCounts.mockClear();
      mockUseGlossaryStore.mockImplementation(() => storeStateFor('id-2'));

      rerender(<GlossaryV1 {...mockProps} />);

      await waitFor(() => {
        expect(mockResetChildrenCounts).toHaveBeenCalled();
      });
    });
  });

  describe('Real-time badge update after adding a term', () => {
    beforeEach(() => {
      mockAddGlossaryTerm.mockClear();
      mockSetGlossaryFunctionRef.mockClear();
      mockFetchChildrenCount.mockClear();
      mockUseGlossaryStore.mockImplementation(() => ({
        activeGlossary: mockedGlossaryTerms[0],
        updateActiveGlossary: jest.fn(),
        setGlossaryFunctionRef: mockSetGlossaryFunctionRef,
        termsLoading: false,
        setTermsLoading: jest.fn(),
        glossaryChildTerms: [],
        setGlossaryChildTerms: jest.fn(),
        insertNewGlossaryTermToChildTerms: jest.fn(),
        setTermsStatusFilter: mockSetTermsStatusFilter,
        setTermsSearchTerm: mockSetTermsSearchTerm,
        resetChildrenCounts: mockResetChildrenCounts,
        fetchChildrenCount: mockFetchChildrenCount,
      }));
    });

    // Regression test for the dead childrenRefreshTrigger prop: adding a term
    // used to only bump a number nothing read, so the Terms tab badge stayed
    // stale until a full page reload. onTermModalSuccess now calls the store's
    // fetchChildrenCount directly for the active entity — the same action the
    // badge itself (GlossaryTermChildrenCountBadge) already reads from, so the
    // badge re-renders with the fresh count as soon as this resolves.
    it('calls fetchChildrenCount for the active entity once a new term is successfully added', async () => {
      mockAddGlossaryTerm.mockResolvedValue({
        id: 'new-term-id',
        name: 'NewTerm',
        fullyQualifiedName: 'Business Glossary.Clothing.NewTerm',
      });

      render(
        <GlossaryV1
          {...mockProps}
          isGlossaryActive={false}
          selectedData={mockedGlossaryTerms[0]}
        />,
        { wrapper: MemoryRouter }
      );

      await findByText(document.body, /Glossary-Term component/i);

      await waitFor(() => {
        expect(mockSetGlossaryFunctionRef).toHaveBeenCalled();
      });

      // Open the add-term modal exactly the way the real "Add Term" button
      // does: via the onAddGlossaryTerm ref GlossaryV1 registers with the store.
      const lastCall =
        mockSetGlossaryFunctionRef.mock.calls[
          mockSetGlossaryFunctionRef.mock.calls.length - 1
        ][0];
      act(() => {
        lastCall.onAddGlossaryTerm();
      });

      const saveButton = await screen.findByText('SaveGlossaryTermModal');
      await act(async () => {
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(mockFetchChildrenCount).toHaveBeenCalledWith(
          mockedGlossaryTerms[0].fullyQualifiedName
        );
      });
    });
  });
});
