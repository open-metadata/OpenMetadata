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
import userEvent from '@testing-library/user-event';
import type { ComponentProps, FormEvent } from 'react';
import { useRef, useState } from 'react';
import { ExploreSearchInput } from './ExploreSearchInput';

let mockIsAppleDevice = true;
const ARIA_KEY_SHORTCUTS = 'aria-keyshortcuts';

jest.mock('@react-aria/utils', () => ({
  isAppleDevice: () => mockIsAppleDevice,
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual<
    typeof import('@openmetadata/ui-core-components')
  >('@openmetadata/ui-core-components');
  const react = jest.requireActual<typeof import('react')>('react');

  return {
    ...actual,
    SelectPopover: (props: ComponentProps<typeof actual.SelectPopover>) =>
      react.createElement(actual.SelectPopover, {
        ...props,
        'data-classname-type': typeof props.className,
      } as ComponentProps<typeof actual.SelectPopover>),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../components/AppBar/Suggestions', () => ({
  __esModule: true,
  default: () => <button type="button">Suggestion</button>,
}));

const SearchInputHarness = () => {
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [isSearchBoxOpen, setIsSearchBoxOpen] = useState(false);

  return (
    <ExploreSearchInput
      isNLPEnabled
      isNLPActive={false}
      isSearchBoxOpen={isSearchBoxOpen}
      searchContainerRef={searchContainerRef}
      searchValue={searchValue}
      suggestionSearch={searchValue}
      onClearSearch={jest.fn()}
      onNLPToggle={jest.fn()}
      onSearchBoxOpenChange={setIsSearchBoxOpen}
      onSearchChange={(value) => {
        setSearchValue(value);
        setIsSearchBoxOpen(Boolean(value));
      }}
      onSubmit={(event: FormEvent<HTMLFormElement>) => event.preventDefault()}
      onSuggestionSelect={jest.fn()}
    />
  );
};

describe('ExploreSearchInput', () => {
  beforeEach(() => {
    mockIsAppleDevice = true;
  });

  it('does not render an Ask Collate action', () => {
    render(<SearchInputHarness />);

    expect(
      screen.queryByTestId('explore-ask-collate-button')
    ).not.toBeInTheDocument();
  });

  it('renders the global Ask Collate shortcut hint', () => {
    render(<SearchInputHarness />);

    const shortcut = screen.getByTestId('explore-search-shortcut');
    const searchInput = screen.getByRole('textbox');

    expect(shortcut).toHaveTextContent('⌘K');
    expect(shortcut).toHaveAccessibleName(
      'message.explore-search-placeholder (⌘K)'
    );
    expect(shortcut).not.toHaveAttribute(ARIA_KEY_SHORTCUTS);
    expect(searchInput).not.toHaveAttribute(ARIA_KEY_SHORTCUTS);
  });

  it('renders the Ctrl+K shortcut hint on non-Apple devices', () => {
    mockIsAppleDevice = false;

    render(<SearchInputHarness />);

    const shortcut = screen.getByTestId('explore-search-shortcut');
    const searchInput = screen.getByRole('textbox');

    expect(shortcut).toHaveTextContent('Ctrl+K');
    expect(shortcut).toHaveAccessibleName(
      'message.explore-search-placeholder (Ctrl+K)'
    );
    expect(searchInput).not.toHaveAttribute(ARIA_KEY_SHORTCUTS);
  });

  it('leaves the shortcut for the global Ask Collate listener', () => {
    render(<SearchInputHarness />);

    const globalShortcutHandler = jest.fn();
    window.addEventListener('keydown', globalShortcutHandler);

    fireEvent.keyDown(window, { key: 'k', metaKey: true });

    expect(globalShortcutHandler).toHaveBeenCalledTimes(1);

    window.removeEventListener('keydown', globalShortcutHandler);
  });

  it('uses a compact clear icon without an added stroke', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchInputHarness />);

    await user.type(screen.getByRole('textbox'), 'orders');

    const clearIcon = screen
      .getByTestId('explore-clear-search-button')
      .querySelector('svg-mock');

    expect(clearIcon).toHaveAttribute(
      'classname',
      expect.stringContaining('tw:size-3.5')
    );
    expect(clearIcon).not.toHaveAttribute(
      'classname',
      expect.stringContaining('tw:[&_path]:stroke-current')
    );
  });

  it('uses the prefixed placeholder color utility only once', () => {
    render(<SearchInputHarness />);

    const searchInput = screen.getByRole('textbox');

    expect(searchInput).toHaveClass('tw:placeholder:text-tertiary');
    expect(searchInput).not.toHaveClass('placeholder:tw:text-tertiary');
  });

  it('keeps the search input editable while showing suggestions', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchInputHarness />);

    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    await user.type(searchInput, 'orders');

    expect(searchInput).toBeInTheDocument();
    expect(
      await screen.findByTestId('explore-search-popover')
    ).toBeInTheDocument();
    expect(searchInput).toHaveFocus();
    expect(searchInput).toHaveValue('orders');
  });

  it('delegates transition-state classes to the core popover', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchInputHarness />);

    const searchInput = screen.getByRole('textbox');
    await user.type(searchInput, 'orders');

    const popover = await screen.findByTestId('explore-search-popover');

    expect(popover).toHaveAttribute('data-classname-type', 'string');
  });

  it('closes the suggestions when interacting outside the search input', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchInputHarness />);

    const searchInput = screen.getByRole('textbox');
    await user.click(searchInput);
    await user.type(searchInput, 'orders');

    expect(
      await screen.findByTestId('explore-search-popover')
    ).toBeInTheDocument();

    await user.click(document.body);

    expect(
      screen.queryByTestId('explore-search-popover')
    ).not.toBeInTheDocument();
  });
});
