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

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Mock Entity'),
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
    getEntityIcon: jest.fn().mockReturnValue(<span>entity-icon</span>),
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

describe('ExploreSearchCard - Highlight functionality', () => {
  const { highlightEntityNameAndDescription } = jest.requireMock(
    '../../../utils/EntityUtils'
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
