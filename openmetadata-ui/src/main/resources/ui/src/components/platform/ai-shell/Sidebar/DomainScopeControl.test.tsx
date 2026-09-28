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
import { DEFAULT_DOMAIN_VALUE } from '../../../../constants/constants';
import { EntityReference } from '../../../../generated/entity/type';
import { DomainSelectableListProps } from '../../../common/DomainSelectableList/DomainSelectableList.interface';
import DomainScopeControl from './DomainScopeControl';

const mockNavigate = jest.fn();
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

jest.mock('../../../../hooks/useDomainStore', () => ({
  useDomainStore: () => storeState,
}));

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getDomainDisplayName: (ref?: EntityReference, active?: string) =>
    ref?.displayName ?? active,
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  ChevronDown: () => <div data-testid="chevron-down" />,
  Domain: () => <div data-testid="domain-icon" />,
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

jest.mock('../../../AppRouter/withSuspenseFallback', () => ({
  __esModule: true,
  default: (Component: React.ComponentType<DomainSelectableListProps>) =>
    Component,
}));

jest.mock(
  '../../../common/DomainSelectableList/DomainSelectableList.component',
  () => ({
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
  })
);

// The menu is a `React.lazy` wrapper, so the first render suspends until the
// (mocked) module resolves — await the list before asserting.
const renderControl = async (variant?: 'panel' | 'rail') => {
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

  it('updates the global domain scope and reloads on selection', async () => {
    await renderControl();
    fireEvent.click(screen.getByTestId('mock-pick-domain'));

    expect(mockUpdateActiveDomain).toHaveBeenCalledWith(demoDomain);
    expect(mockNavigate).toHaveBeenCalledWith(0);
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
    await renderControl('rail');

    expect(screen.getByTestId('ask-domain-scope-rail')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ask-domain-scope-card')
    ).not.toBeInTheDocument();
  });

  it('opens the menu with an upward placement for the panel card', async () => {
    await renderControl();

    expect(lastMenuProps().popoverProps?.placement).toBe('topRight');
  });
});
