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
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {
  ModifiedGlossary,
  useGlossaryStore,
} from '../../../components/Glossary/useGlossary.store';
import { pagingObject } from '../../../constants/constants';
import { usePaging } from '../../../hooks/paging/usePaging';
import { useFqn } from '../../../hooks/useFqn';
import {
  getGlossariesByName,
  getGlossariesList,
} from '../../../rest/glossaryAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import GlossaryPage from './GlossaryPage.component';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
  useParams: jest.fn().mockReturnValue({ glossaryName: 'Alpha' }),
  useLocation: jest
    .fn()
    .mockImplementation(() => ({ pathname: '/glossary/Alpha' })),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'Alpha' }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({ action: '' }),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    paging: {},
    pageSize: 15,
    handlePagingChange: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: jest.fn(() => [jest.fn(), false]),
}));

jest.mock('../../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(() => ({
    permissions: {
      glossary: { ViewAll: true, ViewBasic: true },
      glossaryTerm: { ViewAll: true, ViewBasic: true },
    },
  })),
}));

jest.mock('../../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => {
    const WrappedComponent = (props: Record<string, unknown>) => (
      <Component {...props} />
    );

    return WrappedComponent;
  }),
}));

jest.mock('../../../context/AsyncDeleteProvider/AsyncDeleteProvider', () => ({
  useAsyncDeleteProvider: jest.fn(() => ({
    handleOnAsyncEntityDeleteConfirm: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock(
  '../../../components/common/ResizablePanels/ResizableLeftPanels',
  () =>
    jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
      <div>
        {firstPanel.children}
        {secondPanel.children}
      </div>
    ))
);

// Real `useGlossaryStore` is intentionally NOT mocked: this test exercises the
// store's real `updateActiveGlossary` against the real `GlossaryPage` and the
// real `GlossaryLeftPanel`, so it catches the referential-identity contract
// between the store mutation and the `[glossaries]`-keyed `menuItems` useMemo.

// Real `GlossaryLeftPanel` is intentionally NOT mocked either: the menu DOM is
// the observable under test. `GlossaryV1` is stubbed only to expose the
// active-glossary-driven label and drive the production `updateGlossary`
// handler through a button.
jest.mock('../../../components/Glossary/GlossaryV1.component', () => {
  return jest
    .fn()
    .mockImplementation(
      (props: {
        selectedData?: { displayName?: string };
        updateGlossary: (g: unknown) => Promise<void>;
      }) => (
        <div>
          <span data-testid="active-glossary-displayname">
            {props.selectedData?.displayName}
          </span>
          <button
            data-testid="trigger-update-glossary-displayname"
            onClick={() =>
              props.updateGlossary({
                ...props.selectedData,
                displayName: 'Alpha Renamed',
              })
            }>
            rename display only
          </button>
        </div>
      )
    );
});

// The create drawer is mocked so the test can capture the real
// `refreshGlossaryListAfterCreate` callback `GlossaryPage` wires into it and
// fire it on demand, without having to drive the AddGlossary form. The default
// stub keeps the (closed) drawer inert for the other tests in this file.
type OnCreated = (newFqn?: string) => void | Promise<void>;

const mockUseGlossaryCreateDrawer = jest.fn((_onCreated?: OnCreated) => ({
  formDrawer: null,
  openDrawer: jest.fn(),
  closeDrawer: jest.fn(),
}));

jest.mock('../../../components/Glossary/hooks/useGlossaryCreateDrawer', () => ({
  useGlossaryCreateDrawer: (onCreated?: OnCreated) =>
    mockUseGlossaryCreateDrawer(onCreated),
}));

jest.mock('../../../rest/glossaryAPI', () => {
  // Self-contained mock fixture so the factory does not reference any
  // hoisting-sensitive outer bindings.
  const alpha = {
    id: 'alpha-id',
    name: 'Alpha',
    displayName: 'Alpha',
    fullyQualifiedName: 'Alpha',
    description: '',
    version: 1.0,
    deleted: false,
  };

  return {
    getGlossariesList: jest.fn().mockResolvedValue({
      data: [alpha],
      paging: { total: 1 },
    }),
    // `patchGlossaries` returns the server-persisted glossary directly (the
    // real API returns `response.data`, i.e. the bare entity). Returning the
    // renamed glossary here mirrors the real client contract that
    // `GlossaryPage.updateGlossary` spreads into `updateActiveGlossary`.
    patchGlossaries: jest
      .fn()
      .mockResolvedValue({ ...alpha, displayName: 'Alpha Renamed' }),
    getGlossariesByName: jest.fn().mockResolvedValue(alpha),
    patchGlossaryTerm: jest.fn().mockResolvedValue({ data: alpha }),
    updateGlossaryVotes: jest.fn().mockResolvedValue({ entity: { votes: {} } }),
    updateGlossaryTermVotes: jest
      .fn()
      .mockResolvedValue({ entity: { votes: {} } }),
  };
});

const resetGlossaryStore = () => {
  act(() => {
    useGlossaryStore.setState({
      glossaries: [],
      activeGlossary: {} as ModifiedGlossary,
      glossaryChildTerms: [],
      termsLoading: false,
    });
  });
};

describe('GlossaryPage + real store + real GlossaryLeftPanel', () => {
  beforeEach(() => {
    resetGlossaryStore();
  });

  it('left panel menu and active-glossary header show the initial displayName on mount', async () => {
    renderWithQueryClient(<GlossaryPage pageTitle="Glossary" />);

    const menu = await screen.findByRole('navigation', {
      name: 'label.glossary-plural',
    });

    expect(within(menu).getByText('Alpha')).toBeInTheDocument();

    expect(
      await screen.findByTestId('active-glossary-displayname')
    ).toHaveTextContent('Alpha');
  });

  it('left panel menu updates after a displayName-only edit (no name/FQN change)', async () => {
    renderWithQueryClient(<GlossaryPage pageTitle="Glossary" />);

    // Wait for the glossary list to load and the real GlossaryLeftPanel/menu to
    // render with the initial displayName.
    const menu = await screen.findByRole('navigation', {
      name: 'label.glossary-plural',
    });

    expect(within(menu).getByText('Alpha')).toBeInTheDocument();

    const trigger = await screen.findByTestId(
      'trigger-update-glossary-displayname'
    );

    // Drive the production `GlossaryPage.updateGlossary` handler. The mocked
    // `patchGlossaries` resolves with the renamed glossary; because
    // `activeGlossary.name === updatedData.name`, the
    // `navigate` + `fetchGlossaryList` refresh branch is intentionally skipped
    // (this is exactly the displayName-only flow that exposed the stale menu).
    await act(async () => {
      fireEvent.click(trigger);
    });

    // The active-glossary-driven UI is fresh immediately after the edit.
    expect(screen.getByTestId('active-glossary-displayname')).toHaveTextContent(
      'Alpha Renamed'
    );

    // The left panel menu must reflect the new displayName too. Before the
    // fix, `updateActiveGlossary` mutated `glossaries` in place, so the
    // `[glossaries]`-keyed `menuItems` useMemo never recomputed and the menu
    // kept showing the stale "Alpha" label.
    expect(within(menu).getByText('Alpha Renamed')).toBeInTheDocument();
    expect(within(menu).queryByText('Alpha')).not.toBeInTheDocument();

    // A displayName-only edit must NOT trigger a list refetch or navigation:
    // the fix lives entirely in `updateActiveGlossary` producing a fresh
    // `glossaries` reference, not in re-running `fetchGlossaryList`.
    expect(getGlossariesList).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('GlossaryPage post-create refresh with a stale paging.after cursor', () => {
  let capturedOnCreated:
    | ((newFqn?: string) => void | Promise<void>)
    | undefined;

  beforeEach(() => {
    resetGlossaryStore();
    capturedOnCreated = undefined;
    mockUseGlossaryCreateDrawer.mockImplementation((onCreated?: OnCreated) => {
      capturedOnCreated = onCreated;

      return {
        formDrawer: null,
        openDrawer: jest.fn(),
        closeDrawer: jest.fn(),
      };
    });
    // The other tests in this file expect the default paging/FQN fixtures; only
    // this describe overrides them, so restore the defaults afterwards.
    (useFqn as jest.Mock).mockReturnValue({ fqn: 'Alpha' });
    (usePaging as jest.Mock).mockReturnValue({
      paging: {},
      pageSize: 15,
      handlePagingChange: jest.fn(),
    });
    (getGlossariesList as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'alpha-id',
          name: 'Alpha',
          displayName: 'Alpha',
          fullyQualifiedName: 'Alpha',
          deleted: false,
        },
      ],
      paging: { total: 1 },
    });
  });

  afterEach(() => {
    mockUseGlossaryCreateDrawer.mockReset();
    mockUseGlossaryCreateDrawer.mockImplementation(() => ({
      formDrawer: null,
      openDrawer: jest.fn(),
      closeDrawer: jest.fn(),
    }));
  });

  it('refreshes the sidebar from page 1 after a create, listing and highlighting the new glossary instead of truncating to the stale-cursor tail', async () => {
    // A 61-glossary deployment: page 1 holds the first 50, page 2 holds the
    // tail. The new glossary 'AAA' sorts onto page 1.
    const aaa = {
      id: 'aaa-id',
      name: 'AAA',
      displayName: 'AAA',
      fullyQualifiedName: 'AAA',
      deleted: false,
      version: 1.0,
    };
    const firstGlossary = {
      id: 'first-id',
      name: 'FirstGlossary',
      displayName: 'FirstGlossary',
      fullyQualifiedName: 'FirstGlossary',
      deleted: false,
      version: 1.0,
    };
    const tailGlossary = {
      id: 'tail-id',
      name: 'TailGlossary',
      displayName: 'TailGlossary',
      fullyQualifiedName: 'TailGlossary',
      deleted: false,
      version: 1.0,
    };

    const handlePagingChange = jest.fn();
    // Live paging already carries the page-2 cursor — exactly the state after
    // the initial first-page load with >50 glossaries. This is the stale
    // cursor the post-create refresh must NOT reuse.
    (usePaging as jest.Mock).mockReturnValue({
      paging: { after: 'page-two-cursor', before: '', total: 61 },
      pageSize: 15,
      handlePagingChange,
    });
    // The URL already points at the newly created glossary (the drawer
    // navigates to it on submit).
    (useFqn as jest.Mock).mockReturnValue({ fqn: 'AAA' });

    (getGlossariesList as jest.Mock).mockImplementation((params) => {
      if (params?.after === 'page-two-cursor') {
        // The tail (page 2) — what the buggy refresh would have fetched.
        return Promise.resolve({
          data: [tailGlossary],
          paging: { total: 61 },
        });
      }

      // Page 1 — what the fix forces the refresh to fetch, ignoring the stale
      // cursor. Includes the new glossary at the top.
      return Promise.resolve({
        data: [aaa, firstGlossary],
        paging: { after: 'page-two-cursor', total: 61 },
      });
    });
    (getGlossariesByName as jest.Mock).mockResolvedValue(aaa);

    renderWithQueryClient(<GlossaryPage pageTitle="Glossary" />);

    // The initial mount fetches the tail through the stale cursor (the buggy
    // setup state where paging.after is already non-null).
    await waitFor(() => expect(getGlossariesList).toHaveBeenCalledTimes(1));

    expect(getGlossariesList).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ after: 'page-two-cursor' })
    );

    // Before the refresh, the sidebar is truncated to the tail and the new
    // glossary is absent.
    let menu = await screen.findByRole('navigation', {
      name: 'label.glossary-plural',
    });

    expect(within(menu).queryByText('AAA')).not.toBeInTheDocument();
    expect(within(menu).getByText('TailGlossary')).toBeInTheDocument();

    // Fire the post-create refresh — the real `refreshGlossaryListAfterCreate`
    // captured from GlossaryPage, with the new glossary's FQN as the stop
    // target.
    await act(async () => {
      await capturedOnCreated?.('AAA');
    });

    // The refresh must start from page 1 — NOT send `after` — ignoring the
    // stale paging.after. The buggy version would have re-sent
    // `after: 'page-two-cursor'` and replaced the store with only the tail.
    await waitFor(() => expect(getGlossariesList).toHaveBeenCalledTimes(2));
    const refreshParams = (getGlossariesList as jest.Mock).mock.calls[1][0];

    expect(refreshParams).not.toHaveProperty('after');
    expect(refreshParams).toEqual(
      expect.objectContaining({
        fields: expect.any(Array),
        limit: 50,
      })
    );

    // The sidebar is restored from page 1 and now lists the new glossary (and
    // no longer the truncated tail).
    menu = screen.getByRole('navigation', { name: 'label.glossary-plural' });

    expect(within(menu).getByText('AAA')).toBeInTheDocument();
    expect(within(menu).getByText('FirstGlossary')).toBeInTheDocument();
    expect(within(menu).queryByText('TailGlossary')).not.toBeInTheDocument();

    // The new glossary is highlighted as the current page.
    expect(within(menu).getByText('AAA').closest('a')).toHaveAttribute(
      'aria-current',
      'page'
    );

    // The refresh resets paging to page 1 before fetching, so subsequent
    // infinite-scroll reads the fresh cursor rather than the stale one.
    expect(handlePagingChange).toHaveBeenCalledWith(pagingObject);
  });
});
