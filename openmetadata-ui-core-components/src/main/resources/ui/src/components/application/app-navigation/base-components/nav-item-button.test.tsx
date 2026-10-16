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
import { RouterProvider } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';
import { NavItemButton } from './nav-item-button';

const Icon = () => <svg />;

const renderButton = (navigate = vi.fn(), onClick = vi.fn()) => {
  render(
    <RouterProvider navigate={navigate}>
      <NavItemButton
        href="/settings"
        icon={Icon}
        label="Settings"
        onClick={onClick}
      />
    </RouterProvider>
  );

  return { navigate, onClick, link: screen.getByRole('link') };
};

describe('NavItemButton', () => {
  it('navigates through the client router instead of reloading the page', () => {
    const { navigate, onClick, link } = renderButton();

    const notPrevented = fireEvent.click(link);

    expect(onClick).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/settings', undefined);
    expect(notPrevented).toBe(false);
  });

  it('leaves modified clicks to the browser', () => {
    const { navigate, link } = renderButton();

    fireEvent.click(link, { metaKey: true });

    expect(navigate).not.toHaveBeenCalled();
  });
});
