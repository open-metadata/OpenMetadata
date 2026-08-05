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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityReference } from '../../../generated/entity/type';
import { DomainDisplay } from './DomainDisplay.component';

const DOMAIN_ICON = 'domain-icon' as const;
const DOMAIN_ONE = 'Domain One' as const;
const DOMAIN_TWO = 'Domain Two' as const;
const DOMAIN_DOMAIN_ONE = '/domain/domain.one' as const;
const DOMAIN_COUNT_BUTTON = 'domain-count-button' as const;

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.name || 'Unknown'),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest
    .fn()
    .mockImplementation((fqn: string) => `/domain/${fqn}`),
}));

jest.mock('../../../assets/svg/ic-domain.svg', () => ({
  ReactComponent: () => <div data-testid="domain-icon">Domain Icon</div>,
}));

const mockDomain1: EntityReference = {
  id: 'domain-1',
  fullyQualifiedName: 'domain.one',
  name: DOMAIN_ONE,
  type: 'domain',
};

const mockDomain2: EntityReference = {
  id: 'domain-2',
  fullyQualifiedName: 'domain.two',
  name: DOMAIN_TWO,
  type: 'domain',
};

const mockDomain3: EntityReference = {
  id: 'domain-3',
  fullyQualifiedName: 'domain.three',
  name: 'Domain Three',
  type: 'domain',
};

const renderDomainDisplay = (props: ComponentProps<typeof DomainDisplay>) =>
  render(
    <MemoryRouter>
      <DomainDisplay {...props} />
    </MemoryRouter>
  );

describe('DomainDisplay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render nothing when domains array is empty', () => {
    const { container } = renderDomainDisplay({ domains: [] });

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when domains is undefined', () => {
    const { container } = renderDomainDisplay({ domains: undefined });

    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when domains is null', () => {
    const { container } = renderDomainDisplay({ domains: null });

    expect(container.firstChild).toBeNull();
  });

  it('should render single domain with icon by default', () => {
    const { container } = renderDomainDisplay({ domains: [mockDomain1] });

    expect(screen.getByTestId(DOMAIN_ICON)).toBeInTheDocument();
    expect(screen.getByText(DOMAIN_ONE)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('gap-1');
    expect(screen.getByRole('link')).toHaveAttribute('href', DOMAIN_DOMAIN_ONE);
  });

  it('should render single domain without icon when showIcon is false', () => {
    renderDomainDisplay({ domains: [mockDomain1], showIcon: false });

    expect(screen.queryByTestId(DOMAIN_ICON)).not.toBeInTheDocument();
    expect(screen.getByText(DOMAIN_ONE)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', DOMAIN_DOMAIN_ONE);
  });

  it('should render multiple domains with dropdown by default', () => {
    renderDomainDisplay({
      domains: [mockDomain1, mockDomain2, mockDomain3],
    });

    expect(screen.getByText(DOMAIN_ONE)).toBeInTheDocument();
    expect(screen.getByTestId(DOMAIN_COUNT_BUTTON)).toHaveClass(
      'flex-shrink-0'
    );
    expect(screen.getByText('+2')).toHaveClass('domain-count-label');
    expect(screen.getByText('+2')).not.toHaveClass('ant-typography');
    expect(screen.queryByText(DOMAIN_TWO)).not.toBeInTheDocument();
    expect(screen.queryByText('Domain Three')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(DOMAIN_ICON)).toHaveLength(1);
  });

  it('should render single domain normally', () => {
    renderDomainDisplay({
      domains: [mockDomain1],
    });

    expect(screen.getByText(DOMAIN_ONE)).toBeInTheDocument();
    expect(screen.queryByTestId(DOMAIN_COUNT_BUTTON)).not.toBeInTheDocument();
    expect(screen.queryByText(', ')).not.toBeInTheDocument();
  });

  it('should render correct links for all domains', () => {
    renderDomainDisplay({ domains: [mockDomain1, mockDomain2] });

    expect(screen.getByRole('link', { name: DOMAIN_ONE })).toHaveAttribute(
      'href',
      DOMAIN_DOMAIN_ONE
    );
  });

  it('should handle domain with missing fullyQualifiedName', () => {
    const domainWithoutFQN = {
      ...mockDomain1,
      fullyQualifiedName: undefined,
    };

    renderDomainDisplay({ domains: [domainWithoutFQN] });

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/domain/undefined'
    );
  });

  it('should handle domain with missing name', () => {
    const domainWithoutName = {
      ...mockDomain1,
      name: undefined,
    };

    renderDomainDisplay({ domains: [domainWithoutName] });

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should have proper link accessibility', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    const link = screen.getByRole('link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', DOMAIN_DOMAIN_ONE);
  });

  it('should have proper test IDs for testing', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    expect(screen.getByTestId(DOMAIN_ICON)).toBeInTheDocument();
    expect(screen.getByTestId('domain-link')).toBeInTheDocument();
  });

  it('should style domain links correctly', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    const link = screen.getByRole('link');

    expect(link).toHaveClass('no-underline');
  });

  it('should style domain text correctly', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    const domainText = screen.getByText(DOMAIN_ONE);

    expect(domainText).toHaveClass('text-sm', 'text-primary');
  });

  it('should not render icon when showIcon is false', () => {
    renderDomainDisplay({ domains: [mockDomain1], showIcon: false });

    expect(screen.queryByTestId(DOMAIN_ICON)).not.toBeInTheDocument();
  });

  it('should render only one icon for multiple domains', () => {
    renderDomainDisplay({ domains: [mockDomain1, mockDomain2, mockDomain3] });

    const domainIcons = screen.getAllByTestId(DOMAIN_ICON);

    expect(domainIcons).toHaveLength(1);
  });

  it('should handle domain with empty name', () => {
    const domainWithEmptyName = {
      ...mockDomain1,
      name: '',
    };

    renderDomainDisplay({ domains: [domainWithEmptyName] });

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should handle domain with empty fullyQualifiedName', () => {
    const domainWithEmptyFQN = {
      ...mockDomain1,
      fullyQualifiedName: '',
    };

    renderDomainDisplay({ domains: [domainWithEmptyFQN] });

    expect(screen.getByRole('link')).toHaveAttribute('href', '/domain/');
  });

  it('should handle mixed domain data (some with names, some without)', () => {
    const domainsWithMixedData = [
      mockDomain1,
      { ...mockDomain2, name: undefined },
      mockDomain3,
    ];

    renderDomainDisplay({ domains: domainsWithMixedData });

    expect(screen.getByText(DOMAIN_ONE)).toBeInTheDocument();
  });

  it('should show correct count in dropdown button', () => {
    const manyDomains = [
      mockDomain1,
      mockDomain2,
      mockDomain3,
      mockDomain1,
      mockDomain2,
    ];

    renderDomainDisplay({
      domains: manyDomains,
    });

    expect(screen.getByText('+4')).toBeInTheDocument();
  });

  it('should always use dropdown behavior for multiple domains', () => {
    renderDomainDisplay({ domains: [mockDomain1, mockDomain2, mockDomain3] });

    expect(screen.getByText(DOMAIN_ONE)).toBeInTheDocument();
    expect(screen.getByTestId(DOMAIN_COUNT_BUTTON)).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText(DOMAIN_TWO)).not.toBeInTheDocument();
  });
});
