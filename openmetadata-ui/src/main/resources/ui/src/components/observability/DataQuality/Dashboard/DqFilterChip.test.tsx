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

import { act, fireEvent, render, screen } from '@testing-library/react';
import DqFilterChip from './DqFilterChip';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span data-testid="icon-chevron" />,
}));

jest.mock(
  'components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({
      children,
      onUpdate,
      onClose,
      popoverProps,
    }: any) => (
      <div
        data-owner-open={popoverProps?.open ? 'true' : 'false'}
        data-testid="user-team-selectable-list">
        <button
          data-testid="owner-update"
          onClick={() => onUpdate?.([{ id: 'u1', type: 'user' }])}>
          update owner
        </button>
        <button data-testid="owner-cancel" onClick={() => onClose?.()}>
          cancel
        </button>
        {children}
      </div>
    ),
  })
);

jest.mock('./DqSearchFilterChip', () => ({
  __esModule: true,
  default: ({ label, searchKey, isOpen }: any) => (
    <div
      data-isopen={isOpen ? 'true' : 'false'}
      data-searchkey={searchKey}
      data-testid="dq-search-filter-chip">
      {label}
    </div>
  ),
}));

const buildOwnerFilter = (overrides: Record<string, any> = {}) => ({
  type: 'owner' as const,
  key: 'owner',
  label: 'Owner',
  selectedOwners: [],
  selectedOwnerKeys: [{ key: 'u1' }],
  onChange: jest.fn(),
  ...overrides,
});

const buildSearchFilter = (overrides: Record<string, any> = {}) => ({
  type: 'search' as const,
  key: 'tags',
  label: 'Tags',
  searchKey: 'tags',
  searchProps: {},
  ...overrides,
});

describe('DqFilterChip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the owner variant for an owner filter', () => {
    render(
      <DqFilterChip
        filter={buildOwnerFilter() as any}
        isOpen={false}
        onOpenChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('user-team-selectable-list')).toBeInTheDocument();
    expect(screen.getByTestId('search-dropdown-owner')).toHaveTextContent(
      'Owner · 1'
    );
    expect(
      screen.queryByTestId('dq-search-filter-chip')
    ).not.toBeInTheDocument();
  });

  it('should reflect the open state on the owner popover', () => {
    render(
      <DqFilterChip
        isOpen
        filter={buildOwnerFilter() as any}
        onOpenChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('user-team-selectable-list')).toHaveAttribute(
      'data-owner-open',
      'true'
    );
  });

  it('should forward owner updates to the filter onChange', () => {
    const filter = buildOwnerFilter();
    render(
      <DqFilterChip
        filter={filter as any}
        isOpen={false}
        onOpenChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('owner-update'));

    expect(filter.onChange).toHaveBeenCalledWith([{ id: 'u1', type: 'user' }]);
  });

  // The list closes itself by clearing internal state, but `popoverProps` is
  // spread onto its Popover last — so controlling `open` here means owning the
  // close too, on both the commit and the cancel path.
  it('should close the owner popover once a selection is committed', async () => {
    const onOpenChange = jest.fn();
    const filter = buildOwnerFilter();

    render(
      <DqFilterChip isOpen filter={filter as any} onOpenChange={onOpenChange} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('owner-update'));
    });

    expect(filter.onChange).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should close the owner popover when the list is cancelled', () => {
    const onOpenChange = jest.fn();

    render(
      <DqFilterChip
        isOpen
        filter={buildOwnerFilter() as any}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByTestId('owner-cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should render the search variant for a search filter', () => {
    render(
      <DqFilterChip
        isOpen
        filter={buildSearchFilter() as any}
        onOpenChange={jest.fn()}
      />
    );

    const searchChip = screen.getByTestId('dq-search-filter-chip');

    expect(searchChip).toHaveTextContent('Tags');
    expect(searchChip).toHaveAttribute('data-searchkey', 'tags');
    expect(searchChip).toHaveAttribute('data-isopen', 'true');
    expect(
      screen.queryByTestId('user-team-selectable-list')
    ).not.toBeInTheDocument();
  });
});
