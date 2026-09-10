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

import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  ModifiedGlossary,
  useGlossaryStore,
} from '../../../components/Glossary/useGlossary.store';
import { getGlossariesList } from '../../../rest/glossaryAPI';
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

    const menu = await screen.findByRole('menu');

    expect(within(menu).getByText('Alpha')).toBeInTheDocument();

    expect(
      await screen.findByTestId('active-glossary-displayname')
    ).toHaveTextContent('Alpha');
  });

  it('left panel menu updates after a displayName-only edit (no name/FQN change)', async () => {
    renderWithQueryClient(<GlossaryPage pageTitle="Glossary" />);

    // Wait for the glossary list to load and the real GlossaryLeftPanel/menu to
    // render with the initial displayName.
    const menu = await screen.findByRole('menu');

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
