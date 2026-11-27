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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setOwnerHrefResolver } from '../../application/owner/owner-renderer';
import { AvatarGroup } from './avatar-group';

const OWNERS = ['ana', 'harsh', 'jo', 'priya', 'tomas'].map((name) => ({
  id: name,
  name,
  displayName: name,
  type: 'user' as const,
}));

describe('AvatarGroup overflow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Establish pointer modality so react-aria accepts hover events.
    fireEvent.mouseMove(document);
    setOwnerHrefResolver((owner) => `/users/${owner.name}`);
  });

  afterEach(() => {
    setOwnerHrefResolver(undefined);
    vi.useRealTimers();
  });

  it('lists every owner on hover, with links that do not take over the trigger', () => {
    render(
      <AvatarGroup
        maxCount={3}
        overflowTitleLabel="Assignees"
        overflowUsersLabel="Users"
        owners={OWNERS}
      />
    );
    const trigger = screen.getByTestId('avatar-group-overflow');

    expect(trigger).toHaveTextContent('+2');
    expect(trigger).toHaveAccessibleName('+2 more Assignees');

    fireEvent.mouseEnter(trigger, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(300));

    // The list names every owner, not only the two folded into "+2".
    expect(screen.getByText('5 Assignees')).toBeInTheDocument();
    expect(screen.getAllByTestId('owner-link')).toHaveLength(3 + OWNERS.length);
    // Inside a TooltipTrigger, each react-aria Link in the list picked up the
    // trigger's props and ref, so the list anchored to its own last link.
    screen.getAllByTestId('owner-link').forEach((link) => {
      expect(link).not.toHaveAttribute('aria-describedby');
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
