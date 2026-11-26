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
import { PaletteKey } from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { useOntologyExplorer } from './hooks/useOntologyExplorer';
import OntologyExplorer from './OntologyExplorer';
import { LayoutType } from './OntologyExplorer.constants';
import {
  MergedEdge,
  OntologyGraphData,
  OntologyGraphHandle,
  OntologyNode,
} from './OntologyExplorer.interface';
import {
  ASSET_BINDING_EDGE_KIND,
  SEMANTIC_PROJECTION_EDGE_KIND,
} from './utils/graphBuilders';

interface OntologyGraphMockProps {
  nodes: OntologyNode[];
  onCreateRelation: (
    fromId: string,
    toId: string,
    relationType: string
  ) => Promise<void>;
  onEdgeClick: (edge: MergedEdge | null) => void;
  onNodeClick: (node: OntologyNode) => void;
}

const mockOntologyGraph = jest.fn<void, [OntologyGraphMockProps]>();
const mockRelationPanelMount = jest.fn();
let mockUseRealRelationPanel = false;

jest.mock('./hooks/useOntologyExplorer', () => ({
  useOntologyExplorer: jest.fn(),
}));

const mockClearEdgeSelection = jest.fn();

jest.mock('./OntologyGraphG6', () => {
  const { forwardRef, useImperativeHandle } =
    jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: forwardRef((props: OntologyGraphMockProps, ref) => {
      useImperativeHandle(ref, () => ({
        clearEdgeSelection: mockClearEdgeSelection,
      }));
      mockOntologyGraph(props);

      return <div data-testid="ontology-graph" />;
    }),
  };
});

jest.mock('./OntologyControlButtons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./OntologyEntityPanel', () => ({
  OntologyEntityPanel: () => <div data-testid="ontology-entity-panel" />,
}));

jest.mock('./OntologyAuthoringInspector', () => ({
  __esModule: true,
  default: ({ onShowFullDetails }: { onShowFullDetails: () => void }) => (
    <button
      data-testid="ontology-authoring-inspector"
      type="button"
      onClick={onShowFullDetails}>
      inspector
    </button>
  ),
}));

jest.mock('./OntologyRelationDetailsPanel', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    OntologyRelationDetailsPanel: (
      props: import('react').ComponentProps<
        typeof import('./OntologyRelationDetailsPanel').OntologyRelationDetailsPanel
      >
    ) => {
      const { edge } = props;
      useEffect(() => {
        mockRelationPanelMount();
      }, []);

      if (mockUseRealRelationPanel) {
        const Panel = jest.requireActual<
          typeof import('./OntologyRelationDetailsPanel')
        >('./OntologyRelationDetailsPanel').OntologyRelationDetailsPanel;

        return <Panel {...props} />;
      }

      return (
        <div data-testid="ontology-relation-details-panel">
          {edge?.id ?? ''}
        </div>
      );
    },
  };
});

const mockUseOntologyExplorer = useOntologyExplorer as jest.MockedFunction<
  typeof useOntologyExplorer
>;
const termNode = {
  assetCount: 101,
  fullyQualifiedName: 'DataStudio.PrimaryCluster',
  id: 'DataStudio.PrimaryCluster',
  label: 'Primary Cluster',
  loadedAssetCount: 20,
  type: 'glossaryTerm',
};
const assetNode = {
  id: 'asset-transactions',
  label: 'transactions',
  searchSource: {
    columnNames: ['transaction_id', 'amount'],
    serviceType: 'Snowflake',
  },
  type: 'dataAsset',
};
const secondaryTermNode = {
  assetCount: 1,
  fullyQualifiedName: 'DataStudio.SecondaryCluster',
  id: 'DataStudio.SecondaryCluster',
  label: 'Secondary Cluster',
  loadedAssetCount: 0,
  type: 'glossaryTerm',
};
const dataGraph: OntologyGraphData = {
  edges: [
    {
      from: termNode.id,
      label: 'has glossary term',
      relationType: 'hasGlossaryTerm',
      to: assetNode.id,
    },
  ],
  nodes: [termNode, assetNode],
};

function createExplorerState(
  overrides: Partial<ReturnType<typeof useOntologyExplorer>> = {}
): ReturnType<typeof useOntologyExplorer> {
  const graphData = { edges: [], nodes: [termNode] };

  return {
    combinedGraphData: graphData,
    expandedTermIds: new Set<string>(),
    explorationMode: 'model',
    exportableGlossaryId: undefined,
    fetchError: false,
    filteredGraphData: graphData,
    filters: {
      glossaryIds: [],
      relationTypes: [],
      searchQuery: '',
      showCrossGlossaryOnly: false,
      showIsolatedNodes: true,
      viewMode: 'overview',
    },
    glossaryColorMap: {},
    glossaries: [],
    graphDataToShow: graphData,
    graphRef: { current: null as OntologyGraphHandle | null },
    graphSearchHighlight: null,
    handleExportJsonLd: jest.fn(),
    handleExportPng: jest.fn(),
    handleExportRdfXml: jest.fn(),
    handleExportSvg: jest.fn(),
    handleExportTurtle: jest.fn(),
    handleFiltersChange: jest.fn(),
    handleFitToScreen: jest.fn(),
    handleGraphNodeClick: jest.fn(),
    handleGraphNodeDoubleClick: jest.fn(),
    handleGraphPaneClick: jest.fn(),
    handleLoadMore: jest.fn(),
    handleModeChange: jest.fn(),
    handleNodeDataUpdate: jest.fn(),
    handleRefresh: jest.fn(),
    handleScrollNearEdge: jest.fn(),
    handleSettingsChange: jest.fn(),
    handleViewModeChange: jest.fn(),
    handleZoomIn: jest.fn(),
    handleZoomOut: jest.fn(),
    hasMoreTerms: false,
    hasMoreDataTerms: false,
    hierarchyBakedPositions: undefined,
    hierarchyGraphData: null,
    isHierarchyView: false,
    isLoadingMore: false,
    loadedTermCount: 1,
    loading: false,
    rdfEnabled: true,
    relationTypes: [],
    selectedNode: null,
    setFilters: jest.fn(),
    setSelectedNode: jest.fn(),
    settings: { layout: LayoutType.Hierarchical, showEdgeLabels: true },
    ontologySummary: undefined,
    isolatedTermDetails: [],
    totalTermCount: 1,
    ...overrides,
  };
}

describe('OntologyExplorer Studio data controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exposes global Model and Data modes and dispatches the typed selection', () => {
    const state = createExplorerState();
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);
    const modelTab = screen.getByRole('tab', { name: 'label.model' });

    expect(screen.getByTestId('ontology-layer-switch')).toHaveClass(
      'tw:right-3.5',
      'tw:top-3.5'
    );
    expect(modelTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('ontology-graph-search')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'label.data' }));

    expect(state.handleModeChange).toHaveBeenCalledWith('data');
  });

  it('renders Data mode as term cards with compact asset rows', () => {
    const state = createExplorerState({
      expandedTermIds: new Set([termNode.id]),
      explorationMode: 'data',
      graphDataToShow: dataGraph,
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(screen.getByTestId('ontology-data-graph')).toBeInTheDocument();
    expect(
      screen.getByTestId(`ontology-data-cluster-${termNode.id}`)
    ).toBeInTheDocument();
    expect(screen.getByText('transactions')).toHaveClass(
      'tw:text-sm',
      'tw:font-medium'
    );
    expect(screen.getByRole('tab', { name: 'label.data' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.queryByTestId('ontology-graph-search')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-graph-controls')
    ).not.toBeInTheDocument();
  });

  it('preserves palette tokens so custom SVG relationships follow theme changes', () => {
    const state = createExplorerState({
      explorationMode: 'data',
      graphDataToShow: {
        edges: [
          {
            from: termNode.id,
            label: 'informed by',
            relationType: 'informedBy',
            to: secondaryTermNode.id,
          },
        ],
        nodes: [termNode, secondaryTermNode],
      },
      relationTypes: [
        createRelationshipTypeMock({
          name: 'informedBy',
          paletteKey: PaletteKey.Purple,
        }),
      ],
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(screen.getByTestId('ontology-data-semantic-edge')).toHaveAttribute(
      'stroke',
      'var(--tw-color-utility-purple-500)'
    );
  });

  it('draws only the relations between concept clusters, not links between their assets', () => {
    const secondaryAssetNode: OntologyNode = {
      id: 'asset-customers',
      label: 'customers',
      type: 'dataAsset',
    };
    const state = createExplorerState({
      explorationMode: 'data',
      graphDataToShow: {
        edges: [
          {
            edgeKind: ASSET_BINDING_EDGE_KIND,
            from: assetNode.id,
            label: 'tagged with',
            relationType: 'hasGlossaryTerm',
            to: termNode.id,
          },
          {
            edgeKind: ASSET_BINDING_EDGE_KIND,
            from: secondaryAssetNode.id,
            label: 'tagged with',
            relationType: 'hasGlossaryTerm',
            to: secondaryTermNode.id,
          },
          {
            edgeKind: SEMANTIC_PROJECTION_EDGE_KIND,
            from: assetNode.id,
            label: 'related to',
            relationType: 'relatedTo',
            to: secondaryAssetNode.id,
          },
          {
            from: termNode.id,
            label: 'related to',
            relationType: 'relatedTo',
            to: secondaryTermNode.id,
          },
        ],
        nodes: [termNode, secondaryTermNode, assetNode, secondaryAssetNode],
      },
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(screen.getAllByTestId('ontology-data-semantic-edge')).toHaveLength(
      1
    );
    expect(screen.getAllByTestId('ontology-data-edge-arrow')).toHaveLength(1);
    expect(
      screen.getByTestId('ontology-data-semantic-edge-label')
    ).toHaveTextContent('related to');
  });

  it('expands the semantic edge layer when a term card is moved', () => {
    const originalPointerEvent = window.PointerEvent;
    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      value: MouseEvent,
    });
    const state = createExplorerState({
      explorationMode: 'data',
      graphDataToShow: {
        edges: [
          {
            from: termNode.id,
            label: 'related',
            relationType: 'relatedTo',
            to: secondaryTermNode.id,
          },
        ],
        nodes: [termNode, secondaryTermNode],
      },
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);
    const semanticEdge = screen.getByTestId('ontology-data-semantic-edge');
    const edgeLayer = semanticEdge.closest('svg');
    const initialWidth = Number(edgeLayer?.getAttribute('width'));
    const initialHeight = Number(edgeLayer?.getAttribute('height'));
    const secondaryCluster = screen.getByTestId(
      `ontology-data-cluster-${secondaryTermNode.id}`
    );
    secondaryCluster.setPointerCapture = jest.fn();

    fireEvent.pointerDown(secondaryCluster, {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(secondaryCluster, {
      clientX: 1_200,
      clientY: 900,
      pointerId: 1,
    });

    expect(Number(edgeLayer?.getAttribute('width'))).toBeGreaterThan(
      initialWidth
    );
    expect(Number(edgeLayer?.getAttribute('height'))).toBeGreaterThan(
      initialHeight
    );

    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      value: originalPointerEvent,
    });
  });

  it('does not fan out asset requests for server-populated Data clusters', () => {
    const state = createExplorerState({ explorationMode: 'data' });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(state.handleGraphNodeClick).not.toHaveBeenCalled();
  });

  it('shows the search empty state when the query has no graph matches', () => {
    const state = createExplorerState({
      filters: {
        glossaryIds: [],
        relationTypes: [],
        searchQuery: 'missing concept',
        showCrossGlossaryOnly: false,
        showIsolatedNodes: true,
        viewMode: 'overview',
      },
      graphSearchHighlight: {
        active: true,
        highlightedEdgeKeys: [],
        highlightedGlossaryIds: [],
        highlightedNodeIds: [],
      },
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(
      screen.getByTestId('ontology-graph-search-empty')
    ).toBeInTheDocument();
  });

  it('offers keyboard-accessible paging for an expanded asset cluster', () => {
    const state = createExplorerState({
      expandedTermIds: new Set([termNode.id]),
      explorationMode: 'data',
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);
    fireEvent.click(
      screen.getByTestId(`ontology-load-more-assets-${termNode.id}`)
    );

    expect(state.handleGraphNodeClick).toHaveBeenCalledWith(
      termNode,
      undefined,
      { dataModeLoadMoreBadgeClick: true }
    );
  });

  it('caps rendered Data clusters and shows a refine hint', () => {
    const manyTermNodes = Array.from({ length: 61 }, (_, index) => ({
      assetCount: 5,
      fullyQualifiedName: `Ontology.Cluster${index}`,
      id: `Ontology.Cluster${index}`,
      isDataModeSeed: index === 60,
      label: `Cluster ${index}`,
      loadedAssetCount: 0,
      type: 'glossaryTerm',
    }));
    const state = createExplorerState({
      explorationMode: 'data',
      graphDataToShow: { edges: [], nodes: manyTermNodes },
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(screen.getAllByTestId(/^ontology-data-cluster-/)).toHaveLength(60);
    expect(
      screen.getByTestId('ontology-data-cluster-Ontology.Cluster60')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-data-cluster-Ontology.Cluster59')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-data-render-cap')).toBeInTheDocument();
  });

  it('keeps seed paging available while connected context exceeds the cap', () => {
    const manyTermNodes = Array.from({ length: 61 }, (_, index) => ({
      assetCount: 5,
      id: `Ontology.Context${index}`,
      label: `Context ${index}`,
      type: 'glossaryTerm',
    }));
    const state = createExplorerState({
      explorationMode: 'data',
      graphDataToShow: { edges: [], nodes: manyTermNodes },
      hasMoreDataTerms: true,
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(
      screen.getByRole('button', { name: 'label.load-more-lowercase' })
    ).toBeEnabled();
    expect(
      screen.queryByTestId('ontology-data-render-cap')
    ).not.toBeInTheDocument();
  });
});

describe('OntologyExplorer legacy surfaces remain distinct from native placements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRealRelationPanel = false;
  });

  afterEach(() => {
    mockUseRealRelationPanel = false;
  });

  it.each([
    ['fetch', 'ontology-graph-error'],
    ['loading', 'ontology-graph-loading'],
    ['hierarchy', 'ontology-graph-hierarchy-empty'],
    ['search', 'ontology-graph-search-empty'],
    ['relation', 'ontology-graph-no-relations'],
    ['filtered', 'ontology-graph-empty'],
    ['onboarding', 'ontology-graph-onboarding'],
    ['glossary', 'ontology-graph-empty'],
  ])('explains the %s empty state', (kind, testId) => {
    const state = createExplorerState({
      graphDataToShow: { nodes: [], edges: [] },
      combinedGraphData: { nodes: [], edges: [] },
    });
    if (kind === 'fetch') {
      state.fetchError = true;
      state.graphDataToShow = null;
    }
    if (kind === 'loading') {
      state.loading = true;
    }
    if (kind === 'hierarchy') {
      state.isHierarchyView = true;
      state.hierarchyGraphData = { nodes: [], edges: [], combos: [] };
    }
    if (kind === 'search') {
      state.filters = { ...state.filters, searchQuery: 'Absent' };
    }
    if (kind === 'relation') {
      state.filters = { ...state.filters, relationTypes: ['isA'] };
    }
    if (kind === 'filtered') {
      state.filters = { ...state.filters, glossaryIds: ['other'] };
    }
    mockUseOntologyExplorer.mockReturnValue(state);
    render(
      <OntologyExplorer scope={kind === 'glossary' ? 'glossary' : 'global'} />
    );

    expect(screen.getByTestId(testId)).toBeVisible();
  });

  it('sends the onboarding call to action to the glossary, not back to the explorer', () => {
    mockUseOntologyExplorer.mockReturnValue(
      createExplorerState({
        graphDataToShow: { nodes: [], edges: [] },
        combinedGraphData: { nodes: [], edges: [] },
      })
    );
    render(<OntologyExplorer scope="global" />);

    expect(
      screen.getByTestId('ontology-onboarding-view-glossary')
    ).toHaveAttribute('href', '/glossary');
  });

  it('keeps the layer switch when the data layer has no linked assets', () => {
    const state = createExplorerState({
      explorationMode: 'data',
      graphDataToShow: { nodes: [], edges: [] },
      combinedGraphData: { nodes: [], edges: [] },
    });
    mockUseOntologyExplorer.mockReturnValue(state);
    render(<OntologyExplorer scope="global" />);

    expect(screen.getByTestId('ontology-data-empty')).toBeVisible();
    expect(
      screen.queryByTestId('ontology-graph-onboarding')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'label.model' }));

    expect(state.handleModeChange).toHaveBeenCalledWith('model');
  });

  it('changes a Data exploration back to Model and reflects an external search', () => {
    const state = createExplorerState({ explorationMode: 'data' });
    mockUseOntologyExplorer.mockReturnValue(state);
    const { rerender } = render(<OntologyExplorer scope="global" />);
    fireEvent.click(screen.getByRole('tab', { name: 'label.model' }));

    expect(state.handleModeChange).toHaveBeenCalledWith('model');

    mockUseOntologyExplorer.mockReturnValue({
      ...state,
      explorationMode: 'model',
      filters: { ...state.filters, searchQuery: 'Customer' },
    });
    rerender(<OntologyExplorer scope="global" />);

    expect(screen.getByTestId('ontology-graph-search')).toHaveValue('Customer');
  });

  it('opens the entity slideout for a concept in an embedded graph', () => {
    mockUseOntologyExplorer.mockReturnValue(
      createExplorerState({ selectedNode: termNode })
    );

    render(<OntologyExplorer scope="glossary" />);

    expect(screen.getByTestId('ontology-entity-panel')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-authoring-inspector')
    ).not.toBeInTheDocument();
  });

  it('inspects a concept in place in the global explorer and opens its page from View Details', () => {
    const state = createExplorerState({ selectedNode: termNode });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(
      screen.queryByTestId('ontology-entity-panel')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-authoring-inspector'));

    expect(state.handleGraphNodeDoubleClick).toHaveBeenCalledWith(termNode);
  });

  it('remounts the read-only relation details panel when the selected edge changes', () => {
    mockUseOntologyExplorer.mockReturnValue(createExplorerState());

    render(<OntologyExplorer scope="global" />);

    expect(
      screen.queryByTestId('ontology-relation-details-panel')
    ).not.toBeInTheDocument();

    const graphProps = mockOntologyGraph.mock.calls[0][0] as unknown as {
      onEdgeClick: (edge: MergedEdge | null) => void;
    };
    const edgeA: MergedEdge = {
      from: 'a',
      id: 'edge-a',
      isBidirectional: false,
      relationType: 'partOf',
      to: 'b',
    };
    const edgeB: MergedEdge = { ...edgeA, from: 'c', id: 'edge-b', to: 'd' };

    act(() => graphProps.onEdgeClick(edgeA));

    expect(
      screen.getByTestId('ontology-relation-details-panel')
    ).toHaveTextContent('edge-a');
    expect(mockRelationPanelMount).toHaveBeenCalledTimes(1);

    act(() => graphProps.onEdgeClick(edgeB));

    expect(
      screen.getByTestId('ontology-relation-details-panel')
    ).toHaveTextContent('edge-b');
    expect(mockRelationPanelMount).toHaveBeenCalledTimes(2);
  });
});
