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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { PaletteKey } from '../../generated/entity/data/relationshipType';
import { EntityStatus, Provenance } from '../../generated/type/termRelation';
import { createRelationshipTypeMock } from '../../mocks/Ontology.mock';
import {
  addGlossaryTerm,
  addTermRelation,
  getGlossaryTermByFQN,
  removeTermRelationById,
  updateTermRelationById,
} from '../../rest/glossaryAPI';
import ontologyExplorerClassBase from '../../utils/OntologyExplorerClassBase';
import {
  OntologyAiProposals,
  OntologyAiProposalsOptions,
} from '../../utils/OntologyExplorerClassBase.interface';
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
let mockUseRealDraftInspector = false;
let mockUseRealRelationPanel = false;

jest.mock('./hooks/useOntologyExplorer', () => ({
  useOntologyExplorer: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  ...jest.requireActual('../../rest/glossaryAPI'),
  addTermRelation: jest.fn(),
  addGlossaryTerm: jest.fn(),
  updateTermRelationById: jest.fn(),
  removeTermRelationById: jest.fn(),
  getGlossaryTermByFQN: jest.fn(),
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

jest.mock('./OntologyConceptDraftInspector', () => ({
  __esModule: true,
  default: (
    props: import('react').ComponentProps<
      typeof import('./OntologyConceptDraftInspector').default
    >
  ) => {
    if (mockUseRealDraftInspector) {
      const Inspector = jest.requireActual<
        typeof import('./OntologyConceptDraftInspector')
      >('./OntologyConceptDraftInspector').default;

      return <Inspector {...props} />;
    }

    return (
      <div data-testid="ontology-concept-draft-inspector">
        {props.node.label}
      </div>
    );
  },
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

function useStatefulExplorerMock(): ReturnType<typeof useOntologyExplorer> {
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);

  return createExplorerState({ selectedNode, setSelectedNode });
}

describe('OntologyExplorer Studio data controls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a hydrated display name instead of an isolated term UUID', () => {
    const isolatedId = '002e5485-0c59-45cc-912e-15fbc7e350bf';
    const isolatedNode: OntologyNode = {
      fullyQualifiedName: `Finance.${isolatedId}`,
      id: isolatedId,
      label: isolatedId,
      type: 'glossaryTermIsolated',
    };
    const graphData = { edges: [], nodes: [isolatedNode] };
    mockUseOntologyExplorer.mockReturnValue(
      createExplorerState({
        combinedGraphData: graphData,
        filteredGraphData: graphData,
        graphDataToShow: graphData,
        isolatedTermDetails: [
          {
            description: 'Customer account concept',
            displayName: 'Customer Account',
            fullyQualifiedName: 'Finance.customer_account',
            glossary: {
              id: 'cf650c10-4f15-4775-b737-d7936f3a43cb',
              name: 'Finance',
              type: 'glossary',
            },
            id: isolatedId,
            name: 'customer_account',
          },
        ],
      })
    );

    render(<OntologyExplorer showHealth scope="global" />);

    fireEvent.click(screen.getByTestId('ontology-health-review'));
    const isolatedRow = screen.getByTestId(
      `ontology-isolated-term-${isolatedId}`
    );

    expect(isolatedRow).toHaveTextContent('Customer Account');
    expect(isolatedRow).not.toHaveTextContent(isolatedId);
    expect(screen.getByTestId('ontology-isolated-count')).toHaveTextContent(
      '1'
    );
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

  it('hides the Model and Data switch while authoring concepts', () => {
    const state = createExplorerState();
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer isAuthoringMode scope="global" />);

    expect(
      screen.queryByTestId('ontology-layer-switch')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'label.data' })
    ).not.toBeInTheDocument();
  });

  it('opens the metric details panel instead of the concept inspector in authoring mode', () => {
    const metricNode = {
      id: 'metric-churn-rate',
      label: 'Monthly Churn Rate %',
      type: 'metric',
    };
    const state = createExplorerState({ selectedNode: metricNode });
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer isAuthoringMode scope="global" />);

    expect(screen.getByTestId('ontology-entity-panel')).toBeInTheDocument();
    expect(
      screen.queryByTestId('ontology-authoring-inspector')
    ).not.toBeInTheDocument();
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
      screen.getByRole('button', { name: 'label.load-more' })
    ).toBeEnabled();
    expect(
      screen.queryByTestId('ontology-data-render-cap')
    ).not.toBeInTheDocument();
  });

  it('remounts the relation details panel when the selected edge changes', () => {
    const state = createExplorerState();
    mockUseOntologyExplorer.mockReturnValue(state);

    render(<OntologyExplorer isEditMode scope="global" />);

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
    const edgeB: MergedEdge = {
      from: 'c',
      id: 'edge-b',
      isBidirectional: false,
      relationType: 'relatedTo',
      to: 'd',
    };

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

describe('OntologyExplorer AI proposals extension', () => {
  const proposedNode: OntologyNode = {
    fullyQualifiedName: 'DataStudio.Revenue',
    id: 'proposed-op-revenue',
    label: 'Revenue',
    proposal: { changeSetId: 'cs-1', operationId: 'op-revenue' },
    type: 'glossaryTerm',
  };
  const createdNode: OntologyNode = {
    fullyQualifiedName: 'DataStudio.Revenue',
    id: 'revenue-id',
    label: 'Revenue',
    type: 'glossaryTerm',
  };
  const openProposal = jest.fn();
  const onReview = jest.fn();
  let hookOptions: OntologyAiProposalsOptions | undefined;

  const useStubAiProposals = (
    options: OntologyAiProposalsOptions
  ): OntologyAiProposals => {
    hookOptions = options;

    return {
      canvasOverlay: <div data-testid="stub-ai-overlay" />,
      drawer: <div data-testid="stub-ai-drawer" />,
      edges: [
        {
          from: proposedNode.id,
          label: 'relatedTo',
          proposal: { changeSetId: 'cs-1', operationId: 'op-link' },
          relationType: 'relatedTo',
          to: termNode.id,
        },
      ],
      hasCanvasOverlay: true,
      healthEntry: { onReview, summary: '1 new term', title: '1', total: 1 },
      nodes: [proposedNode],
      openProposal,
    };
  };

  // The explorer refreshes after a proposal is applied; the refreshed graph
  // holds the concept the proposal created.
  function useRefreshingExplorerMock(): ReturnType<typeof useOntologyExplorer> {
    const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
    const [nodes, setNodes] = useState<OntologyNode[]>([termNode]);
    const graphData = { edges: [], nodes };

    return createExplorerState({
      combinedGraphData: graphData,
      filteredGraphData: graphData,
      graphDataToShow: graphData,
      handleGraphNodeClick: (node: OntologyNode) => setSelectedNode(node),
      handleRefresh: () => setNodes([termNode, createdNode]),
      selectedNode,
      setSelectedNode,
    });
  }

  const lastGraphProps = () =>
    mockOntologyGraph.mock.calls[mockOntologyGraph.mock.calls.length - 1][0];

  const renderStudio = (onRequestEdit = jest.fn()) => {
    render(
      <OntologyExplorer
        isAuthoringMode
        isEditMode
        showHealth
        proposalPermissions={{ canApprove: true, canReject: false }}
        scope="global"
        onRequestEdit={onRequestEdit}
      />
    );

    return onRequestEdit;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hookOptions = undefined;
    mockUseOntologyExplorer.mockImplementation(useRefreshingExplorerMock);
    jest
      .spyOn(ontologyExplorerClassBase, 'getAiProposalsHook')
      .mockReturnValue(useStubAiProposals);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('draws the proposals on the canvas and renders the overlay, drawer and health entry', () => {
    renderStudio();

    expect(lastGraphProps().nodes).toContainEqual(proposedNode);
    expect(screen.getByTestId('stub-ai-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('stub-ai-drawer')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ontology-health-ai-proposals'));

    expect(onReview).toHaveBeenCalled();
    expect(hookOptions).toMatchObject({
      isEnabled: true,
      permissions: { canApprove: true, canReject: false },
    });
  });

  it('opens a proposal from the canvas instead of the concept inspector', () => {
    renderStudio();

    act(() => lastGraphProps().onNodeClick(proposedNode));

    expect(openProposal).toHaveBeenCalledWith(proposedNode.proposal);
    expect(
      screen.queryByTestId('ontology-authoring-inspector')
    ).not.toBeInTheDocument();
  });

  it('opens a concept created from a proposal for editing even when the canvas has not loaded it', async () => {
    (
      getGlossaryTermByFQN as jest.MockedFunction<typeof getGlossaryTermByFQN>
    ).mockResolvedValue({
      description: '',
      fullyQualifiedName: 'DataStudio.Revenue',
      glossary: { id: 'glossary-id', type: 'glossary' },
      id: '7d3c1a52-8a52-4f2c-9a3c-3b3c3e4f5a6b',
      name: 'Revenue',
    });
    const onRequestEdit = renderStudio();

    act(() => hookOptions?.onEditTerm('DataStudio.Revenue'));

    expect(onRequestEdit).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByTestId('ontology-authoring-inspector')
    ).toBeInTheDocument();
    expect(getGlossaryTermByFQN).toHaveBeenCalledWith('DataStudio.Revenue', {
      fields: 'relatedTerms,owners',
    });
    expect(lastGraphProps().nodes).not.toContainEqual(
      expect.objectContaining({
        fullyQualifiedName: 'DataStudio.Revenue',
        id: '7d3c1a52-8a52-4f2c-9a3c-3b3c3e4f5a6b',
      })
    );
  });

  it('opens a proposed relationship once per click, so later graph updates do not reopen it', () => {
    renderStudio();
    const proposedEdge = {
      from: proposedNode.id,
      proposal: { changeSetId: 'cs-1', operationId: 'op-link' },
      relationType: 'relatedTo',
      to: termNode.id,
    } as MergedEdge;

    act(() => lastGraphProps().onEdgeClick(proposedEdge));

    expect(openProposal).toHaveBeenCalledWith(proposedEdge.proposal);
    expect(mockClearEdgeSelection).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId('ontology-relation-details-panel')
    ).not.toBeInTheDocument();
  });

  it('does not save a relationship drawn to a proposed concept', async () => {
    renderStudio();

    await act(() =>
      lastGraphProps().onCreateRelation(
        termNode.id,
        proposedNode.id,
        'relatedTo'
      )
    );

    expect(addTermRelation).not.toHaveBeenCalled();
  });

  it('still saves a relationship drawn between two concepts', async () => {
    (
      addTermRelation as jest.MockedFunction<typeof addTermRelation>
    ).mockResolvedValue({} as never);
    renderStudio();

    await act(() =>
      lastGraphProps().onCreateRelation(
        termNode.id,
        'DataStudio.SecondaryCluster',
        'relatedTo'
      )
    );

    await waitFor(() =>
      expect(addTermRelation).toHaveBeenCalledWith(termNode.id, {
        relationType: 'relatedTo',
        term: { id: 'DataStudio.SecondaryCluster', type: 'glossaryTerm' },
      })
    );
  });

  it('asks for no proposals outside the Studio canvas', () => {
    render(<OntologyExplorer scope="glossary" />);

    expect(hookOptions?.isEnabled).toBe(false);
  });
});

describe('OntologyExplorer legacy surfaces remain distinct from native placements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRealDraftInspector = false;
    mockUseRealRelationPanel = false;
  });

  afterEach(() => {
    mockUseRealDraftInspector = false;
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

  it('uses the legacy grouped tree and requests editing when connecting an isolated term', () => {
    const onRequestEdit = jest.fn();
    const node = {
      ...termNode,
      type: 'glossaryTermIsolated',
      glossaryId: 'glossary',
    };
    const state = createExplorerState({
      combinedGraphData: { nodes: [node], edges: [] },
      glossaries: [{ id: 'glossary', name: 'Business', description: '' }],
    });
    mockUseOntologyExplorer.mockReturnValue(state);
    render(
      <OntologyExplorer
        scope="global"
        surface="tree"
        onRequestEdit={onRequestEdit}
      />
    );

    expect(screen.getByTestId('ontology-tree-unconnected')).toBeVisible();

    fireEvent.click(screen.getByTestId('ontology-tree-connect-' + node.id));

    expect(state.setSelectedNode).toHaveBeenCalledWith(node);
    expect(onRequestEdit).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'saves an authored relationship with failed=%s without losing a failed edit',
    async (fails) => {
      mockUseRealRelationPanel = true;
      const edge: MergedEdge = {
        id: 'authored',
        from: termNode.id,
        to: secondaryTermNode.id,
        relationType: 'partOf',
        isBidirectional: false,
        provenance: Provenance.Manual,
        status: EntityStatus.Draft,
      };
      const graph = {
        nodes: [termNode, secondaryTermNode],
        edges: [{ ...edge, label: edge.relationType }],
      };
      const state = createExplorerState({
        graphDataToShow: graph,
        combinedGraphData: graph,
        relationTypes: [createRelationshipTypeMock({ name: 'partOf' })],
      });
      mockUseOntologyExplorer.mockReturnValue(state);
      const save = updateTermRelationById as jest.Mock;
      if (fails) {
        save.mockRejectedValue(new Error('Conflict'));
      } else {
        save.mockResolvedValue({});
      }
      render(<OntologyExplorer isAuthoringMode isEditMode scope="global" />);
      act(() => mockOntologyGraph.mock.calls.at(-1)?.[0].onEdgeClick(edge));
      fireEvent.click(
        within(screen.getByTestId('relation-status-select')).getByRole('button')
      );
      fireEvent.click(
        await screen.findByRole('option', { name: 'label.approved' })
      );
      fireEvent.click(screen.getByRole('button', { name: 'label.save' }));
      await waitFor(() =>
        expect(save).toHaveBeenCalledWith(
          termNode.id,
          'authored',
          expect.objectContaining({ status: 'Approved' })
        )
      );
      if (fails) {
        expect(
          screen.getByTestId('ontology-relation-details-panel')
        ).toBeVisible();
      } else {
        await waitFor(() =>
          expect(
            screen.queryByTestId('ontology-relation-details-panel')
          ).not.toBeInTheDocument()
        );

        expect(state.handleRefresh).toHaveBeenCalledTimes(1);
      }
    }
  );

  it.each([false, true])(
    'deletes an authored relationship with failed=%s and retains failure context',
    async (fails) => {
      mockUseRealRelationPanel = true;
      const edge: MergedEdge = {
        id: 'authored',
        from: termNode.id,
        to: secondaryTermNode.id,
        relationType: 'partOf',
        isBidirectional: false,
        provenance: Provenance.Manual,
        status: EntityStatus.Draft,
      };
      const graph = {
        nodes: [termNode, secondaryTermNode],
        edges: [{ ...edge, label: edge.relationType }],
      };
      const state = createExplorerState({
        graphDataToShow: graph,
        combinedGraphData: graph,
      });
      mockUseOntologyExplorer.mockReturnValue(state);
      const remove = removeTermRelationById as jest.Mock;
      if (fails) {
        remove.mockRejectedValue(new Error('Conflict'));
      } else {
        remove.mockResolvedValue({});
      }
      render(<OntologyExplorer isAuthoringMode isEditMode scope="global" />);
      act(() => mockOntologyGraph.mock.calls.at(-1)?.[0].onEdgeClick(edge));
      fireEvent.click(screen.getByTestId('delete-relation-btn'));
      fireEvent.click(screen.getByTestId('confirm-delete-relation-btn'));
      await waitFor(() =>
        expect(remove).toHaveBeenCalledWith(termNode.id, 'authored')
      );
      if (fails) {
        expect(
          screen.getByTestId('ontology-relation-details-panel')
        ).toBeVisible();
      } else {
        await waitFor(() =>
          expect(
            screen.queryByTestId('ontology-relation-details-panel')
          ).not.toBeInTheDocument()
        );

        expect(state.handleRefresh).toHaveBeenCalledTimes(1);
      }
    }
  );

  it('updates and saves a glossary draft, then replaces its optimistic node with the persisted concept', async () => {
    mockUseRealDraftInspector = true;
    const glossary = { id: 'g', name: 'Business', description: '' };
    const created: GlossaryTerm = {
      id: 'created',
      name: 'Customer',
      fullyQualifiedName: 'Business.Customer',
      glossary: { id: 'g', type: 'glossary', name: 'Business' },
      description: 'A customer',
    };
    let graph: OntologyGraphData = { nodes: [], edges: [] };
    mockUseOntologyExplorer.mockImplementation(() => {
      const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(
        null
      );

      return createExplorerState({
        selectedNode,
        setSelectedNode,
        glossaries: [glossary],
        graphDataToShow: graph,
      });
    });
    (addGlossaryTerm as jest.Mock).mockResolvedValue(created);
    const onCreated = jest.fn(),
      onSelected = jest.fn();
    const { rerender } = render(
      <OntologyExplorer
        isAuthoringMode
        isEditMode
        conceptDraftId="draft"
        defaultConceptGlossaryId="g"
        scope="global"
        onConceptCreated={onCreated}
        onSelectedNodeChange={onSelected}
      />
    );
    fireEvent.change(screen.getByRole('textbox', { name: /^label.name/ }), {
      target: { value: 'Customer' },
    });
    fireEvent.change(
      screen.getByRole('textbox', { name: /^label.description/ }),
      { target: { value: 'A customer' } }
    );
    fireEvent.click(screen.getByTestId('ontology-draft-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));

    expect(
      screen.queryByTestId('ontology-concept-draft-inspector')
    ).not.toBeInTheDocument();

    graph = {
      nodes: [{ id: created.id, label: created.name, type: 'glossaryTerm' }],
      edges: [],
    };
    rerender(
      <OntologyExplorer
        isAuthoringMode
        isEditMode
        scope="global"
        onSelectedNodeChange={onSelected}
      />
    );
    await waitFor(() =>
      expect(onSelected).toHaveBeenLastCalledWith(graph.nodes[0])
    );
  });

  it('cancels a glossary draft and removes its temporary selection', () => {
    mockUseRealDraftInspector = true;
    mockUseOntologyExplorer.mockImplementation(useStatefulExplorerMock);
    const onClose = jest.fn();
    render(
      <OntologyExplorer
        isAuthoringMode
        conceptDraftId="draft"
        scope="global"
        onConceptDraftClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'label.close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId('ontology-concept-draft-inspector')
    ).not.toBeInTheDocument();
  });

  it('removes a draft when its parent closes the workflow', () => {
    mockUseOntologyExplorer.mockImplementation(useStatefulExplorerMock);
    const onSelectedNodeChange = jest.fn();
    const { rerender } = render(
      <OntologyExplorer
        isAuthoringMode
        conceptDraftId="draft"
        scope="global"
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    expect(
      screen.getByTestId('ontology-concept-draft-inspector')
    ).toBeVisible();

    rerender(
      <OntologyExplorer
        isAuthoringMode
        scope="global"
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    expect(
      screen.queryByTestId('ontology-concept-draft-inspector')
    ).not.toBeInTheDocument();
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(null);
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
});
