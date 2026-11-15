/*
 *  Copyright 2025 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-aria-components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Owner } from './owner';
import { setOwnerHrefResolver, setOwnerRenderer } from './owner-renderer';

describe('Owner empty placeholder', () => {
  it('renders the no-owner-icon for the compact empty placeholder', () => {
    render(<Owner owners={[]} placeHolder="No Assignee" />);

    expect(screen.getByTestId('no-owner-icon')).toBeInTheDocument();
  });

  it.each([
    ['compact', {}],
    ['compact with permission but no selector', { hasPermission: true }],
    ['non-compact without a label', { isCompactView: false, showLabel: false }],
    ['non-compact under a label', { isCompactView: false }],
    [
      'non-compact header with an edit selector',
      {
        isCompactView: false,
        selectorContent: <button type="button">edit</button>,
      },
    ],
    [
      'inline with an edit selector',
      {
        isCompactView: false,
        selectorContent: <button type="button">edit</button>,
        showLabel: false,
      },
    ],
  ])(
    'shows -- with no glyph when the empty state is not named (%s)',
    (_, props) => {
      render(<Owner owners={[]} {...props} />);

      expect(screen.getByTestId('owner-empty-placeholder')).toHaveTextContent(
        /^--$/
      );
      expect(screen.queryByTestId('no-owner-icon')).not.toBeInTheDocument();
    }
  );

  it('keeps a named empty state and its glyph instead of --', () => {
    render(<Owner owners={[]} placeHolder="No Assignee" showLabel={false} />);

    expect(screen.getByTestId('owner-empty-placeholder')).toHaveTextContent(
      'No Assignee'
    );
    expect(screen.getByTestId('no-owner-icon')).toBeInTheDocument();
  });

  it('keeps a named empty state in the non-compact layout without a label', () => {
    render(
      <Owner
        isCompactView={false}
        owners={[]}
        placeHolder="No Reviewers"
        showLabel={false}
      />
    );

    expect(screen.getByTestId('owner-empty-placeholder')).toHaveTextContent(
      'No Reviewers'
    );
  });

  it('shows -- under a label, where placeHolder is the label', () => {
    render(<Owner isCompactView={false} owners={[]} placeHolder="Assignee" />);

    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByTestId('owner-empty-placeholder')).toHaveTextContent(
      /^--$/
    );
  });

  it('forces -- over a named empty state with showDashPlaceholder', () => {
    render(
      <Owner
        showDashPlaceholder
        owners={[]}
        placeHolder="No Assignee"
        showLabel={false}
      />
    );

    expect(screen.getByTestId('owner-empty-placeholder')).toHaveTextContent(
      /^--$/
    );
    expect(screen.queryByTestId('no-owner-icon')).not.toBeInTheDocument();
  });

  it('does not render the no-owner-icon when an owner is present', () => {
    render(
      <Owner
        owners={[
          { id: 'u1', name: 'user1', displayName: 'User One', type: 'user' },
        ]}
      />
    );

    expect(screen.queryByTestId('no-owner-icon')).not.toBeInTheDocument();
  });

  it('sets the labelled header placeholder in the header value type', () => {
    render(
      <Owner
        showDashPlaceholder
        isCompactView={false}
        owners={[]}
        selectorContent={<button type="button">edit</button>}
      />
    );

    const placeholder = screen.getByTestId('owner-empty-placeholder');

    expect(placeholder).toHaveTextContent('--');
    expect(placeholder).toHaveClass(
      'tw:text-sm',
      'tw:font-medium',
      'tw:text-secondary'
    );
    expect(placeholder).not.toHaveClass('tw:text-xs');
    expect(placeholder).not.toHaveClass('tw:text-quaternary');
  });

  it('keeps the de-emphasised placeholder under a label with no edit selector', () => {
    render(<Owner isCompactView={false} owners={[]} />);

    expect(screen.getByTestId('owner-empty-placeholder')).toHaveClass(
      'tw:text-xs',
      'tw:text-quaternary'
    );
  });

  it('sets a table-cell placeholder at body size in the subtle tone', () => {
    render(
      <Owner
        isCompactView={false}
        labelVariant="cell"
        owners={[]}
        showLabel={false}
      />
    );

    const placeholder = screen.getByTestId('owner-empty-placeholder');

    expect(placeholder).toHaveClass('tw:text-sm', 'tw:text-quaternary');
    expect(placeholder).not.toHaveClass('tw:text-xs');
    expect(placeholder).not.toHaveClass('tw:font-medium');
  });

  it('lets a header with no edit selector opt into the header value type', () => {
    render(
      <Owner
        isCompactView={false}
        labelVariant="header"
        owners={[]}
        showLabel={false}
      />
    );

    expect(screen.getByTestId('owner-empty-placeholder')).toHaveClass(
      'tw:text-sm',
      'tw:font-medium',
      'tw:text-secondary'
    );
  });

  it('applies the label variant in the inline editable layout', () => {
    render(
      <Owner
        isCompactView={false}
        labelVariant="cell"
        owners={[]}
        selectorContent={<button type="button">edit</button>}
        showLabel={false}
      />
    );

    const placeholder = screen.getByTestId('owner-empty-placeholder');

    expect(placeholder).toHaveClass('tw:text-sm', 'tw:text-quaternary');
    expect(placeholder).not.toHaveClass('tw:text-xs');
  });

  it('keeps the de-emphasised placeholder when there is no label row', () => {
    render(<Owner isCompactView={false} owners={[]} showLabel={false} />);

    expect(screen.getByTestId('owner-empty-placeholder')).toHaveClass(
      'tw:text-xs',
      'tw:text-quaternary'
    );
  });
});

describe('Owner inline editable mode (non-compact, no label, with selector)', () => {
  const selector = <button data-testid="edit-selector">edit</button>;

  it('renders owner name and the selector on a single row when an owner is present', () => {
    render(
      <Owner
        isCompactView={false}
        owners={[
          { id: 'u1', name: 'user1', displayName: 'User One', type: 'user' },
        ]}
        selectorContent={selector}
        showLabel={false}
      />
    );

    expect(screen.getByText('User One')).toBeInTheDocument();
    expect(screen.getByTestId('edit-selector')).toBeInTheDocument();
    // No column label header is rendered in inline mode.
    expect(screen.queryByText('No Assignee')).not.toBeInTheDocument();
  });

  it('renders the no-owner icon, placeholder and selector inline when empty', () => {
    render(
      <Owner
        isCompactView={false}
        owners={[]}
        placeHolder="No Assignee"
        selectorContent={selector}
        showLabel={false}
      />
    );

    expect(screen.getByTestId('no-owner-icon')).toBeInTheDocument();
    expect(screen.getByText('No Assignee')).toBeInTheDocument();
    expect(screen.getByTestId('edit-selector')).toBeInTheDocument();
  });
});

describe('Owner registered renderer (uniform hover card)', () => {
  const owner = {
    id: 'u1',
    name: 'user1',
    displayName: 'User One',
    type: 'user' as const,
  };

  afterEach(() => {
    setOwnerRenderer(undefined);
  });

  it('wraps compact avatars with the registered renderer', () => {
    setOwnerRenderer((o, chip) => (
      <div data-testid={`hover-${o.name}`}>{chip}</div>
    ));

    render(<Owner owners={[owner]} />);

    // Compact previously rendered a bare avatar with no hover card — it must now
    // be wrapped like every other owner chip.
    expect(screen.getByTestId('hover-user1')).toBeInTheDocument();
  });

  it('wraps every visible chip in a compact multi-owner row', () => {
    setOwnerRenderer((o, chip) => (
      <div data-testid={`hover-${o.name}`}>{chip}</div>
    ));

    render(
      <Owner
        owners={[owner, { id: 'u2', name: 'user2', type: 'user' as const }]}
      />
    );

    expect(screen.getByTestId('hover-user1')).toBeInTheDocument();
    expect(screen.getByTestId('hover-user2')).toBeInTheDocument();
  });

  it('wraps the non-compact single owner with the registered renderer', () => {
    setOwnerRenderer((o, chip) => (
      <div data-testid={`hover-${o.name}`}>{chip}</div>
    ));

    render(<Owner isCompactView={false} owners={[owner]} showLabel={false} />);

    expect(screen.getByTestId('hover-user1')).toBeInTheDocument();
  });

  it('renders bare chips when no renderer is registered', () => {
    render(<Owner owners={[owner]} />);

    expect(screen.queryByTestId('hover-user1')).not.toBeInTheDocument();
    expect(screen.getByTestId('User One')).toBeInTheDocument();
  });
});

describe('Owner href resolver (in-app profile link)', () => {
  const owner = {
    id: 'u1',
    name: 'user1',
    displayName: 'User One',
    type: 'user' as const,
  };

  afterEach(() => {
    setOwnerHrefResolver(undefined);
  });

  it('links the owner name using the registered resolver', () => {
    setOwnerHrefResolver((o) => `/users/${o.name}`);

    render(<Owner isCompactView={false} owners={[owner]} showLabel={false} />);

    expect(screen.getByTestId('owner-link')).toHaveAttribute(
      'href',
      '/users/user1'
    );
  });

  it('renders the name as plain text when no resolver is registered', () => {
    render(<Owner isCompactView={false} owners={[owner]} showLabel={false} />);

    // owner-link wrapper still present, but it is a span (no href).
    expect(screen.getByTestId('owner-link')).not.toHaveAttribute('href');
  });

  // Two or more owners take the stacked AvatarGroup path instead of OwnerChip.
  // That branch resolved its href separately and went unlinked once `Owner`
  // started stripping incoming hrefs, leaving multi-owner entities with avatars
  // that could not be clicked at all.
  it('links every owner in a stacked group using the registered resolver', () => {
    setOwnerHrefResolver((o) => `/users/${o.name}`);
    const second = {
      id: 'u2',
      name: 'user2',
      displayName: 'User Two',
      type: 'user' as const,
    };

    render(
      <Owner isCompactView={false} owners={[owner, second]} showLabel={false} />
    );

    expect(
      screen.getAllByTestId('owner-link').map((el) => el.getAttribute('href'))
    ).toEqual(['/users/user1', '/users/user2']);
  });

  // A native hash click bypasses the app router, so the router could not
  // track the entry (e.g. the settings modal's history). Plain left clicks go
  // through the RouterProvider; modified clicks keep opening a new tab.
  it.each([
    ['a single owner', [owner]],
    [
      'a stacked group',
      [owner, { ...owner, id: 'u2', name: 'user2', displayName: 'User Two' }],
    ],
  ])('navigates %s through the router on a plain click only', (_, owners) => {
    // Hash-only: jsdom can follow a hash change natively, not a page load.
    setOwnerHrefResolver((o) => `#members/users/${o.name}`);
    const navigate = vi.fn();

    render(
      <RouterProvider navigate={navigate}>
        <Owner isCompactView={false} owners={owners} showLabel={false} />
      </RouterProvider>
    );
    const [link] = screen.getAllByTestId('owner-link');
    // `detail: 1` makes it a pointer click rather than a virtual one.
    const click = (modifiers = {}) =>
      fireEvent.click(link, { detail: 1, ...modifiers });

    click({ metaKey: true });
    click({ ctrlKey: true });
    click({ shiftKey: true });

    expect(navigate).not.toHaveBeenCalled();

    click();

    expect(navigate).toHaveBeenCalledWith('#members/users/user1', undefined);

    // The modified clicks followed the hash natively; drop it for later tests.
    window.history.replaceState(null, '', '/');
  });
});

describe('Owner inherited badge', () => {
  const inheritedUser = {
    id: 'u1',
    name: 'user1',
    type: 'user',
    inherited: true,
  };
  const inheritedTeam = {
    id: 't1',
    name: 'team1',
    type: 'team',
    inherited: true,
  };
  const directUser = { id: 'u2', name: 'user2', type: 'user' };

  afterEach(() => {
    setOwnerHrefResolver(undefined);
  });

  it('marks only inherited owners in the compact view', () => {
    render(<Owner owners={[inheritedUser, directUser]} />);

    expect(screen.getAllByTestId('inherited-owner-icon')).toHaveLength(1);
  });

  it('marks an inherited team owner in the non-compact view', () => {
    render(<Owner isCompactView={false} owners={[inheritedTeam]} />);

    expect(screen.getByTestId('inherited-owner-icon')).toBeInTheDocument();
  });

  it('marks inherited owners inside the non-compact avatar stack', () => {
    render(
      <Owner
        isCompactView={false}
        owners={[inheritedUser, inheritedTeam, directUser]}
      />
    );

    expect(screen.getAllByTestId('inherited-owner-icon')).toHaveLength(2);
  });

  it('renders no badge when no owner is inherited', () => {
    render(<Owner isCompactView={false} owners={[directUser]} />);

    expect(
      screen.queryByTestId('inherited-owner-icon')
    ).not.toBeInTheDocument();
  });

  it('names inherited owners as inherited in the stacked avatar links', () => {
    setOwnerHrefResolver((o) => `/users/${o.name}`);

    render(
      <Owner
        isCompactView={false}
        owners={[inheritedUser, inheritedTeam, directUser]}
      />
    );

    expect(screen.getByRole('link', { name: /^user1, \S/ })).toBeVisible();
    expect(screen.getByRole('link', { name: 'user2' })).toBeVisible();
  });

  it('scales the badge with the avatar size', () => {
    const { unmount } = render(
      <Owner avatarSize={24} owners={[inheritedUser]} />
    );

    expect(screen.getByTestId('inherited-owner-icon')).toHaveAttribute(
      'width',
      '10'
    );

    unmount();
    render(<Owner avatarSize={64} owners={[inheritedUser]} />);

    expect(screen.getByTestId('inherited-owner-icon')).toHaveAttribute(
      'width',
      '20'
    );
  });
});
