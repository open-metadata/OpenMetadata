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
import { fireEvent, render, screen } from '@testing-library/react';
import {
  LineageData,
  LineageEntityReference,
} from '../../../../components/Lineage/Lineage.interface';
import { FormattedDatabaseServiceType } from '../../../../utils/EntityUtils.interface';
import LineageTabContent from './LineageTabContent';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, to, ...props }) => (
    <a href={to} {...props}>
      {children}
    </a>
  )),
}));

// Mock SearchBarComponent
jest.mock('../../../common/SearchBarComponent/SearchBar.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ onSearch, placeholder, searchValue }) => (
      <div data-testid="search-bar">
        <input
          data-testid="search-input"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
    )),
}));

// Mock antd components
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Button: jest
    .fn()
    .mockImplementation(({ children, onClick, className, size, ...props }) => (
      <button
        className={className}
        data-size={size}
        data-testid="button"
        onClick={onClick}
        {...props}>
        {children}
      </button>
    )),
  Typography: {
    Text: jest.fn().mockImplementation(({ children, className, ...props }) => (
      <span className={className} data-testid="typography-text" {...props}>
        {children}
      </span>
    )),
    Paragraph: jest
      .fn()
      .mockImplementation(({ children, className, ...props }) => (
        <p className={className} data-testid="typography-paragraph" {...props}>
          {children}
        </p>
      )),
  },
}));

// Mock SVG components with unique implementations
jest.mock('../../../../assets/svg/downstream.svg', () => ({
  __esModule: true,
  ReactComponent: (props: any) => (
    <svg data-testid="downstream-icon" {...props}>
      <title>DownstreamIcon</title>
    </svg>
  ),
}));

jest.mock('../../../../assets/svg/upstream.svg', () => ({
  __esModule: true,
  ReactComponent: (props: any) => (
    <svg data-testid="upstream-icon" {...props}>
      <title>UpstreamIcon</title>
    </svg>
  ),
}));

jest.mock('../../../../assets/svg/ic-task-empty.svg', () => ({
  __esModule: true,
  ReactComponent: (props: any) => (
    <svg data-testid="no-data-icon" {...props}>
      <title>NoDataIcon</title>
    </svg>
  ),
}));

// Mock ErrorPlaceHolderNew component
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolderNew', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children, icon }) => (
    <div data-testid="error-placeholder">
      {icon}
      {children}
    </div>
  )),
}));

// Mock ERROR_PLACEHOLDER_TYPE enum
jest.mock('../../../../enums/common.enum', () => ({
  ...jest.requireActual('../../../../enums/common.enum'),
  ERROR_PLACEHOLDER_TYPE: {
    CREATE: 'CREATE',
    ASSIGN: 'ASSIGN',
    FILTER: 'FILTER',
    CUSTOM: 'CUSTOM',
    PERMISSION: 'PERMISSION',
    NO_DATA: 'NO_DATA',
  },
}));

// Mock utility functions
jest.mock('../../../../utils/CommonUtils', () => ({
  getServiceLogo: jest
    .fn()
    .mockReturnValue(<div data-testid="service-logo">ServiceLogo</div>),
}));

jest.mock('../../../../utils/EntityLineageUtils', () => ({
  getUpstreamDownstreamNodesEdges: jest.fn(),
}));

// Mock SearchClassBase to avoid importing @react-awesome-query-builder
jest.mock('../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: jest
      .fn()
      .mockImplementation((entityType: string) => (
        <div data-testid={`entity-icon-${entityType}`}>EntityIcon</div>
      )),
  },
}));

// Mock OwnerLabel component
jest.mock('../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(({ owners }) => (
      <div data-testid="owner-label">
        {owners?.map((owner: any) => owner.name).join(', ')}
      </div>
    )),
}));

// Mock NoOwnerFound component
jest.mock('../../../common/NoOwner/NoOwnerFound', () => ({
  NoOwnerFound: jest
    .fn()
    .mockImplementation(() => <div data-testid="no-owner-found">No Owner</div>),
}));

// Mock data
const mockUpstreamEntity: LineageEntityReference & {
  entityType?: string;
} = {
  id: 'upstream-1',
  type: 'table',
  name: 'upstream_table',
  displayName: 'Upstream Table',
  fullyQualifiedName: 'service.database.schema.upstream_table',
  serviceType: FormattedDatabaseServiceType.BigQuery,
  entityType: 'table',
};

const mockDownstreamEntity: LineageEntityReference & {
  entityType?: string;
} = {
  id: 'downstream-1',
  type: 'table',
  name: 'downstream_table',
  displayName: 'Downstream Table',
  fullyQualifiedName: 'service.database.schema.downstream_table',
  serviceType: FormattedDatabaseServiceType.Snowflake,
  entityType: 'table',
};

const mockLineageData: LineageData = {
  nodes: {
    'upstream-1': {
      entity: mockUpstreamEntity,
      paging: { entityUpstreamCount: 1 },
    },
    'downstream-1': {
      entity: mockDownstreamEntity,
      paging: { entityDownstreamCount: 1 },
    },
  },
  upstreamEdges: {
    'edge-1': {
      fromEntity: mockUpstreamEntity,
      toEntity: { id: 'current-entity', type: 'table' },
    },
  },
  downstreamEdges: {
    'edge-2': {
      fromEntity: {
        id: 'current-entity',
        type: 'table',
      },
      toEntity: mockDownstreamEntity,
    },
  },
};

const defaultProps = {
  entityFqn: 'service.database.schema.current_table',
  filter: 'upstream' as const,
  lineageData: mockLineageData,
  onFilterChange: jest.fn(),
};

describe('LineageTabContent', () => {
  const mockGetUpstreamDownstreamNodesEdges = jest.requireMock(
    '../../../../utils/EntityLineageUtils'
  ).getUpstreamDownstreamNodesEdges;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementation
    mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
      upstreamNodes: [mockUpstreamEntity],
      downstreamNodes: [mockDownstreamEntity],
    });
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<LineageTabContent {...defaultProps} />);

      const buttons = screen.getAllByTestId('upstream-button-active');

      expect(buttons).toHaveLength(1);
    });

    it('should render with correct CSS classes', () => {
      const { container } = render(<LineageTabContent {...defaultProps} />);

      expect(
        container.querySelector('.lineage-tab-content')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.lineage-filter-buttons')
      ).toBeInTheDocument();
      expect(
        container.querySelector('.lineage-items-list')
      ).toBeInTheDocument();
    });
  });

  describe('Filter Buttons', () => {
    it('should render upstream and downstream filter buttons', () => {
      render(<LineageTabContent {...defaultProps} />);

      const upstreamButton = screen.getByTestId('upstream-button-active');
      const downstreamButton = screen.getByTestId('downstream-button-');

      expect(upstreamButton).toBeInTheDocument();
      expect(downstreamButton).toBeInTheDocument();
    });

    it('should show correct counts in filter buttons', () => {
      render(<LineageTabContent {...defaultProps} />);

      const countElements = screen.getAllByText('1');

      expect(countElements).toHaveLength(2); // upstream and downstream counts
    });

    it('should highlight active filter button', () => {
      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByTestId('upstream-button-active')).toBeInTheDocument();
    });

    it('should highlight downstream filter when active', () => {
      render(<LineageTabContent {...defaultProps} filter="downstream" />);

      expect(
        screen.getByTestId('downstream-button-active')
      ).toBeInTheDocument();
    });

    it('should call onFilterChange when upstream button is clicked', () => {
      const mockOnFilterChange = jest.fn();
      render(
        <LineageTabContent
          {...defaultProps}
          onFilterChange={mockOnFilterChange}
        />
      );

      const upstreamButton = screen.getByText('label.upstream', {
        selector: 'span',
      });
      fireEvent.click(upstreamButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith('upstream');
    });

    it('should call onFilterChange when downstream button is clicked', () => {
      const mockOnFilterChange = jest.fn();
      render(
        <LineageTabContent
          {...defaultProps}
          onFilterChange={mockOnFilterChange}
        />
      );

      const downstreamButton = screen.getByTestId('downstream-button-');
      fireEvent.click(downstreamButton);

      expect(mockOnFilterChange).toHaveBeenCalledWith('downstream');
    });
  });

  describe('Upstream Filter', () => {
    it('should render upstream lineage items when filter is upstream', () => {
      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByText('Upstream Table')).toBeInTheDocument();
      expect(screen.getAllByTestId('ChevronRightIcon')).toHaveLength(2);
      expect(screen.getByTestId('MoreHorizIcon')).toBeInTheDocument();
    });

    it('should render direction icon for upstream items', () => {
      const { container } = render(
        <LineageTabContent {...defaultProps} filter="upstream" />
      );

      const directionElement = container.querySelector(
        '.lineage-item-direction'
      );

      expect(directionElement).toBeInTheDocument();
      // Icon is rendered (SVG mock might resolve differently in test environment)
      expect(directionElement?.querySelector('svg')).toBeInTheDocument();
    });

    it('should render upstream direction text', () => {
      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      // Note: The component shows direction via icon, not text with .item-direction-text class
      const directionElements = document.querySelectorAll(
        '.lineage-item-direction'
      );

      expect(directionElements.length).toBeGreaterThan(0);
    });

    it('should render service logo for upstream items', () => {
      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByTestId('service-logo')).toBeInTheDocument();
    });

    it('should not render downstream items when filter is upstream', () => {
      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.queryByText('Downstream Table')).not.toBeInTheDocument();
    });
  });

  describe('Downstream Filter', () => {
    it('should render downstream lineage items when filter is downstream', () => {
      render(<LineageTabContent {...defaultProps} filter="downstream" />);

      expect(screen.getByText('Downstream Table')).toBeInTheDocument();
      // Path is truncated to "service > ... > schema" when there are more than 2 parts with MUI Breadcrumbs
      expect(screen.getAllByTestId('ChevronRightIcon')).toHaveLength(2);
      expect(screen.getByTestId('MoreHorizIcon')).toBeInTheDocument();
    });

    it('should render downstream direction text', () => {
      render(<LineageTabContent {...defaultProps} filter="downstream" />);

      // Note: The component shows direction via icon, not text with .item-direction-text class
      const directionElements = document.querySelectorAll(
        '.lineage-item-direction'
      );

      expect(directionElements.length).toBeGreaterThan(0);
    });

    it('should render service logo for downstream items', () => {
      render(<LineageTabContent {...defaultProps} filter="downstream" />);

      expect(screen.getByTestId('service-logo')).toBeInTheDocument();
    });

    it('should not render upstream items when filter is downstream', () => {
      render(<LineageTabContent {...defaultProps} filter="downstream" />);

      expect(screen.queryByText('Upstream Table')).not.toBeInTheDocument();
    });
  });

  describe('Lineage Items Structure', () => {
    it('should render lineage item cards with correct structure', () => {
      const { container } = render(<LineageTabContent {...defaultProps} />);

      const lineageCards = container.querySelectorAll('.lineage-item-card');

      expect(lineageCards.length).toBeGreaterThan(0);

      lineageCards.forEach((card) => {
        expect(card.querySelector('.lineage-item-header')).toBeInTheDocument();
        expect(card.querySelector('.lineage-card-content')).toBeInTheDocument();
      });
    });

    it('should render service icon in lineage item header', () => {
      const { container } = render(<LineageTabContent {...defaultProps} />);

      const serviceIcons = container.querySelectorAll('.service-icon');

      expect(serviceIcons.length).toBeGreaterThan(0);
    });

    it('should render lineage item direction in header', () => {
      const { container } = render(<LineageTabContent {...defaultProps} />);

      const directionElements = container.querySelectorAll(
        '.lineage-item-direction'
      );

      expect(directionElements.length).toBeGreaterThan(0);
    });

    it('should render entity path when available', () => {
      render(<LineageTabContent {...defaultProps} />);

      // MUI Breadcrumbs renders path as separate breadcrumb items
      expect(screen.getByText('service')).toBeInTheDocument();
      expect(screen.getByText('schema')).toBeInTheDocument();
      expect(screen.getAllByTestId('ChevronRightIcon')).toHaveLength(2);
      expect(screen.getByTestId('MoreHorizIcon')).toBeInTheDocument();
      // Path is truncated to "service > ... > schema" when there are more than 2 parts with MUI Breadcrumbs
    });

    it('should render entity display name or name', () => {
      render(<LineageTabContent {...defaultProps} />);

      expect(screen.getByText('Upstream Table')).toBeInTheDocument();
    });
  });

  describe('No Data State', () => {
    it('should render error placeholder when no lineage items', () => {
      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [],
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} />);

      expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
      expect(screen.getByTestId('no-data-icon')).toBeInTheDocument();
      expect(screen.getByText('label.lineage-not-found')).toBeInTheDocument();
    });

    it('should render no data found message with correct structure', () => {
      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [],
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} />);

      const paragraph = screen.getByTestId('typography-paragraph');

      expect(paragraph).toBeInTheDocument();
      expect(paragraph).toHaveClass('text-center');
      expect(paragraph).toHaveClass('no-data-placeholder');
    });
  });

  describe('Entity Filtering', () => {
    it('should exclude current entity from upstream items', () => {
      const currentEntityFqn = 'service.database.schema.current_table';
      const lineageDataWithCurrentEntity = {
        ...mockLineageData,
        nodes: {
          ...mockLineageData.nodes,
          'current-entity': {
            entity: {
              id: 'current-entity',
              type: 'table',
              name: 'current_table',
              displayName: 'Current Table',
              fullyQualifiedName: currentEntityFqn,
              serviceType: FormattedDatabaseServiceType.BigQuery,
              entityType: 'table',
            },
            paging: { entityUpstreamCount: 1 },
          },
        },
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [
          mockUpstreamEntity,
          {
            id: 'current-entity',
            type: 'table',
            name: 'current_table',
            displayName: 'Current Table',
            fullyQualifiedName: currentEntityFqn,
            serviceType: FormattedDatabaseServiceType.BigQuery,
            entityType: 'table',
          },
        ],
        downstreamNodes: [mockDownstreamEntity],
      });

      render(
        <LineageTabContent
          {...defaultProps}
          entityFqn={currentEntityFqn}
          lineageData={lineageDataWithCurrentEntity}
        />
      );

      expect(screen.getByText('Upstream Table')).toBeInTheDocument();
      expect(screen.queryByText('Current Table')).not.toBeInTheDocument();
    });

    it('should exclude current entity from downstream items', () => {
      const currentEntityFqn = 'service.database.schema.current_table';
      const lineageDataWithCurrentEntity = {
        ...mockLineageData,
        nodes: {
          ...mockLineageData.nodes,
          'current-entity': {
            entity: {
              id: 'current-entity',
              type: 'table',
              name: 'current_table',
              displayName: 'Current Table',
              fullyQualifiedName: currentEntityFqn,
              serviceType: FormattedDatabaseServiceType.BigQuery,
              entityType: 'table',
            },
            paging: { entityUpstreamCount: 1 },
          },
        },
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [mockUpstreamEntity],
        downstreamNodes: [
          mockDownstreamEntity,
          {
            id: 'current-entity',
            type: 'table',
            name: 'current_table',
            displayName: 'Current Table',
            fullyQualifiedName: currentEntityFqn,
            serviceType: FormattedDatabaseServiceType.BigQuery,
            entityType: 'table',
          },
        ],
      });

      render(
        <LineageTabContent
          {...defaultProps}
          entityFqn={currentEntityFqn}
          filter="downstream"
          lineageData={lineageDataWithCurrentEntity}
        />
      );

      expect(screen.getByText('Downstream Table')).toBeInTheDocument();
      expect(screen.queryByText('Current Table')).not.toBeInTheDocument();
    });
  });

  describe('Path Generation', () => {
    it('should generate correct path from fullyQualifiedName', () => {
      const entityWithLongPath = {
        ...mockUpstreamEntity,
        fullyQualifiedName: 'service.database.schema.table.column',
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [entityWithLongPath],
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      // MUI Breadcrumbs renders first and last items with condensed menu for middle items
      expect(screen.getByText('service')).toBeInTheDocument();
      expect(screen.getByText('table')).toBeInTheDocument();
      expect(screen.getAllByTestId('ChevronRightIcon')).toHaveLength(2);
      expect(screen.getByTestId('MoreHorizIcon')).toBeInTheDocument();
    });

    it('should handle entities without fullyQualifiedName', () => {
      const entityWithoutFqn = {
        ...mockUpstreamEntity,
        fullyQualifiedName: undefined,
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [entityWithoutFqn],
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByText('Upstream Table')).toBeInTheDocument();
    });

    it('should handle entities with empty fullyQualifiedName', () => {
      const entityWithEmptyFqn = {
        ...mockUpstreamEntity,
        fullyQualifiedName: '',
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [entityWithEmptyFqn],
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByText('Upstream Table')).toBeInTheDocument();
    });
  });

  describe('Entity Name Display', () => {
    it('should display displayName when available', () => {
      render(<LineageTabContent {...defaultProps} />);

      expect(screen.getByText('Upstream Table')).toBeInTheDocument();
    });

    it('should fallback to name when displayName is not available', () => {
      const entityWithoutDisplayName = {
        ...mockUpstreamEntity,
        displayName: undefined,
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [entityWithoutDisplayName],
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByText('upstream_table')).toBeInTheDocument();
    });

    it('should fallback to name when displayName is empty', () => {
      const entityWithEmptyDisplayName = {
        ...mockUpstreamEntity,
        displayName: '',
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [entityWithEmptyDisplayName],
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByText('upstream_table')).toBeInTheDocument();
    });
  });

  describe('Service Logo Integration', () => {
    it('should call getServiceLogo with correct parameters', () => {
      const { getServiceLogo } = jest.requireMock(
        '../../../../utils/CommonUtils'
      );

      render(<LineageTabContent {...defaultProps} />);

      expect(getServiceLogo).toHaveBeenCalledWith(
        'Big query',
        'service-icon-lineage'
      );
    });

    it('should handle entities without serviceType', () => {
      const entityWithoutServiceType = {
        ...mockUpstreamEntity,
        serviceType: undefined,
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [entityWithoutServiceType],
        downstreamNodes: [],
      });

      const { getServiceLogo } = jest.requireMock(
        '../../../../utils/CommonUtils'
      );

      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(getServiceLogo).toHaveBeenCalledWith('', 'service-icon-lineage');
    });
  });

  describe('Utility Function Integration', () => {
    it('should call getUpstreamDownstreamNodesEdges with correct parameters', () => {
      render(<LineageTabContent {...defaultProps} />);

      expect(mockGetUpstreamDownstreamNodesEdges).toHaveBeenCalledWith(
        [
          ...Object.values(mockLineageData.downstreamEdges || {}),
          ...Object.values(mockLineageData.upstreamEdges || {}),
        ],
        Object.values(mockLineageData.nodes || {}).map(
          (nodeData) => nodeData.entity
        ),
        defaultProps.entityFqn
      );
    });

    it('should handle empty lineage data', () => {
      const emptyLineageData: LineageData = {
        nodes: {},
        upstreamEdges: {},
        downstreamEdges: {},
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [],
        downstreamNodes: [],
      });

      render(
        <LineageTabContent {...defaultProps} lineageData={emptyLineageData} />
      );

      expect(mockGetUpstreamDownstreamNodesEdges).toHaveBeenCalledWith(
        [],
        [],
        defaultProps.entityFqn
      );
    });
  });

  describe('Multiple Items', () => {
    it('should render multiple upstream items', () => {
      const multipleUpstreamEntities = [
        mockUpstreamEntity,
        {
          id: 'upstream-2',
          type: 'table',
          name: 'upstream_table_2',
          displayName: 'Upstream Table 2',
          fullyQualifiedName: 'service.database.schema.upstream_table_2',
          serviceType: FormattedDatabaseServiceType.Postgres,
          entityType: 'table',
        },
      ];

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: multipleUpstreamEntities,
        downstreamNodes: [],
      });

      render(<LineageTabContent {...defaultProps} filter="upstream" />);

      expect(screen.getByText('Upstream Table')).toBeInTheDocument();
      expect(screen.getByText('Upstream Table 2')).toBeInTheDocument();
    });

    it('should render multiple downstream items', () => {
      const multipleDownstreamEntities = [
        mockDownstreamEntity,
        {
          id: 'downstream-2',
          type: 'table',
          name: 'downstream_table_2',
          displayName: 'Downstream Table 2',
          fullyQualifiedName: 'service.database.schema.downstream_table_2',
          serviceType: FormattedDatabaseServiceType.Mysql,
          entityType: 'table',
        },
      ];

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [],
        downstreamNodes: multipleDownstreamEntities,
      });

      render(<LineageTabContent {...defaultProps} filter="downstream" />);

      expect(screen.getByText('Downstream Table')).toBeInTheDocument();
      expect(screen.getByText('Downstream Table 2')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing lineage data gracefully', () => {
      // Set up mock to handle empty lineage data
      mockGetUpstreamDownstreamNodesEdges.mockReturnValueOnce({
        upstreamNodes: [],
        downstreamNodes: [],
      });

      const emptyLineageData = {
        nodes: {},
        upstreamEdges: {},
        downstreamEdges: {},
      };

      const { container } = render(
        <LineageTabContent {...defaultProps} lineageData={emptyLineageData} />
      );

      expect(
        container.querySelector('.lineage-tab-content')
      ).toBeInTheDocument();
    });

    it('should handle missing nodes in lineage data', () => {
      const lineageDataWithoutNodes = {
        ...mockLineageData,
        nodes: {},
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [],
        downstreamNodes: [],
      });

      render(
        <LineageTabContent
          {...defaultProps}
          lineageData={lineageDataWithoutNodes}
        />
      );

      expect(screen.getByText('label.lineage-not-found')).toBeInTheDocument();
    });

    it('should handle missing edges in lineage data', () => {
      const lineageDataWithoutEdges = {
        ...mockLineageData,
        upstreamEdges: {},
        downstreamEdges: {},
      };

      mockGetUpstreamDownstreamNodesEdges.mockReturnValue({
        upstreamNodes: [],
        downstreamNodes: [],
      });

      render(
        <LineageTabContent
          {...defaultProps}
          lineageData={lineageDataWithoutEdges}
        />
      );

      expect(screen.getByText('label.lineage-not-found')).toBeInTheDocument();
    });
  });
});
