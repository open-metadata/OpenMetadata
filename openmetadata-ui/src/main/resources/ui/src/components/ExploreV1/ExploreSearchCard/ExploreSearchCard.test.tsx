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
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Constraint, DataType } from '../../../generated/entity/data/table';
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
  getUserPath: jest.fn().mockReturnValue('/mock-user'),
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
    getEntityBreadcrumbs: jest.fn().mockReturnValue([]),
    getEntityBreadcrumbItems: jest.fn().mockReturnValue([]),
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
  Typography: jest.fn(
    ({
      children,
      className,
      size,
      weight,
    }: {
      children: ReactNode;
      className?: string;
      size?: string;
      weight?: string;
    }) => (
      <span
        className={[
          className,
          size ? `tw:${size}` : undefined,
          weight
            ? `tw:font-${weight === 'regular' ? 'normal' : weight}`
            : undefined,
        ]
          .filter(Boolean)
          .join(' ')}>
        {children}
      </span>
    )
  ),
}));

const baseSource: ExploreSearchCardProps['source'] = {
  id: 'base-1',
  fullyQualifiedName: 'test.fqn',
  name: 'test',
  entityType: 'table',
  service: {
    id: 'service-id',
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
  sourceOverrides: Partial<ExploreSearchCardProps['source']>,
  propsOverrides: Partial<Omit<ExploreSearchCardProps, 'source'>> = {}
) => {
  const source = {
    ...baseSource,
    ...sourceOverrides,
  } as ExploreSearchCardProps['source'];

  return renderWithQueryClient(
    <MemoryRouter>
      <ExploreSearchCard
        {...defaultProps}
        {...propsOverrides}
        source={source}
      />
    </MemoryRouter>
  );
};

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

  it('renders human-readable ranking explanations from matched query names and score explanation', () => {
    renderCard(
      { fullyQualifiedName: 'svc.db.schema.users' },
      {
        matchedQueries: [
          'ranking:closeName:text',
          'ranking:descriptionContext:text',
        ],
        score: 42.125,
        scoreExplanation: {
          description: 'sum of:',
          value: 42.125,
          details: [
            {
              description: 'avgdl, average length of field',
              value: 509.8754,
            },
            {
              description:
                'ConstantScore(displayName.keyword:provider_address_texas)^30.000002',
              value: 60,
            },
            {
              description:
                'weight(displayName:provider_address_texas in 123) [PerFieldSimilarity], result of:',
              value: 40,
            },
            {
              description: 'max of:',
              value: 2.125,
              details: [
                {
                  description: 'weight(description:texas in 123)',
                  value: 2.125,
                },
              ],
            },
          ],
        },
      }
    );

    expect(screen.getByTestId('ranking-details')).toHaveTextContent(
      'label.ranking-detail-plural'
    );
    expect(screen.getByTestId('ranking-stage-closeName')).toHaveTextContent(
      'label.close-name'
    );
    expect(screen.getByTestId('ranking-stage-closeName')).toHaveTextContent(
      'message.search-ranking-close-name-explanation'
    );
    expect(
      screen.getByTestId('ranking-stage-descriptionContext')
    ).toHaveTextContent('label.description-context');
    expect(screen.getByTestId('ranking-details')).toHaveTextContent(
      'message.search-ranking-signals-explanation'
    );
    expect(screen.getByTestId('ranking-score')).toHaveTextContent(
      'label.score'
    );
    expect(screen.getByTestId('ranking-score-explanation')).toHaveTextContent(
      'label.reason'
    );
    expect(
      screen.getAllByTestId('ranking-score-contributor')[0]
    ).toHaveTextContent('displayName: provider_address_texas');
    expect(
      screen.getByTestId('ranking-score-explanation')
    ).not.toHaveTextContent('avgdl');
  });
});

describe('ExploreSearchCard - Entity type tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render column data type as a metadata tag for column cards', () => {
    renderCard({
      entityType: 'tableColumn',
      dataType: DataType.String,
      dataTypeDisplay: 'STRING',
    });

    expect(screen.queryByTestId('Type')).not.toBeInTheDocument();
    expect(screen.queryByText('STRING')).not.toBeInTheDocument();
  });

  it('does not render NULL constraint as a metadata tag for column cards', () => {
    renderCard({
      entityType: 'tableColumn',
      constraint: Constraint.Null,
    } as Partial<ExploreSearchCardProps['source']>);

    expect(screen.queryByTestId('label.constraint')).not.toBeInTheDocument();
    expect(screen.queryByText(Constraint.Null)).not.toBeInTheDocument();
  });

  it('does not render constraint metadata for column cards', () => {
    renderCard({
      entityType: 'tableColumn',
      constraint: Constraint.PrimaryKey,
    } as Partial<ExploreSearchCardProps['source']>);

    expect(screen.queryByTestId('label.constraint')).not.toBeInTheDocument();
    expect(screen.queryByText(Constraint.PrimaryKey)).not.toBeInTheDocument();
  });
});

describe('ExploreSearchCard - Metadata values', () => {
  it('uses the no-owner CSS hook without component-level typography overrides', () => {
    renderCard({ owners: [] });

    const noOwnerText = screen
      .getByTestId('owner-label')
      .querySelector('.no-owner-text');

    expect(noOwnerText).toHaveClass('no-owner-text', 'text-sm', 'font-medium');
    expect(noOwnerText).not.toHaveClass('tw:text-xs', 'tw:font-normal');
  });

  it('uses the owner name CSS hook without component-level typography overrides', () => {
    renderCard({
      owners: [
        {
          id: 'owner-id',
          name: 'test-owner',
          displayName: 'Test Owner',
          type: 'user',
        },
      ],
    });

    expect(screen.getByText('Test Owner')).toHaveClass(
      'owner-avatar-stack-row-name'
    );
    expect(screen.getByText('Test Owner')).not.toHaveClass(
      'tw:text-xs',
      'tw:font-normal'
    );
  });

  it('uses the owner row CSS hook without component-level gap overrides', () => {
    renderCard({
      owners: [
        {
          id: 'owner-id',
          name: 'test-owner',
          displayName: 'Test Owner',
          type: 'user',
        },
      ],
    });

    const ownerLink = screen.getByRole('link', { name: 'Test Owner' });

    expect(ownerLink).toHaveClass('owner-avatar-stack-row');
    expect(ownerLink).not.toHaveClass('tw:gap-1!');
  });
});

describe('ExploreSearchCard - Entity icon', () => {
  it('renders glossary term custom icon URL when provided', () => {
    renderCard(
      {
        entityType: 'glossaryTerm',
        style: {
          iconURL: '/icon.svg',
        },
      },
      { showEntityIcon: true }
    );

    expect(screen.getByTestId('icon')).toHaveAttribute('src', '/icon.svg');
    expect(screen.queryByText('glossaryTerm-icon')).not.toBeInTheDocument();
  });

  it('does not render generic icon for glossary term without custom icon URL', () => {
    renderCard(
      {
        entityType: 'glossaryTerm',
      },
      { showEntityIcon: true }
    );

    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    expect(screen.queryByText('glossaryTerm-icon')).not.toBeInTheDocument();
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
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([]);
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

  it('auto-collapses breadcrumbs so the trail stays within the card width', () => {
    renderCard({});

    expect(MockBreadcrumbs).toHaveBeenCalledWith(
      expect.objectContaining({
        autoCollapse: true,
      }),
      expect.anything()
    );
    expect(MockBreadcrumbs).not.toHaveBeenCalledWith(
      expect.objectContaining({ maxItems: expect.any(Number) }),
      expect.anything()
    );
  });

  it('passes items from getEntityBreadcrumbItems to Breadcrumbs', () => {
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([
      {
        id: 'my-service',
        label: 'My Service',
        href: '/service/my-service',
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

  it('renders icon in the DOM when breadcrumb item has an icon', () => {
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([
      {
        id: 'svc',
        label: 'svc',
        href: '/svc',
        icon: () => <span>service-icon</span>,
      },
    ]);

    renderCard({});

    expect(screen.getByText('service-icon')).toBeInTheDocument();
  });

  it('passes icons for breadcrumb items from the source hierarchy', () => {
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([
      {
        id: 'svc',
        label: 'svc',
        href: '/settings/services/databaseServices/svc',
        icon: () => <span>service-icon</span>,
      },
      {
        id: 'db',
        label: 'db',
        href: '/database/db',
        icon: () => <span>database-icon</span>,
      },
      {
        id: 'schema',
        label: 'schema',
        href: '/databaseSchema/schema',
        icon: () => <span>databaseSchema-icon</span>,
      },
    ]);

    renderCard({ entityType: 'table' });

    expect(screen.getAllByTestId('breadcrumb-icon')).toHaveLength(3);
    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
    expect(screen.getByText('databaseSchema-icon')).toBeInTheDocument();
  });

  it('renders icons correctly when breadcrumb label differs from source service name', () => {
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([
      {
        id: 'service-breadcrumb',
        label: 'Service Breadcrumb',
        href: '/settings/services/databaseServices/service-breadcrumb',
        icon: () => <span>service-icon</span>,
      },
      {
        id: 'db',
        label: 'db',
        href: '/database/db',
        icon: () => <span>database-icon</span>,
      },
    ]);

    renderCard({
      service: {
        displayName: 'Source Service',
        id: 'source-service-id',
        name: 'source-service',
        type: 'databaseService',
      },
    });

    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
  });

  it('renders icons correctly when source service reference is missing', () => {
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([
      {
        id: 'svc',
        label: 'svc',
        href: '/settings/services/databaseServices/svc',
        icon: () => <span>service-icon</span>,
      },
      {
        id: 'db',
        label: 'db',
        href: '/database/db',
        icon: () => <span>database-icon</span>,
      },
    ]);

    renderCard({ service: undefined });

    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
  });

  it('does not render icon for category crumb when it has no icon', () => {
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([
      {
        id: 'Database Services',
        label: 'Database Services',
        href: '/settings/services/databaseServices',
      },
      {
        id: 'svc',
        label: 'svc',
        href: '/settings/services/databaseServices/svc',
        icon: () => <span>service-icon</span>,
      },
      {
        id: 'db',
        label: 'db',
        href: '/database/db',
        icon: () => <span>database-icon</span>,
      },
      {
        id: 'schema',
        label: 'schema',
        href: '/databaseSchema/schema',
        icon: () => <span>databaseSchema-icon</span>,
      },
    ]);

    renderCard({ entityType: 'databaseSchema' });

    const items = MockBreadcrumbs.mock.calls.at(-1)?.[0].items;

    expect(items[0].icon).toBeUndefined();
    expect(screen.getAllByTestId('breadcrumb-icon')).toHaveLength(3);
    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('database-icon')).toBeInTheDocument();
    expect(screen.getByText('databaseSchema-icon')).toBeInTheDocument();
  });

  it('renders only icons present in breadcrumb items', () => {
    (searchClassBase.getEntityBreadcrumbItems as jest.Mock).mockReturnValue([
      {
        id: 'svc',
        label: 'svc',
        href: '/settings/services/databaseServices/svc',
        icon: () => <span>service-icon</span>,
      },
      {
        id: 'schema',
        label: 'schema',
        href: '/databaseSchema/schema',
        icon: () => <span>databaseSchema-icon</span>,
      },
    ]);

    renderCard({ entityType: 'table' });

    expect(screen.getAllByTestId('breadcrumb-icon')).toHaveLength(2);
    expect(screen.getByText('service-icon')).toBeInTheDocument();
    expect(screen.getByText('databaseSchema-icon')).toBeInTheDocument();
    expect(screen.queryByText('database-icon')).not.toBeInTheDocument();
  });

  it('does not render any icons when breadcrumbs list is empty', () => {
    renderCard({});

    expect(screen.queryByTestId('breadcrumb-icon')).not.toBeInTheDocument();
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
