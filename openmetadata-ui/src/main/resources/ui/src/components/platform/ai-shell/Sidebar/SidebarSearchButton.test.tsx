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
import { OPEN_SEARCH_SHORTCUT } from '../GlobalSearch/GlobalSearch.constants';
import { useGlobalSearchStore } from '../GlobalSearch/useGlobalSearchStore';
import SidebarSearchButton from './SidebarSearchButton';

describe('SidebarSearchButton', () => {
  beforeEach(() => {
    useGlobalSearchStore.setState({ isOpen: false, entry: 'chats' });
  });

  it('is a button that names the search and its shortcut', () => {
    render(<SidebarSearchButton />);

    expect(
      screen.getByRole('button', { name: 'label.name-with-shortcut' })
    ).toBeInTheDocument();
    expect(screen.getByText(OPEN_SEARCH_SHORTCUT).tagName).toBe('KBD');
  });

  it('opens global search for everything when pressed', () => {
    render(<SidebarSearchButton />);

    fireEvent.click(screen.getByTestId('ask-nav-item-search'));

    expect(useGlobalSearchStore.getState()).toMatchObject({
      isOpen: true,
      entry: 'all',
    });
  });

  it('opens from the keyboard', () => {
    render(<SidebarSearchButton />);
    const trigger = screen.getByTestId('ask-nav-item-search');

    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyUp(trigger, { key: 'Enter' });

    expect(useGlobalSearchStore.getState().isOpen).toBe(true);
  });
});
