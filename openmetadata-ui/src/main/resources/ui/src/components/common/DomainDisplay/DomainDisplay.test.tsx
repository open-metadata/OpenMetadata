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
import { render, screen, waitFor } from '@testing-library/react';
import { ComponentProps } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityReference } from '../../../generated/entity/type';
import { getDomainByName } from '../../../rest/domainAPI';
import { clearDomainStyleCache } from '../../../utils/DomainStyleUtils';
import { DomainDisplay } from './DomainDisplay.component';

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.name || 'Unknown'),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest
    .fn()
    .mockImplementation((fqn: string) => `/domain/${fqn}`),
}));

jest.mock('../../../rest/domainAPI', () => ({
  getDomainByName: jest.fn(),
}));

jest.mock('../../../assets/svg/ic-domain.svg', () => ({
  ReactComponent: ({ color }: { color?: string }) => (
    <div data-color={color} data-testid="domain-icon">
      Domain Icon
    </div>
  ),
}));

const mockGetDomainByName = getDomainByName as jest.MockedFunction<
  typeof getDomainByName
>;

const mockDomain1: EntityReference = {
  id: 'domain-1',
  fullyQualifiedName: 'domain.one',
  name: 'Domain One',
  type: 'domain',
  style: {
    color: '#dc2626',
  },
} as EntityReference;

const mockDomain2: EntityReference = {
  id: 'domain-2',
  fullyQualifiedName: 'domain.two',
  name: 'Domain Two',
  type: 'domain',
  style: {
    color: '#2563eb',
  },
} as EntityReference;

const mockDomain3: EntityReference = {
  id: 'domain-3',
  fullyQualifiedName: 'domain.three',
  name: 'Domain Three',
  type: 'domain',
  style: {
    color: '#16a34a',
  },
} as EntityReference;

type DomainDisplayTestProps = Omit<ComponentProps<typeof DomainDisplay>, 'domains'> & {
  domains?: EntityReference[] | null;
};

const renderDomainDisplay = (
  props: DomainDisplayTestProps
) =>
  render(
    <MemoryRouter>
      <DomainDisplay {...(props as ComponentProps<typeof DomainDisplay>)} />
    </MemoryRouter>
  );

describe('DomainDisplay Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDomainStyleCache();
    mockGetDomainByName.mockResolvedValue(
      {} as Awaited<ReturnType<typeof getDomainByName>>
    );
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
    renderDomainDisplay({ domains: [mockDomain1] });

    expect(screen.getByTestId('domain-icon')).toBeInTheDocument();
    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/domain/domain.one'
    );
  });

  it('should render single domain without icon when showIcon is false', () => {
    renderDomainDisplay({ domains: [mockDomain1], showIcon: false });

    expect(screen.queryByTestId('domain-icon')).not.toBeInTheDocument();
    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/domain/domain.one'
    );
  });

  it('should render multiple domains with dropdown by default', () => {
    renderDomainDisplay({
      domains: [mockDomain1, mockDomain2, mockDomain3],
    });

    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByTestId('domain-count-button')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('Domain Two')).not.toBeInTheDocument();
    expect(screen.queryByText('Domain Three')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('domain-icon')).toHaveLength(1);
  });

  it('should render single domain normally', () => {
    renderDomainDisplay({
      domains: [mockDomain1],
    });

    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.queryByTestId('domain-count-button')).not.toBeInTheDocument();
    expect(screen.queryByText(', ')).not.toBeInTheDocument();
  });

  it('should render correct links for all domains', () => {
    renderDomainDisplay({ domains: [mockDomain1, mockDomain2] });

    expect(screen.getByRole('link', { name: 'Domain One' })).toHaveAttribute(
      'href',
      '/domain/domain.one'
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
    expect(link).toHaveAttribute('href', '/domain/domain.one');
  });

  it('should have proper test IDs for testing', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    expect(screen.getByTestId('domain-icon')).toBeInTheDocument();
    expect(screen.getByTestId('domain-link')).toBeInTheDocument();
  });

  it('should style domain links correctly', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    const link = screen.getByRole('link');

    expect(link).toHaveClass('no-underline');
  });

  it('should style domain text correctly', () => {
    renderDomainDisplay({ domains: [mockDomain1] });

    const domainText = screen.getByText('Domain One');

    expect(domainText).toHaveClass('text-sm', 'text-primary');
  });

  it('should not render icon when showIcon is false', () => {
    renderDomainDisplay({ domains: [mockDomain1], showIcon: false });

    expect(screen.queryByTestId('domain-icon')).not.toBeInTheDocument();
  });

  it('should render only one icon for multiple domains', () => {
    renderDomainDisplay({ domains: [mockDomain1, mockDomain2, mockDomain3] });

    const domainIcons = screen.getAllByTestId('domain-icon');

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

    expect(screen.getByText('Domain One')).toBeInTheDocument();
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

    expect(screen.getByText('Domain One')).toBeInTheDocument();
    expect(screen.getByTestId('domain-count-button')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.queryByText('Domain Two')).not.toBeInTheDocument();
  });

  it('should fetch the domain style and apply the matching icon color', async () => {
    const unresolvedDomain = {
      id: 'domain-unresolved',
      fullyQualifiedName: 'domain.one',
      name: 'Domain One',
      type: 'domain',
    } as EntityReference;

    mockGetDomainByName.mockResolvedValue(
      {
        style: {
          color: '#0891b2',
        },
      } as Awaited<ReturnType<typeof getDomainByName>>
    );

    renderDomainDisplay({ domains: [unresolvedDomain] });

    await waitFor(() =>
      expect(mockGetDomainByName).toHaveBeenCalledWith('domain.one', {
        fields: 'style',
      })
    );

    await waitFor(() =>
      expect(screen.getByTestId('domain-icon')).toHaveAttribute(
        'data-color',
        '#0891b2'
      )
    );
  });
});
