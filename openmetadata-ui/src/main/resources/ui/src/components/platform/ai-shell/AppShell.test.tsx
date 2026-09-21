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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';

const mockPage = jest.fn();

jest.mock('use-analytics', () => ({
  useAnalytics: () => ({ page: mockPage }),
}));

jest.mock('../../AppRouter/withSuspenseFallback', () => ({
  __esModule: true,
  default: () => () => <div data-testid="personal-space-modal" />,
}));

jest.mock('./Sidebar/Sidebar', () => () => <nav data-testid="sidebar" />);

jest.mock('./appModeExtensions', () => ({
  useAppModeBanners: () => [
    {
      key: 'banner',
      component: () => <div data-testid="banner" />,
    },
  ],
  useAppModeOverlays: () => [
    {
      key: 'overlay',
      component: () => <div data-testid="overlay" />,
    },
  ],
}));

describe('AppShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('composes app chrome while leaving the routed page as the only main landmark', () => {
    render(
      <MemoryRouter initialEntries={['/ai-studio?tab=agents#details']}>
        <AppShell>
          <main data-testid="route-content">Route content</main>
        </AppShell>
      </MemoryRouter>
    );

    const shell = screen.getByTestId('app-shell');
    const content = screen.getByTestId('app-shell-content');

    expect(shell).toHaveClass('assistant-layout');
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(content).toHaveClass('assistant-content');
    expect(content).toContainElement(screen.getByTestId('banner'));
    expect(content).toContainElement(screen.getByTestId('route-content'));
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(shell).not.toContainElement(screen.getByTestId('overlay'));
    expect(shell).not.toContainElement(
      screen.getByTestId('personal-space-modal')
    );
    expect(mockPage).toHaveBeenCalledTimes(1);
  });
});
