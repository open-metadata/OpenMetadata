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
import { useOntologyExplorer } from './hooks/useOntologyExplorer';
import OntologyExplorer from './OntologyExplorer';
import { LayoutType } from './OntologyExplorer.constants';
import {
  OntologyGraphData,
  OntologyGraphHandle,
} from './OntologyExplorer.interface';

jest.mock('./hooks/useOntologyExplorer', () => ({
  useOntologyExplorer: jest.fn(),
}));

jest.mock('./OntologyGraphG6', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');

  return {
    __esModule: true,
    default: forwardRef(() => <div data-testid="ontology-graph" />),
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
