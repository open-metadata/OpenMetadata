/*
 *  Copyright 2023 Collate.
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
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import leftSidebarClassBase from '../../../utils/LeftSidebarClassBase';
import LeftSidebar from './LeftSidebar.component';

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({ applications: [], plugins: [] }),
  })
);

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: null,
    navigation: null,
    isLoading: false,
  }),
}));

describe('LeftSidebar', () => {
  it('marks an item current for a route the class base aliases to it', () => {
    const aliases = jest
      .spyOn(leftSidebarClassBase, 'getSidebarPathAliases')
      .mockReturnValue({ '/custom-section': '/explore' });

    try {
      render(
        <MemoryRouter initialEntries={['/custom-section/create']}>
          <LeftSidebar />
        </MemoryRouter>
      );

      const current = document.querySelector('[aria-current="page"]');

      expect(current).not.toBeNull();
      expect(
        current?.contains(screen.getByTestId('app-bar-item-explore')) ||
          screen.getByTestId('app-bar-item-explore').contains(current)
      ).toBe(true);
    } finally {
      aliases.mockRestore();
    }
  });

  it('renders sidebar links correctly', () => {
    render(
      <BrowserRouter>
        <LeftSidebar />
      </BrowserRouter>
    );

    expect(screen.getByTestId('image')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-explore')).toBeInTheDocument();
    expect(screen.getByTestId('observability')).toBeInTheDocument();
    expect(screen.getByTestId('data-marketplace-section')).toBeInTheDocument();
    expect(screen.getByTestId('governance')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-settings')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-logout')).toBeInTheDocument();
  });

  it.each([
    [
      'click',
      (user: ReturnType<typeof userEvent.setup>, el: HTMLElement) =>
        user.click(el),
    ],
    [
      'Enter',
      async (user: ReturnType<typeof userEvent.setup>, el: HTMLElement) => {
        el.focus();
        await user.keyboard('{Enter}');
      },
    ],
  ])('asks to confirm logout on %s', async (_, activate) => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <BrowserRouter>
        <LeftSidebar />
      </BrowserRouter>
    );

    const logout = screen.getByTestId('app-bar-item-logout');

    expect(logout.tagName).toBe('BUTTON');

    await activate(user, logout);

    expect(await screen.findByTestId('confirm-logout')).toBeInTheDocument();
  });
});
