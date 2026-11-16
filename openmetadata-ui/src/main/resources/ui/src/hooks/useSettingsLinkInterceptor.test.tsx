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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AI_APP_MODE, DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { useAppModeStore } from './useAppMode';
import { useSettingsLinkInterceptor } from './useSettingsLinkInterceptor';

jest.mock('../utils/GlobalSettingsClassBase', () => ({
  __esModule: true,
  default: { getGlobalSettingsMenuWithPermission: jest.fn(() => []) },
}));

const Harness = ({ href }: { href: string }) => {
  useSettingsLinkInterceptor();
  const { pathname, search, hash } = useLocation();

  return (
    <>
      {/* Rich text renders mentions as plain anchors opening a new tab. */}
      <a data-type="mention" href={href} rel="noreferrer" target="_blank">
        @mention
      </a>
      <span data-testid="location">{`${pathname}${search}${hash}`}</span>
    </>
  );
};

// The hook reads the live URL, as the app's BrowserRouter does.
const renderAt = (href: string) => {
  globalThis.history.replaceState(null, '', '/explore/tables?page=2');

  return render(
    <MemoryRouter initialEntries={['/explore/tables?page=2']}>
      <Harness href={href} />
    </MemoryRouter>
  );
};

const click = (init?: MouseEventInit) =>
  fireEvent.click(screen.getByText('@mention'), init);

describe('useSettingsLinkInterceptor', () => {
  const origin = globalThis.location.origin;

  beforeEach(() => useAppModeStore.getState().setMode(AI_APP_MODE));

  afterEach(() => {
    useAppModeStore.getState().setMode(DEFAULT_APP_MODE);
    globalThis.history.replaceState(null, '', '/');
  });

  it.each([
    [
      `${origin}/users/bravec0c8cc8e.tiger`,
      '#members/user/bravec0c8cc8e.tiger',
    ],
    [
      `${origin}/settings/members/teams/PW%25data_team`,
      '#members/teams/PW%25data_team',
    ],
  ])('opens %s in the settings modal over the page', (href, hash) => {
    renderAt(href);

    expect(click()).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent(
      `/explore/tables?page=2${hash}`
    );
  });

  it('opens the page and modal in a new tab on a modifier click', () => {
    const open = jest.spyOn(globalThis, 'open').mockReturnValue(null);
    renderAt(`${origin}/users/alice`);

    click({ metaKey: true });

    expect(open).toHaveBeenCalledWith(
      '/explore/tables?page=2#members/user/alice',
      '_blank',
      'noopener'
    );
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/explore/tables?page=2'
    );

    open.mockRestore();
  });

  it.each([
    `${origin}/table/svc.db.schema.orders`,
    `${origin}/users/password/reset`,
    'https://example.com/users/alice',
  ])('leaves %s to the browser', (href) => {
    renderAt(href);

    expect(click()).toBe(true);
  });
});
