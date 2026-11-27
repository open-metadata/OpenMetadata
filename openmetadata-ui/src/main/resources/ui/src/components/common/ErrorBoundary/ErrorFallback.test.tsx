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
import { ERROR500 } from '../../../constants/constants';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import ErrorFallback from './ErrorFallback';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const chunkLoadError = Object.assign(new Error('chunk 42 failed'), {
  name: 'ChunkLoadError',
});

describe('ErrorFallback', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    document.documentElement.classList.remove('dark-mode');
  });

  it.each([
    ['a ChunkLoadError', chunkLoadError],
    [
      "Vite's dynamic-import failure",
      new Error('Failed to fetch dynamically imported module: /x.js'),
    ],
    [
      "Safari's dynamic-import failure",
      new Error('Importing a module script failed.'),
    ],
  ])('shows the upgrade screen for %s and reloads on refresh', (_, error) => {
    render(<ErrorFallback error={error} resetErrorBoundary={jest.fn()} />);

    expect(screen.getByTestId('upgrade-screen')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('refresh-page-btn'));

    expect(mockNavigate).toHaveBeenCalledWith(0);
  });

  it('shows the 500 fallback for any other error and resets on Home', () => {
    const resetErrorBoundary = jest.fn();
    render(
      <ErrorFallback
        error={new Error('boom')}
        resetErrorBoundary={resetErrorBoundary}
      />
    );

    expect(screen.queryByTestId('upgrade-screen')).not.toBeInTheDocument();
    expect(screen.getByText(ERROR500)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.home'));

    expect(resetErrorBoundary).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each([
    ['a thrown string', 'boom', 'boom'],
    ['a plain error object', { message: 'boom' }, 'boom'],
    ['a thrown null', null, undefined],
  ])('renders the fallback for %s', (_, error, message) => {
    render(<ErrorFallback error={error} resetErrorBoundary={jest.fn()} />);

    expect(screen.getByText(ERROR500)).toBeInTheDocument();
    expect(screen.queryByTestId('upgrade-screen')).not.toBeInTheDocument();

    if (message) {
      expect(screen.getByText(message)).toBeInTheDocument();
    }
  });

  it.each([
    ['light', false],
    ['dark', true],
  ] as const)(
    'picks the %s illustration from the root dark-mode class',
    (theme, isDark) => {
      document.documentElement.classList.toggle('dark-mode', isDark);
      const getImg = jest.spyOn(brandClassBase, 'getUpgradeScreenImg');

      render(
        <ErrorFallback error={chunkLoadError} resetErrorBoundary={jest.fn()} />
      );

      expect(getImg).toHaveBeenCalledWith(theme);

      getImg.mockRestore();
    }
  );
});
