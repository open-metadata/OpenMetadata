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
import { ReactNode } from 'react';

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
  const TabsItem = ({ id, label }: { id: string; label?: ReactNode }) => (
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
    PageLayout: {
      PageHeader: ({
        footer,
        icon,
        title,
        variant,
      }: {
        footer?: ReactNode;
        icon?: ReactNode;
        title?: ReactNode;
        variant?: string;
      }) => (
        <div data-testid="inbox-header" data-variant={variant}>
          {icon}
          {title}
          {footer}
        </div>
      ),
    },
    Tabs,
  };
});

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

const content = <div data-testid="inbox-content" />;

const renderShell = () => render(<InboxPage content={content} />);

describe('InboxPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPathname = '/inbox';
    mockIsAiMode = true;
  });

  it('renders the inbox body', () => {
    renderShell();

    expect(screen.getByTestId('inbox-content')).toBeInTheDocument();
  });

  // Activity and Triage belong to the body, which owns their counts; My Data is
  // a separate surface, so the shell contributes no tabs at all.
  it('contributes no tab bar of its own', () => {
    renderShell();

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tab-my-data')).not.toBeInTheDocument();
  });

  it('renders the placeholder when the consumer contributes no content', () => {
    render(<InboxPage />);

    expect(screen.getByTestId('inbox-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('inbox-content')).not.toBeInTheDocument();
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
