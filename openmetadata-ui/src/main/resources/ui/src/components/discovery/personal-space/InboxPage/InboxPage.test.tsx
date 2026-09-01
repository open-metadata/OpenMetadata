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
import React, { ReactNode } from 'react';

jest.mock('@untitledui/icons', () => ({
  Inbox01: () => <span data-testid="inbox-icon" />,
}));

let tabsOnChange: ((key: string) => void) | undefined;

jest.mock('@openmetadata/ui-core-components', () => {
  const TabsRoot = ({
    onSelectionChange,
    children,
  }: {
    onSelectionChange?: (...args: unknown[]) => void;
    children?: ReactNode;
  }) => {
    tabsOnChange = onSelectionChange;

    return <div>{children}</div>;
  };
  const TabsList = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const TabsItem = ({ id, label }: { id?: string; label?: ReactNode }) => (
    <button
      data-testid={`tab-${id}`}
      type="button"
      onClick={() => tabsOnChange?.(id)}>
      {label}
    </button>
  );

  const Tabs = Object.assign(TabsRoot, { List: TabsList, Item: TabsItem });

  return {
    Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Typography: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    FeaturedIcon: () => <span data-testid="inbox-featured-icon" />,
    EmptyPlaceholder: ({ title }: { title?: ReactNode }) => (
      <div data-testid="inbox-empty">{title}</div>
    ),
    Tabs,
  };
});

jest.mock('components/common/HeaderShell/HeaderShell.component', () => ({
  __esModule: true,
  default: ({
    leading,
    title,
    footer,
    variant,
  }: {
    leading?: ReactNode;
    title?: ReactNode;
    footer?: ReactNode;
    variant?: string;
  }) => (
    <div data-testid="inbox-header" data-variant={variant}>
      {leading}
      {title}
      {footer}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockNavigate = jest.fn();
let mockPathname = '/inbox';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

let mockIsAiMode = true;

jest.mock('hooks/useAppMode', () => ({
  useIsAiMode: () => mockIsAiMode,
}));

import InboxPage from './InboxPage';

const triageContent = <div data-testid="triage-content" />;
const myDataContent = <div data-testid="my-data-content" />;

const renderShell = () =>
  render(
    <InboxPage myDataContent={myDataContent} triageContent={triageContent} />
  );

describe('InboxPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPathname = '/inbox';
    mockIsAiMode = true;
  });

  it('shows the Triage content on the /inbox route', () => {
    renderShell();

    expect(screen.getByTestId('triage-content')).toBeInTheDocument();
    expect(screen.queryByTestId('my-data-content')).not.toBeInTheDocument();
  });

  it('shows the My Data content on the /my-data route', () => {
    mockPathname = '/my-data';
    renderShell();

    expect(screen.getByTestId('my-data-content')).toBeInTheDocument();
    expect(screen.queryByTestId('triage-content')).not.toBeInTheDocument();
  });

  it('navigates to /my-data when the My Data tab is clicked', () => {
    renderShell();

    fireEvent.click(screen.getByTestId('tab-my-data'));

    expect(mockNavigate).toHaveBeenCalledWith('/my-data');
  });

  it('navigates back to /inbox when the Triage tab is clicked', () => {
    mockPathname = '/my-data';
    renderShell();

    fireEvent.click(screen.getByTestId('tab-triage'));

    expect(mockNavigate).toHaveBeenCalledWith('/inbox');
  });

  it('renders the placeholder when the consumer contributes no content', () => {
    render(<InboxPage />);

    expect(screen.getByTestId('inbox-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('triage-content')).not.toBeInTheDocument();
  });

  it('renders the gradient header only in AI mode', () => {
    renderShell();

    expect(screen.getByTestId('inbox-header')).toHaveAttribute(
      'data-variant',
      'gradient'
    );
  });

  it('renders the flat header outside AI mode', () => {
    mockIsAiMode = false;
    renderShell();

    expect(screen.getByTestId('inbox-header')).toHaveAttribute(
      'data-variant',
      'flat'
    );
  });
});
