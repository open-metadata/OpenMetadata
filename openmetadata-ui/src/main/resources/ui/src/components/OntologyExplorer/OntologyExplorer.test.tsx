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
import { useState } from 'react';
import { PaletteKey } from '../../generated/entity/data/relationshipType';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import { useOntologyExplorer } from './hooks/useOntologyExplorer';
import OntologyExplorer from './OntologyExplorer';
import { LayoutType } from './OntologyExplorer.constants';
import {
  OntologyGraphData,
  OntologyGraphHandle,
  OntologyNode,
} from './OntologyExplorer.interface';
import {
  ASSET_BINDING_EDGE_KIND,
  OBSERVED_LINEAGE_EDGE_KIND,
} from './utils/graphBuilders';

interface OntologyGraphMockProps {
  nodes: OntologyNode[];
}

const mockOntologyGraph = jest.fn<void, [OntologyGraphMockProps]>();

jest.mock('./hooks/useOntologyExplorer', () => ({
  useOntologyExplorer: jest.fn(),
}));

jest.mock('./OntologyGraphG6', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: forwardRef((props: OntologyGraphMockProps, _ref) => {
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

jest.mock('./OntologyConceptDraftInspector', () => ({
  __esModule: true,
  default: ({ node }: { node: OntologyNode }) => (
    <div data-testid="ontology-concept-draft-inspector">{node.label}</div>
  ),
}));

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
    studioSummary: undefined,
    totalTermCount: 1,
    ...overrides,
  };
}

function useStatefulExplorerMock(): ReturnType<typeof useOntologyExplorer> {
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);

  return createExplorerState({ selectedNode, setSelectedNode });
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
    expect(modelTab).toHaveClass(
      'tw:text-[11px]!',
      'tw:font-semibold!',
      'tw:bg-brand-primary!'
    );
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
      'tw:font-mono',
      'tw:text-[11px]',
      'tw:font-medium'
    );
    expect(screen.getByRole('tab', { name: 'label.data' })).toHaveClass(
      'tw:bg-brand-primary!',
      'tw:text-brand-secondary!'
    );
    expect(
      screen.queryByTestId('ontology-graph-search')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-graph-controls')
    ).not.toBeInTheDocument();
  });

  it('resolves palette tokens before painting custom SVG relationships', () => {
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
      '#7a5af8'
    );
  });

  it('renders observed asset lineage as a solid edge between term clusters', () => {
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
            edgeKind: OBSERVED_LINEAGE_EDGE_KIND,
            from: assetNode.id,
            label: 'observed lineage',
            relationType: 'lineage',
            to: secondaryAssetNode.id,
          },
        ],
        nodes: [termNode, secondaryTermNode, assetNode, secondaryAssetNode],
      },
    });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);

    expect(
      screen.getByTestId('ontology-data-observed-lineage-edge')
    ).not.toHaveAttribute('stroke-dasharray');
    expect(
      screen.queryByTestId('ontology-data-semantic-edge-label')
    ).not.toBeInTheDocument();
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

  it('uses the inline inspector instead of the entity slideout in authoring mode', () => {
    const state = createExplorerState({ selectedNode: termNode });
    const onSelectedNodeChange = jest.fn();
    mockUseOntologyExplorer.mockReturnValue(state);

    render(
      <OntologyExplorer
        isAuthoringMode
        scope="global"
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    expect(
      screen.getByTestId('ontology-authoring-inspector')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-entity-panel')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('ontology-explorer')).not.toHaveClass(
      'ontology-slideout-open'
    );
    expect(onSelectedNodeChange).toHaveBeenCalledWith(termNode);
  });

  it('adds and selects an optimistic concept node for inline authoring', () => {
    const onSelectedNodeChange = jest.fn();
    mockUseOntologyExplorer.mockImplementation(useStatefulExplorerMock);

    render(
      <OntologyExplorer
        isAuthoringMode
        conceptDraftId="ontology-concept-draft-1"
        scope="global"
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    expect(
      screen.getByTestId('ontology-concept-draft-inspector')
    ).toHaveTextContent('label.new-entity');
    expect(mockOntologyGraph).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: 'ontology-concept-draft-1',
            isDraft: true,
          }),
        ]),
      })
    );
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'ontology-concept-draft-1',
        isDraft: true,
      })
    );
  });

  it('opens the entity slideout for a concept in an embedded graph', () => {
    const state = createExplorerState({ selectedNode: termNode });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="glossary" />);

    expect(screen.getByTestId('ontology-entity-panel')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-authoring-inspector')
    ).not.toBeInTheDocument();
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

  it('returns to the Model view when Edit mode is entered from Data', () => {
    const state = createExplorerState({ explorationMode: 'data' });
    mockUseOntologyExplorer.mockReturnValue(state);

    const { rerender } = render(
      <OntologyExplorer isAuthoringMode={false} scope="global" />
    );

    expect(state.handleModeChange).not.toHaveBeenCalled();

    rerender(<OntologyExplorer isAuthoringMode scope="global" />);

    expect(state.handleModeChange).toHaveBeenCalledWith('model');
  });

  it('keeps the Model view untouched when Edit mode is entered from Model', () => {
    const state = createExplorerState({ explorationMode: 'model' });
    mockUseOntologyExplorer.mockReturnValue(state);

    const { rerender } = render(
      <OntologyExplorer isAuthoringMode={false} scope="global" />
    );

    rerender(<OntologyExplorer isAuthoringMode scope="global" />);

    expect(state.handleModeChange).not.toHaveBeenCalled();
  });

  it('disables the Data layer while authoring concepts', () => {
    const state = createExplorerState();
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer isAuthoringMode scope="global" />);
    fireEvent.click(screen.getByRole('tab', { name: 'label.data' }));

    expect(state.handleModeChange).not.toHaveBeenCalledWith('data');
  });

  it('opens the concept entity page in a new tab from View Details', () => {
    const state = createExplorerState({ selectedNode: termNode });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer scope="global" />);
    fireEvent.click(screen.getByTestId('ontology-authoring-inspector'));

    expect(state.handleGraphNodeDoubleClick).toHaveBeenCalledWith(termNode);
  });

  it('caps rendered Data clusters and shows a refine hint', () => {
    const manyTermNodes = Array.from({ length: 61 }, (_, index) => ({
      assetCount: 5,
      fullyQualifiedName: `DataStudio.Cluster${index}`,
      id: `DataStudio.Cluster${index}`,
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
    expect(screen.getByTestId('ontology-data-render-cap')).toBeInTheDocument();
  });
});
