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
import { MemoryRouter } from 'react-router-dom';
import searchClassBase from '../../../utils/SearchClassBase';
import ExploreSearchCard from './ExploreSearchCard';
import { ExploreSearchCardProps } from './ExploreSearchCard.interface';

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
    render(
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

    render(
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

    render(
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

    render(
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

    render(
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

    render(
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

    render(
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
    const { rerender } = render(
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
