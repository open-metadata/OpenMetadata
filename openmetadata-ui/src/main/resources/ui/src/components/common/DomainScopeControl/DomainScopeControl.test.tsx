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
import { DEFAULT_DOMAIN_VALUE } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import { DomainSelectableListProps } from '../DomainSelectableList/DomainSelectableList.interface';
import DomainScopeControl from './DomainScopeControl';

const mockNavigate = jest.fn();
const mockSwitchActiveDomain = jest.fn();
const mockUpdateActiveDomain = jest.fn();
const mockDomainSelectableList = jest.fn();

const complianceDomain = {
  id: 'domain-1',
  name: 'Compliance',
  displayName: 'Compliance',
  fullyQualifiedName: 'Compliance',
  type: 'domain',
} as EntityReference;

const demoDomain = {
  id: 'domain-2',
  name: 'demo',
  displayName: 'demo',
  fullyQualifiedName: 'demo',
  type: 'domain',
} as EntityReference;

let storeState = {
  activeDomain: complianceDomain.fullyQualifiedName,
  activeDomainEntityRef: complianceDomain,
  updateActiveDomain: mockUpdateActiveDomain,
  userDomains: [] as EntityReference[],
  isDomainRestricted: false,
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useSwitchActiveDomain', () => ({
  useSwitchActiveDomain: () => mockSwitchActiveDomain,
}));

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => storeState,
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getDomainDisplayName: (ref?: EntityReference, active?: string) =>
    ref?.displayName ?? active,
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  ChevronDown: () => <div data-testid="chevron-down" />,
  Globe01: () => <div data-testid="domain-icon" />,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ButtonUtility: ({
    icon: Icon,
    isDisabled,
    tooltip,
    tooltipPlacement: _tooltipPlacement,
    color: _color,
    size: _size,
    ...props
  }: {
    icon: React.ComponentType;
    isDisabled?: boolean;
    tooltip?: string;
    tooltipPlacement?: string;
    color?: string;
    size?: string;
  }) => (
    <button {...props} disabled={isDisabled} title={tooltip} type="button">
      <Icon />
    </button>
  ),
  Tooltip: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => <div title={title}>{children}</div>,
}));

jest.mock('../../AppRouter/withSuspenseFallback', () => ({
  __esModule: true,
  default: (Component: React.ComponentType<DomainSelectableListProps>) =>
    Component,
}));

jest.mock('../DomainSelectableList/DomainSelectableList.component', () => ({
  __esModule: true,
  default: (props: DomainSelectableListProps) => {
    mockDomainSelectableList(props);

    return (
      <div data-testid="domain-selectable-list">
        {props.children}
        <button
          data-testid="mock-pick-domain"
          onClick={() => props.onUpdate(demoDomain)}>
          pick
        </button>
      </div>
    );
  },
}));

// The menu is a `React.lazy` wrapper, so the first render suspends until the
// (mocked) module resolves — await the list before asserting.
const renderControl = async (variant?: 'card' | 'icon' | 'pill') => {
  const utils = render(<DomainScopeControl variant={variant} />);
  await screen.findByTestId('domain-selectable-list');

  return utils;
};

const lastMenuProps = () =>
  mockDomainSelectableList.mock.calls[
    mockDomainSelectableList.mock.calls.length - 1
  ][0] as DomainSelectableListProps;

describe('DomainScopeControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storeState = {
      activeDomain: complianceDomain.fullyQualifiedName,
      activeDomainEntityRef: complianceDomain,
      updateActiveDomain: mockUpdateActiveDomain,
      userDomains: [],
      isDomainRestricted: false,
    };
  });

  it('renders the panel card with caption and the active domain name', async () => {
    await renderControl();

    expect(screen.getByTestId('ask-domain-scope-card')).toBeInTheDocument();
    expect(screen.getByText('label.domain-scope')).toBeInTheDocument();
    expect(screen.getByTestId('ask-domain-scope-name')).toHaveTextContent(
      'Compliance'
    );
  });

  it('shows the active status dot when a domain is scoped', async () => {
    await renderControl();

    expect(screen.getByTestId('ask-domain-scope-dot')).toBeInTheDocument();
  });

  it('hides the status dot when scope is the default (all domains)', async () => {
    storeState = {
      ...storeState,
      activeDomain: DEFAULT_DOMAIN_VALUE,
      activeDomainEntityRef: undefined as unknown as EntityReference,
    };
    await renderControl();

    expect(
      screen.queryByTestId('ask-domain-scope-dot')
    ).not.toBeInTheDocument();
  });

  it('switches and persists the global domain scope on selection', async () => {
    await renderControl();
    fireEvent.click(screen.getByTestId('mock-pick-domain'));

    // Persisting goes through the shared switch, so the server-side list filter follows the pick.
    expect(mockSwitchActiveDomain).toHaveBeenCalledWith(demoDomain);
  });

  it('passes the active domain and unrestricted flags to the menu', async () => {
    await renderControl();

    const props = lastMenuProps();

    expect(props.selectedDomain).toBe(complianceDomain);
    expect(props.showAllDomains).toBe(true);
    expect(props.restrictedDomains).toBeUndefined();
  });

  it('renders a disabled, menu-less affordance for a single-domain user', () => {
    storeState = {
      ...storeState,
      isDomainRestricted: true,
      userDomains: [complianceDomain],
    };
    render(<DomainScopeControl />);

    const card = screen.getByTestId('ask-domain-scope-card');

    expect(card).toHaveAttribute('aria-disabled');
    expect(card.closest('[title]')).toHaveAttribute(
      'title',
      'message.domain-access-restricted'
    );
    expect(mockDomainSelectableList).not.toHaveBeenCalled();
  });

  it('restricts the menu to the user domains when access is restricted', async () => {
    storeState = {
      ...storeState,
      isDomainRestricted: true,
      userDomains: [complianceDomain, demoDomain],
    };
    await renderControl();

    const props = lastMenuProps();

    expect(props.showAllDomains).toBe(false);
    expect(props.restrictedDomains).toEqual([complianceDomain, demoDomain]);
  });

  it('renders the rail variant as an icon-only trigger', async () => {
    await renderControl('icon');

    expect(screen.getByTestId('ask-domain-scope-icon')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ask-domain-scope-card')
    ).not.toBeInTheDocument();
  });

  describe('landing variant', () => {
    it('renders the landing pill, not the AI-sidebar card', async () => {
      await renderControl('pill');

      expect(screen.getByTestId('domain-selector')).toBeInTheDocument();
      expect(
        screen.queryByTestId('ask-domain-scope-card')
      ).not.toBeInTheDocument();
    });

    it('keeps the pill for a single-domain user instead of the card', async () => {
      storeState = {
        ...storeState,
        isDomainRestricted: true,
        userDomains: [complianceDomain],
      };

      await renderControl('pill');

      // The restricted branch must not pre-empt the landing variant.
      expect(screen.getByTestId('domain-selector')).toBeInTheDocument();
      expect(
        screen.queryByTestId('ask-domain-scope-card')
      ).not.toBeInTheDocument();
    });

    it('disables the pill for a single-domain user, who has nothing to switch to', async () => {
      storeState = {
        ...storeState,
        isDomainRestricted: true,
        userDomains: [complianceDomain],
      };

      await renderControl('pill');

      expect(screen.getByTestId('domain-selector')).toBeDisabled();
    });

    it('locks the picker itself, not just the button, for a single-domain user', async () => {
      storeState = {
        ...storeState,
        isDomainRestricted: true,
        userDomains: [complianceDomain],
      };

      await renderControl('pill');

      // A disabled <button> still receives pointerdown, and the trigger opens
      // on capture-phase pointerdown — so the list must be disabled too.
      expect(lastMenuProps().disabled).toBe(true);
      // ...and the picker it would open stays limited to their domains.
      expect(lastMenuProps().restrictedDomains).toEqual([complianceDomain]);
    });

    it('drives aria-expanded from real open state', async () => {
      await renderControl('pill');

      // popoverProps must be wired, or isOpen never changes and the trigger
      // reports "collapsed" even while the menu is open.
      expect(lastMenuProps().popoverProps?.onOpenChange).toBeDefined();
      expect(screen.getByTestId('domain-selector')).toHaveAttribute(
        'aria-expanded',
        'false'
      );

      act(() => {
        lastMenuProps().popoverProps?.onOpenChange?.(true);
      });

      expect(screen.getByTestId('domain-selector')).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });

    it('exposes the pill as a real button with menu semantics', async () => {
      await renderControl('pill');
      const trigger = screen.getByTestId('domain-selector');

      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
      expect(trigger).toHaveAttribute('aria-expanded');
    });
  });
});
