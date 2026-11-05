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
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import MoreNavPopover from './MoreNavPopover';
import { MainNavItem } from './navConfig';

const mockNavigate = jest.fn();

// The active key comes from the app-module registry (empty under test), so the
// hook is stubbed and driven per case.
let mockActiveKey: string | null = null;

jest.mock('./useActiveNavKey', () => ({
  useActiveNavKey: () => mockActiveKey,
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// `useActiveNavKey` derives its result from real `aiModules` prefixes
// (which don't map 1:1 to module ids, e.g. governance's prefix is
// `/glossary`) — stub with predictable id-as-path modules so the
// "active trigger" test below has a deterministic route to assert on.
const StubIcon = () => <svg data-testid="stub-icon" />;

const buildItems = (): MainNavItem[] => [
  {
    key: 'observability',
    icon: StubIcon,
    labelKey: 'label.observability',
    action: { kind: 'navigate', path: '/observability' },
  },
  {
    key: 'governance',
    icon: StubIcon,
    labelKey: 'label.governance',
    action: { kind: 'navigate', path: '/governance' },
  },
];

const renderAt = (ui: ReactElement, path = '/conversations') =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe('MoreNavPopover', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockActiveKey = null;
  });

  it('renders nothing when there are no overflow items', () => {
    const { container } = renderAt(
      <MoreNavPopover items={[]} variant="panel" />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders a panel trigger with the More label', () => {
    renderAt(<MoreNavPopover items={buildItems()} variant="panel" />);

    expect(screen.getByTestId('ask-nav-item-more')).toHaveTextContent(
      'label.more'
    );
  });

  it('renders a rail icon-button trigger', () => {
    renderAt(<MoreNavPopover items={buildItems()} variant="rail" />);

    expect(screen.getByTestId('ask-rail-item-more')).toBeInTheDocument();
  });

  // Interaction is exercised against the real core-components popover (no
  // mocks) via the rail variant, whose trigger nests the pressable inside a
  // Tooltip — this confirms react-aria forwards the PopoverTrigger context
  // through the Tooltip wrapper down to the actual button and anchors/opens.
  it('opens the popover and lists the overflow items on rail trigger click', () => {
    renderAt(<MoreNavPopover items={buildItems()} variant="rail" />);

    expect(
      screen.queryByTestId('ask-more-nav-popover')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ask-rail-item-more'));

    expect(screen.getByTestId('ask-more-nav-popover')).toBeInTheDocument();
    expect(screen.getByText('label.observability')).toBeInTheDocument();
    expect(screen.getByText('label.governance')).toBeInTheDocument();
  });

  it('toggles the popover open and closed from the panel trigger', () => {
    renderAt(<MoreNavPopover items={buildItems()} variant="panel" />);
    const trigger = screen.getByTestId('ask-nav-item-more');

    expect(
      screen.queryByTestId('ask-more-nav-popover')
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(screen.getByTestId('ask-more-nav-popover')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', 'ask-more-nav-popover');

    fireEvent.click(trigger);

    expect(
      screen.queryByTestId('ask-more-nav-popover')
    ).not.toBeInTheDocument();
  });

  it('renders overflow items as anchors and closes the popover on click', () => {
    renderAt(<MoreNavPopover items={buildItems()} variant="rail" />);

    fireEvent.click(screen.getByTestId('ask-rail-item-more'));

    const link = screen.getByText('label.governance').closest('a');

    expect(link).toHaveAttribute('href', '/governance');

    fireEvent.click(link as HTMLAnchorElement);

    expect(
      screen.queryByTestId('ask-more-nav-popover')
    ).not.toBeInTheDocument();
  });

  it('marks the trigger active when an overflow item is the active nav key', () => {
    mockActiveKey = 'governance';

    renderAt(
      <MoreNavPopover items={buildItems()} variant="panel" />,
      '/governance'
    );

    expect(screen.getByTestId('ask-nav-item-more')).toHaveClass(
      'ask-nav-item--active'
    );
  });
});
