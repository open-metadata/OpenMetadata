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
import { fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import searchClassBase from '../../../utils/SearchClassBase';
import ExploreSearchCard from './ExploreSearchCard';
import { ExploreSearchCardProps } from './ExploreSearchCard.interface';

const mockPrefetchTable = jest.fn();
const mockPrefetchDashboard = jest.fn();
const mockPrefetchPipeline = jest.fn();
const mockPrefetchTopic = jest.fn();

jest.mock('../../../rest/queries/tableQuery', () => ({
  prefetchTable: (...args: unknown[]) => mockPrefetchTable(...args),
}));

jest.mock('../../../rest/queries/dashboardQuery', () => ({
  prefetchDashboard: (...args: unknown[]) => mockPrefetchDashboard(...args),
}));

jest.mock('../../../rest/queries/pipelineQuery', () => ({
  prefetchPipeline: (...args: unknown[]) => mockPrefetchPipeline(...args),
}));

jest.mock('../../../rest/queries/topicQuery', () => ({
  prefetchTopic: (...args: unknown[]) => mockPrefetchTopic(...args),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getDomainPath: jest.fn().mockReturnValue('/mock-domain'),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn(
    (entity?: { displayName?: string; name?: string }) =>
      entity?.displayName ?? entity?.name ?? ''
  ),
}));
jest.mock('../../../utils/EntitySearchUtils', () => ({
  highlightSearchText: jest.fn().mockReturnValue(''),
  highlightEntityNameAndDescription: jest.fn((source, highlight) => {
    if (!highlight) {
      return source;
    }

    return {
      ...source,
      displayName:
        highlight?.displayName?.join(' ') ||
        highlight?.name?.join(' ') ||
        source.displayName ||
        source.name,
      description: highlight?.description?.[0] || source.description,
    };
  }),
}));

jest.mock('../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getListOfEntitiesWithoutDomain: jest.fn().mockImplementation(() => []),
    getListOfEntitiesWithoutTier: jest.fn().mockReturnValue([]),
    getServiceIcon: jest.fn().mockReturnValue(<span>service-icon</span>),
    getEntityBreadcrumbs: jest.fn().mockReturnValue([]),
    getEntityIcon: jest
      .fn()
      .mockImplementation((entityType: string) => (
        <span>{`${entityType}-icon`}</span>
      )),
    getEntityLink: jest.fn().mockReturnValue('/entity/test'),
    getEntityName: jest.fn().mockReturnValue('Test Domain'),
    getSearchEntityLinkTarget: jest.fn().mockReturnValue('_self'),
  },
}));

jest.mock('../../common/DomainDisplay/DomainDisplay.component', () => ({
  DomainDisplay: jest
    .fn()
    .mockReturnValue(<div data-testid="domain-display">Domain Display</div>),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Breadcrumbs: jest.fn(({ items = [] }) => (
    <nav data-testid="breadcrumbs">
      {items.map(
        (item: {
          id: string;
          label: string;
          href: string;
          icon?: (props: { className?: string }) => ReactElement;
        }) => {
          const Icon = item.icon;

          return (
            <a data-testid="breadcrumb-item" href={item.href} key={item.id}>
              {Icon && (
                <span data-testid="breadcrumb-icon">
                  <Icon className="breadcrumb-icon" />
                </span>
              )}
              {item.label}
            </a>
          );
        }
      )}
    </nav>
  )),
  Card: jest.fn(({ children, ...props }) => <div {...props}>{children}</div>),
}));

const baseSource: ExploreSearchCardProps['source'] = {
  id: 'base-1',
  fullyQualifiedName: 'test.fqn',
  name: 'test',
  entityType: 'table',
  service: {
    name: 'svc',
    type: 'databaseService',
  },
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
  renderWithQueryClient(
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

  it('renders  DomainDisplay component', () => {
    renderCard({
      domains: [{ id: '1', fullyQualifiedName: 'domain.test', type: 'domain' }],
    });

    expect(screen.getByTestId('domain-display')).toBeInTheDocument();
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
});

describe('ExploreSearchCard - Card container', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('always carries the base explore-search-card class', () => {
    renderCard({ fullyQualifiedName: 'svc.db.schema.users' });

    expect(
      screen.getByTestId('table-data-card_svc.db.schema.users')
    ).toHaveClass('explore-search-card');
  });

  it('applies the selected highlight-card class passed by SearchedData', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          className="highlight-card"
          source={{ ...baseSource, fullyQualifiedName: 'svc.db.schema.users' }}
        />
      </MemoryRouter>
    );

    const card = screen.getByTestId('table-data-card_svc.db.schema.users');

    expect(card).toHaveClass('explore-search-card');
    expect(card).toHaveClass('highlight-card');
  });
});

describe('ExploreSearchCard - Type badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the entity type as the first metadata badge', () => {
    renderCard({ entityType: 'pipeline' });

    expect(screen.getByTestId('Type')).toHaveTextContent('PIPELINE');
  });

  it('renders the column data type as the first metadata badge for column cards', () => {
    renderCard({
      entityType: 'tableColumn',
      dataType: 'STRING',
      dataTypeDisplay: 'STRING',
    });

    expect(screen.getByTestId('Type')).toHaveTextContent('STRING');
  });

  it('preserves complex column data type syntax in uppercase', () => {
    const complexDataType =
      'struct<street_name:varchar(24),zipcode:int,city:varchar(100),country:struct<country_code:int, name:varchar(100)>>';

    renderCard({
      entityType: 'tableColumn',
      dataType: 'STRUCT',
      dataTypeDisplay: complexDataType,
    });

    expect(screen.getByTestId('Type')).toHaveTextContent(
      complexDataType.toUpperCase()
    );
    expect(screen.getByText(complexDataType.toUpperCase())).toHaveClass(
      'tw:max-w-full',
      'tw:min-h-5.5',
      'tw:break-words',
      'tw:whitespace-normal'
    );
  });
});

describe('ExploreSearchCard - Highlight functionality', () => {
  const { highlightEntityNameAndDescription } = jest.requireMock(
    '../../../utils/EntitySearchUtils'
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses base source when highlight is not provided', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          source={{
            ...baseSource,
            name: 'test-table',
            description: 'Base description',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).not.toHaveBeenCalled();
  });

  it('applies highlight to displayName when highlight.displayName is provided', () => {
    const highlightData = {
      displayName: ['<span class="highlight">Test</span> Table'],
    };

    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={highlightData}
          source={{
            ...baseSource,
            name: 'test-table',
            displayName: 'Test Table',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-table',
        displayName: 'Test Table',
      }),
      highlightData
    );
  });

  it('applies highlight to name when highlight.name is provided and displayName is absent', () => {
    const highlightData = {
      name: ['<span class="highlight">test</span>-table'],
    };

    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={highlightData}
          source={{
            ...baseSource,
            name: 'test-table',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-table',
      }),
      highlightData
    );
  });

  it('applies highlight to description when highlight.description is provided', () => {
    const highlightData = {
      description: [
        'This is a <span class="highlight">test</span> description',
      ],
    };

    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={highlightData}
          source={{
            ...baseSource,
            description: 'This is a test description',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'This is a test description',
      }),
      highlightData
    );
  });

  it('prioritizes displayName over name in highlight', () => {
    const highlightData = {
      displayName: ['<span class="highlight">Display</span> Name'],
      name: ['<span class="highlight">name</span>'],
    };

    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={highlightData}
          source={{
            ...baseSource,
            name: 'name',
            displayName: 'Display Name',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'name',
        displayName: 'Display Name',
      }),
      highlightData
    );
  });

  it('applies all highlights when name, displayName, and description are all present', () => {
    const highlightData = {
      displayName: ['<span class="highlight">Highlighted</span> Display'],
      name: ['<span class="highlight">highlighted</span>-name'],
      description: [
        '<span class="highlight">Highlighted</span> description text',
      ],
    };

    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={highlightData}
          source={{
            ...baseSource,
            name: 'highlighted-name',
            displayName: 'Highlighted Display',
            description: 'Highlighted description text',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'highlighted-name',
        displayName: 'Highlighted Display',
        description: 'Highlighted description text',
      }),
      highlightData
    );
  });

  it('handles empty highlight object', () => {
    const highlightData = {};

    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={highlightData}
          source={{
            ...baseSource,
            name: 'test-table',
            description: 'Test description',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test-table',
        description: 'Test description',
      }),
      highlightData
    );
  });

  it('memoizes source correctly when highlight changes', () => {
    const { rerender } = renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={{
            name: ['<span class="highlight">first</span>'],
          }}
          source={{
            ...baseSource,
            name: 'first',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          highlight={{
            name: ['<span class="highlight">second</span>'],
          }}
          source={{
            ...baseSource,
            name: 'second',
          }}
        />
      </MemoryRouter>
    );

    expect(highlightEntityNameAndDescription).toHaveBeenCalledTimes(2);
  });
});

describe('ExploreSearchCard - Prefetch on hover', () => {
  beforeEach(() => {
    mockPrefetchTable.mockClear();
    mockPrefetchDashboard.mockClear();
    mockPrefetchPipeline.mockClear();
    mockPrefetchTopic.mockClear();
  });

  it.each<{ entityType: string; mockFn: jest.Mock; fqn: string }>([
    {
      entityType: 'table',
      mockFn: mockPrefetchTable,
      fqn: 'svc.db.schema.users',
    },
    {
      entityType: 'dashboard',
      mockFn: mockPrefetchDashboard,
      fqn: 'svc.dash.daily-active',
    },
    {
      entityType: 'pipeline',
      mockFn: mockPrefetchPipeline,
      fqn: 'svc.pipe.etl',
    },
    {
      entityType: 'topic',
      mockFn: mockPrefetchTopic,
      fqn: 'svc.topic.events',
    },
  ])(
    'prefetches details when hovering a $entityType card',
    ({ entityType, mockFn, fqn }) => {
      renderWithQueryClient(
        <MemoryRouter>
          <ExploreSearchCard
            {...defaultProps}
            source={{
              ...baseSource,
              entityType,
              fullyQualifiedName: fqn,
            }}
          />
        </MemoryRouter>
      );

      fireEvent.mouseEnter(screen.getByTestId('entity-link'));

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith(expect.anything(), fqn);
    }
  );

  it('also prefetches on keyboard focus for accessibility', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          source={{
            ...baseSource,
            entityType: 'table',
            fullyQualifiedName: 'svc.db.schema.users',
          }}
        />
      </MemoryRouter>
    );

    fireEvent.focus(screen.getByTestId('entity-link'));

    expect(mockPrefetchTable).toHaveBeenCalledTimes(1);
  });

  it('does not prefetch when entityType has no useQuery integration yet', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          source={{
            ...baseSource,
            entityType: 'mlmodel',
            fullyQualifiedName: 'svc.ml.churn-v1',
          }}
        />
      </MemoryRouter>
    );

    fireEvent.mouseEnter(screen.getByTestId('entity-link'));

    expect(mockPrefetchTable).not.toHaveBeenCalled();
    expect(mockPrefetchDashboard).not.toHaveBeenCalled();
    expect(mockPrefetchPipeline).not.toHaveBeenCalled();
    expect(mockPrefetchTopic).not.toHaveBeenCalled();
  });
});

describe('ExploreSearchCard - Breadcrumbs', () => {
  const { Breadcrumbs: MockBreadcrumbs } = jest.requireMock(
    '@openmetadata/ui-core-components'
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([]);
  });

  it('hides the breadcrumb row when hideBreadcrumbs is true', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          hideBreadcrumbs
          source={baseSource}
        />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('breadcrumbs')).not.toBeInTheDocument();
  });

  it('renders the Breadcrumbs component when hideBreadcrumbs is false (default)', () => {
    renderCard({});

    expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument();
  });

  it('collapses the middle crumbs by passing maxItems={2} to Breadcrumbs', () => {
    renderCard({});

    expect(MockBreadcrumbs).toHaveBeenCalledWith(
      expect.objectContaining({
        maxItems: 2,
      }),
      expect.anything()
    );
    expect(MockBreadcrumbs).not.toHaveBeenCalledWith(
      expect.objectContaining({ autoCollapse: true }),
      expect.anything()
    );
  });

  it('maps breadcrumb items with id=name and href from a string url', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      {
        name: 'my-service',
        displayName: 'My Service',
        url: '/service/my-service',
      },
    ]);

    renderCard({});

    expect(MockBreadcrumbs).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'my-service',
            href: '/service/my-service',
          }),
        ]),
      }),
      expect.anything()
    );
  });

  it('extracts href from url.pathname when url is an object', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      {
        name: 'my-db',
        displayName: 'My DB',
        url: { pathname: '/database/my-db', search: '?tab=schema' },
      },
    ]);

    renderCard({});

    expect(MockBreadcrumbs).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 'my-db',
            href: '/database/my-db',
          }),
        ]),
      }),
      expect.anything()
    );
  });

  it('renders service icon in the DOM when breadcrumbs are non-empty', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      { name: 'svc', url: '/svc' },
    ]);

    renderCard({});

    expect(screen.getByText('service-icon')).toBeInTheDocument();
  });

  it('passes icons for breadcrumb items from the source hierarchy', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      { name: 'svc', url: '/settings/services/databaseServices/svc' },
      { name: 'db', url: '/database/db' },
      { name: 'schema', url: '/databaseSchema/schema' },
    ]);

    renderCard({ entityType: 'table' });

    expect(screen.getAllByTestId('breadcrumb-icon')).toHaveLength(3);
    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
    expect(screen.getByText('databaseSchema-icon')).toBeInTheDocument();
  });

  it('keeps the service icon when the breadcrumb label differs from the source service name', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      {
        name: 'service-breadcrumb',
        displayName: 'Service Breadcrumb',
        url: '/settings/services/databaseServices/service-breadcrumb',
      },
      { name: 'db', url: '/database/db' },
    ]);

    renderCard({
      service: {
        displayName: 'Source Service',
        name: 'source-service',
        type: 'databaseService',
      },
    });

    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
  });

  it('keeps the service icon when the source service reference is missing', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      { name: 'svc', url: '/settings/services/databaseServices/svc' },
      { name: 'db', url: '/database/db' },
    ]);

    renderCard({ service: undefined });

    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
  });

  it('does not shift icons when database schema breadcrumbs include a category crumb', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      { name: 'Database Services', url: '/settings/services/databaseServices' },
      { name: 'svc', url: '/settings/services/databaseServices/svc' },
      { name: 'db', url: '/database/db' },
      { name: 'schema', url: '/databaseSchema/schema' },
    ]);

    renderCard({ entityType: 'databaseSchema' });

    const items = MockBreadcrumbs.mock.calls.at(-1)?.[0].items;

    expect(items[0].icon).toBeUndefined();
    expect(screen.getAllByTestId('breadcrumb-icon')).toHaveLength(3);
    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
    expect(screen.getByText('databaseSchema-icon')).toBeInTheDocument();
  });

  it('keeps schema icon mapping when the database breadcrumb is absent', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([
      { name: 'svc', url: '/settings/services/databaseServices/svc' },
      { name: 'schema', url: '/databaseSchema/schema' },
    ]);

    renderCard({ entityType: 'table' });

    expect(screen.getAllByTestId('breadcrumb-icon')).toHaveLength(2);
    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('databaseSchema-icon')).toBeInTheDocument();
    expect(screen.queryByText('database-icon')).not.toBeInTheDocument();
  });

  it('does not render service icon when breadcrumbs list is empty', () => {
    (searchClassBase.getEntityBreadcrumbs as jest.Mock).mockReturnValue([]);

    renderCard({});

    expect(screen.queryByText('service-icon')).not.toBeInTheDocument();
  });

  it('renders score with 4-decimal precision when score prop is provided', () => {
    renderWithQueryClient(
      <MemoryRouter>
        <ExploreSearchCard
          {...defaultProps}
          score={0.9876}
          source={baseSource}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('0.9876')).toBeInTheDocument();
  });

  it('does not render a score value when score prop is absent', () => {
    renderCard({});

    expect(screen.queryByText('0.9876')).not.toBeInTheDocument();
  });
});
