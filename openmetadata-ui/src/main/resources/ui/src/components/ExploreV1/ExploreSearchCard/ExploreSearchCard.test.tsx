import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import ExploreSearchCard from './ExploreSearchCard';
import { ExploreSearchCardProps } from './ExploreSearchCard.interface';

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest.fn().mockReturnValue('/mock-domain'),
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Mock Entity'),
  highlightSearchText: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getListOfEntitiesWithoutDomain: jest.fn(),
    getListOfEntitiesWithoutTier: jest.fn().mockReturnValue([]),
    getServiceIcon: jest.fn().mockReturnValue(<span>service-icon</span>),
    getEntityBreadcrumbs: jest.fn().mockReturnValue([]),
    getEntityIcon: jest.fn().mockReturnValue(<span>entity-icon</span>),
    getEntityLink: jest.fn().mockReturnValue('/entity/test'),
    getEntityName: jest.fn().mockReturnValue('Test Domain'),
    getSearchEntityLinkTarget: jest.fn().mockReturnValue('_self'),
  },
}));

const baseSource: ExploreSearchCardProps['source'] = {
  id: 'base-1',
  fullyQualifiedName: 'test.fqn',
  name: 'test',
  entityType: 'table',
  tags: [],
  owners: [],
  domains: [],
};

const defaultProps: Omit<ExploreSearchCardProps, 'source'> = {
  id: '1',
  showEntityIcon: false,
};

const renderCard = (
  sourceOverrides: Partial<ExploreSearchCardProps['source']>
) =>
  render(
    <MemoryRouter>
      <ExploreSearchCard
        {...defaultProps}
        source={{ ...baseSource, ...sourceOverrides }}
      />
    </MemoryRouter>
  );

describe('ExploreSearchCard - Domain section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders single domain with icon and name', () => {
    (getDomainPath as jest.Mock).mockReturnValue('/domain/test');
    (getEntityName as jest.Mock).mockReturnValue('Test Domain');

    renderCard({
      domains: [{ id: '1', fullyQualifiedName: 'domain.test', type: 'domain' }],
    });

    expect(screen.getByTestId('domain-icon')).toBeInTheDocument();
    expect(screen.getByText('Test Domain')).toBeInTheDocument();
  });

  it('renders empty Domain row when no domains exist and entity requires domain', () => {
    (
      searchClassBase.getListOfEntitiesWithoutDomain as jest.Mock
    ).mockReturnValue([]);

    renderCard({ domains: [] });

    expect(screen.queryByTestId('domain-icon')).not.toBeInTheDocument();

    expect(screen.getByTestId('Domain')).toBeInTheDocument();
  });

  it('does not render Domain when entityType is excluded from domains', () => {
    (
      searchClassBase.getListOfEntitiesWithoutDomain as jest.Mock
    ).mockReturnValue(['table']);

    renderCard({ domains: [] });

    expect(screen.queryByText('Domain')).not.toBeInTheDocument();
  });

  it('renders multiple domains with one icon and comma-separated names', () => {
    (getDomainPath as jest.Mock).mockImplementation(
      (fqdn: string) => `/domain/${fqdn}`
    );
    (getEntityName as jest.Mock).mockImplementation(
      (domain: { fullyQualifiedName: string }) => domain.fullyQualifiedName
    );

    renderCard({
      domains: [
        { id: '1', fullyQualifiedName: 'domain.one', type: 'domain' },
        { id: '2', fullyQualifiedName: 'domain.two', type: 'domain' },
        { id: '3', fullyQualifiedName: 'domain.three', type: 'domain' },
      ],
    });

    // Only one icon
    expect(screen.getAllByTestId('domain-icon')).toHaveLength(1);

    // Domain names are rendered
    ['domain.one', 'domain.two', 'domain.three'].forEach((d) =>
      expect(screen.getByText(d)).toBeInTheDocument()
    );

    // Verify comma separation
    const container = screen.getByText('domain.one').closest('div');

    expect(container).toHaveTextContent('domain.one, domain.two, domain.three');
  });
});
