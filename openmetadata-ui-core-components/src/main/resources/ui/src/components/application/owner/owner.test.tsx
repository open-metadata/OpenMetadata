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

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Owner } from './owner';
import { setOwnerHrefResolver, setOwnerRenderer } from './owner-renderer';

describe('Owner empty placeholder', () => {
  it('renders the no-owner-icon for the compact empty placeholder', () => {
    render(<Owner owners={[]} placeHolder="No Assignee" />);

    expect(screen.getByTestId('no-owner-icon')).toBeInTheDocument();
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
});
