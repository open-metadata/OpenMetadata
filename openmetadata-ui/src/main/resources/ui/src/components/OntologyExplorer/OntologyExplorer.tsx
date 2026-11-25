/*
 *  Copyright 2024 Collate.
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
  Button,
  Card,
  Input,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Cube02,
  CubeOutline,
  LayoutGrid01,
  NoFilterFunnel,
  NoSearch,
  Search,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, {
  Fragment,
  Key,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/constants';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import FeaturesPlaceholder from '../common/EmptyPlaceholder/FeaturesPlaceholder';
import NoDataPlaceholder from '../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import NoSearchResultsPlaceholder from '../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import SomethingWentWrongPlaceholder from '../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import { useGenericContext } from '../Customization/GenericProvider/GenericContext';
import { buildOntologySlideoutEntityDetails } from './buildOntologySlideoutEntityDetails';
import ExportGraphPanel from './ExportGraphPanel';
import GraphSettingsPanel from './GraphSettingsPanel';
import { useOntologyExplorer } from './hooks/useOntologyExplorer';
import OntologyAuthoringInspector from './OntologyAuthoringInspector';
import OntologyControlButtons from './OntologyControlButtons';
import OntologyDataGraph from './OntologyDataGraph';
import { OntologyEntityPanel } from './OntologyEntityPanel';
import { withoutOntologyAutocompleteAll } from './OntologyExplorer.constants';
import {
  MergedEdge,
  OntologyExplorerProps,
  OntologyNode,
} from './OntologyExplorer.interface';
import OntologyGraph from './OntologyGraphG6';
import { OntologyNodeRelationsContent } from './OntologyNodeRelationsContent';
import { OntologyRelationDetailsPanel } from './OntologyRelationDetailsPanel';
import OntologySearchClearButton from './OntologySearchClearButton';
import {
  ASSET_NODE_TYPE,
  ASSET_RELATION_TYPE,
  isDataAssetLikeNode,
  METRIC_NODE_TYPE,
} from './utils/graphBuilders';

const SearchInputIcon = ({ className }: { className?: string }) => (
  <Search aria-hidden="true" className={className} />
);
const DEFAULT_GRAPH_BACKDROP_CLASS =
  'tw:absolute tw:inset-0 tw:z-0 tw:bg-canvas tw:[background-image:radial-gradient(circle,var(--tw-color-border-secondary)_1px,transparent_1px)] tw:[background-size:14px_14px]';

const ONTOLOGY_TOOLBAR_CARD_CLASS =
  'tw:z-6 tw:border tw:border-utility-gray-blue-100 tw:shadow-md';

type GraphEmptyStateKind =
  | 'fetch-error'
  | 'loading'
  | 'hierarchy-empty'
  | 'search-empty'
  | 'filtered-relation-empty'
  | 'filtered-active-empty'
  | 'onboarding-empty'
  | 'no-terms-empty'
  | 'data-empty'
  | 'null-state'
  | 'no-matching-relation'
  | 'content';

function OntologyOnboardingEmptyState() {
  const { t } = useTranslation();

  return (
    <div
      className="tw:absolute tw:inset-0 tw:z-3 tw:overflow-hidden tw:rounded-lg tw:bg-primary"
      data-testid="ontology-graph-onboarding">
      <FeaturesPlaceholder
        description={t('message.ontology-empty-description')}
        features={[
          {
            key: 'relationships',
            icon: <LayoutGrid01 className="tw:text-fg-brand-primary" />,
            title: t('label.relationship-plural'),
            description: t(
              'message.ontology-relationships-feature-description'
            ),
          },
          {
            key: 'the-graph',
            icon: <Cube02 className="tw:text-fg-warning-primary" />,
            title: t('label.the-graph'),
            description: t('message.ontology-graph-feature-description'),
          },
          {
            key: 'what-it-unlocks',
            icon: <CubeOutline className="tw:text-fg-success-primary" />,
            title: t('label.what-it-unlocks'),
            description: t('message.ontology-unlocks-feature-description'),
          },
        ]}
        footer={
          <Button
            color="primary"
            data-testid="ontology-onboarding-view-glossary"
            href={ROUTES.GLOSSARY}>
            {t('label.view-entity', { entity: t('label.glossary') })}
          </Button>
        }
        title={t('message.ontology-empty-title')}
      />
    </div>
  );
}

function FilteredGraphEmptyState({
  description,
  testId,
}: {
  readonly description: string;
  readonly testId: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="tw:absolute tw:inset-0 tw:z-3 tw:bg-primary"
      data-testid={testId}>
      <NoFilteredResultsPlaceholder
        description={description}
        icon={<NoFilterFunnel />}
        title={t('label.no-result-for-these-filter-plural')}
      />
    </div>
  );
}

function SearchGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <div
      className="tw:absolute tw:inset-0 tw:z-3 tw:bg-primary"
      data-testid="ontology-graph-search-empty">
      <NoSearchResultsPlaceholder
        description={t('message.check-spelling-or-try-shorter-term')}
        icon={<NoSearch />}
        title={t('label.no-matching-result-plural')}
      />
    </div>
  );
}

// Below: one hoisted module-scope component per `GraphEmptyStateKind`. Hoisting
// (rather than defining these inline inside the render function) keeps each a
// stable component reference — a fresh arrow function per render would trip
// react/no-unstable-nested-components — and each grabs its own `t` per the
// codebase convention of components owning their own translation hook.
function FetchErrorGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <SomethingWentWrongPlaceholder
      className="tw:z-3"
      data-testid="ontology-graph-error"
      description={t('server.entity-fetch-error', { entity: t('label.graph') })}
    />
  );
}

function LoadingGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <div
      className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:flex-col tw:items-center tw:justify-center"
      data-testid="ontology-graph-loading">
      <div
        aria-label={t('label.loading')}
        className="tw:h-10 tw:w-10 tw:animate-spin tw:rounded-full tw:border-2 tw:border-secondary tw:border-t-(--tw-color-bg-brand-solid)"
        role="status"
      />
      <Typography as="p" className="tw:mt-4 tw:text-tertiary">
        {t('label.loading-graph')}
      </Typography>
    </div>
  );
}

function HierarchyEmptyGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <FilteredGraphEmptyState
      description={t('message.no-hierarchical-relations-found')}
      testId="ontology-graph-hierarchy-empty"
    />
  );
}

// Shared by both `filtered-relation-empty` and `no-matching-relation` — the
// original markup for the two kinds was identical.
function NoRelationsForFilterGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <FilteredGraphEmptyState
      description={t('message.no-relations-for-selected-filter')}
      testId="ontology-graph-no-relations"
    />
  );
}

function FilteredActiveGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <FilteredGraphEmptyState
      description={t('message.no-data-available-for-selected-filter')}
      testId="ontology-graph-empty"
    />
  );
}

function DataLayerGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <div
      className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:items-center tw:justify-center tw:bg-primary"
      data-testid="ontology-data-empty">
      <NoDataPlaceholder
        description={t('message.ontology-data-empty-hint')}
        icon={<Cube02 className="tw:text-fg-brand-primary" />}
        title={t('label.no-assets-linked-yet')}
      />
    </div>
  );
}

function NoTermsGraphEmptyState() {
  const { t } = useTranslation();

  return (
    <div
      className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:items-center tw:justify-center tw:bg-primary"
      data-testid="ontology-graph-empty">
      <NoDataPlaceholder
        description={t('message.no-glossary-terms-found')}
        icon={<Cube02 className="tw:text-fg-brand-primary" />}
        title={t('message.ontology-empty-title')}
      />
    </div>
  );
}

// The global explorer inspects a concept in place; embedded graphs and data
// assets open the entity slideout.
function getSelectionPanels(
  scope: OntologyExplorerProps['scope'],
  selectedNode: OntologyNode | null,
  selectedEdge: MergedEdge | null
) {
  const isDataAssetSelected = Boolean(
    selectedNode && isDataAssetLikeNode(selectedNode)
  );

  return {
    showConceptInspector:
      scope === 'global' &&
      Boolean(selectedNode) &&
      !isDataAssetSelected &&
      !selectedEdge,
    showEntityPanel: Boolean(
      selectedNode && (isDataAssetSelected || scope !== 'global')
    ),
  };
}

const OntologyExplorer: React.FC<OntologyExplorerProps> = ({
  scope,
  entityId: propEntityId,
  glossaryId,
  className,
  height = 'calc(100vh - 200px)',
  onStatsChange,
  onLoadingChange,
}) => {
  const { t } = useTranslation();
  const contextData = useGenericContext<GlossaryTerm>();
  const entityId =
    propEntityId ?? (scope === 'term' ? contextData?.data?.id : undefined);
  const termGlossaryId =
    scope === 'term' ? contextData?.data?.glossary?.id : undefined;

  const {
    graphRef,
    loading,
    fetchError,
    isLoadingMore,
    glossaries,
    relationTypes,
    settings,
    filters,
    explorationMode,
    selectedNode,
    expandedTermIds,
    rdfEnabled,
    graphDataToShow,
    filteredGraphData,
    hierarchyGraphData,
    hierarchyBakedPositions,
    graphSearchHighlight,
    glossaryColorMap,
    isHierarchyView,
    exportableGlossaryId,
    hasMoreDataTerms,
    setFilters,
    setSelectedNode,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleExportPng,
    handleExportSvg,
    handleExportTurtle,
    handleExportRdfXml,
    handleExportJsonLd,
    handleModeChange,
    handleRefresh,
    handleLoadMore,
    handleScrollNearEdge,
    handleSettingsChange,
    handleGraphNodeClick,
    handleGraphNodeDoubleClick,
    handleGraphPaneClick,
    handleNodeDataUpdate,
  } = useOntologyExplorer({
    scope,
    entityId,
    glossaryId,
    termGlossaryId,
    onStatsChange,
    onLoadingChange,
  });

  const [searchInput, setSearchInput] = useState(filters.searchQuery);
  const [selectedEdge, setSelectedEdge] = useState<MergedEdge | null>(null);
  const lastSelectedNodeRef = useRef(selectedNode);
  if (selectedNode) {
    lastSelectedNodeRef.current = selectedNode;
  }
  const activeNode = selectedNode ?? lastSelectedNodeRef.current;
  const { showConceptInspector, showEntityPanel } = getSelectionPanels(
    scope,
    selectedNode,
    selectedEdge
  );
  const pageableTermNodes = useMemo(
    () =>
      explorationMode === 'data'
        ? (filteredGraphData?.nodes ?? []).filter(
            (node) =>
              expandedTermIds.has(node.id) &&
              (node.assetCount ?? 0) > (node.loadedAssetCount ?? 0)
          )
        : [],
    [expandedTermIds, explorationMode, filteredGraphData?.nodes]
  );
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, searchQuery: searchInput }));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, setFilters]);

  useEffect(() => {
    if (filters.searchQuery !== searchInputRef.current) {
      setSearchInput(filters.searchQuery);
    }
  }, [filters.searchQuery]);

  const handleExplorationModeSelection = useCallback(
    (key: Key) => {
      switch (key) {
        case 'data':
          handleModeChange('data');

          break;
        case 'model':
          handleModeChange('model');

          break;
      }
    },
    [handleModeChange]
  );

  const handleGraphEdgeClick = useCallback(
    (edge: MergedEdge | null) => {
      setSelectedEdge(edge);
      if (edge) {
        setSelectedNode(null);
      }
    },
    [setSelectedNode]
  );

  const renderGraphContent = () => {
    const hasNoVisibleNodes =
      !graphDataToShow || graphDataToShow.nodes.length === 0;
    const relationTypeFilterIds = withoutOntologyAutocompleteAll(
      filters.relationTypes
    );
    const hasRelationFilter = relationTypeFilterIds.length > 0;

    const nodeTypeMap = new Map(
      (graphDataToShow?.nodes ?? []).map((n) => [n.id, n.type])
    );
    const termToTermEdges = (graphDataToShow?.edges ?? []).filter((e) => {
      const fromType = nodeTypeMap.get(e.from);
      const toType = nodeTypeMap.get(e.to);

      return (
        fromType !== ASSET_NODE_TYPE &&
        fromType !== METRIC_NODE_TYPE &&
        toType !== ASSET_NODE_TYPE &&
        toType !== METRIC_NODE_TYPE
      );
    });
    const hasNoMatchingRelationEdges =
      hasRelationFilter && termToTermEdges.length === 0;
    const hasNoSearchMatches = Boolean(
      graphSearchHighlight?.active &&
        graphSearchHighlight.highlightedNodeIds.length === 0 &&
        graphSearchHighlight.highlightedEdgeKeys.length === 0 &&
        graphSearchHighlight.highlightedGlossaryIds.length === 0
    );

    // Resolves which "no data to show" placeholder applies (if any) once
    // hasNoVisibleNodes is true; split out so its own branch count doesn't
    // fold into resolveEmptyStateKind's.
    const resolveNoVisibleNodesEmptyStateKind = (): GraphEmptyStateKind => {
      if (filters.searchQuery.trim().length > 0) {
        return 'search-empty';
      }
      if (hasRelationFilter) {
        return 'filtered-relation-empty';
      }

      const hasActiveFilter =
        withoutOntologyAutocompleteAll(filters.glossaryIds).length > 0 ||
        filters.viewMode !== 'overview';
      if (hasActiveFilter) {
        return 'filtered-active-empty';
      }
      if (explorationMode === 'data') {
        return 'data-empty';
      }

      return scope === 'global' ? 'onboarding-empty' : 'no-terms-empty';
    };

    // Split into two lookups (rather than one long boolean-chain function) so
    // neither one's operator count folds into resolveEmptyStateKind's own
    // cyclomatic complexity.
    const resolvePrimaryEmptyStateFlags = () => ({
      isFetchError: Boolean(fetchError && !loading && !graphDataToShow),
      isLoadingState: loading && hasNoVisibleNodes,
      isHierarchyEmpty: Boolean(
        isHierarchyView &&
          hierarchyGraphData !== null &&
          hierarchyGraphData.edges.length === 0
      ),
      isSearchEmpty: hasNoSearchMatches && !loading,
    });

    const resolveSecondaryEmptyStateFlags = () => ({
      isVisibleNodesEmpty:
        hasNoVisibleNodes && !loading && graphDataToShow !== null,
      isNullState: !graphDataToShow,
      isNoMatchingRelation: hasNoMatchingRelationEdges && !loading,
    });

    // Guard-clause dispatcher mirroring the original if-chain, but returning a
    // discriminant instead of JSX so the render lookup below carries none of
    // this branching.
    const resolveEmptyStateKind = (): GraphEmptyStateKind => {
      const primary = resolvePrimaryEmptyStateFlags();
      const secondary = resolveSecondaryEmptyStateFlags();

      if (primary.isFetchError) {
        return 'fetch-error';
      }
      if (primary.isLoadingState) {
        return 'loading';
      }
      if (primary.isHierarchyEmpty) {
        return 'hierarchy-empty';
      }
      if (primary.isSearchEmpty) {
        return 'search-empty';
      }
      if (secondary.isVisibleNodesEmpty) {
        return resolveNoVisibleNodesEmptyStateKind();
      }
      if (secondary.isNullState) {
        return 'null-state';
      }
      if (secondary.isNoMatchingRelation) {
        return 'no-matching-relation';
      }

      return 'content';
    };

    const graphEmptyStateComponents: Partial<
      Record<GraphEmptyStateKind, () => React.ReactElement>
    > = {
      'fetch-error': FetchErrorGraphEmptyState,
      loading: LoadingGraphEmptyState,
      'hierarchy-empty': HierarchyEmptyGraphEmptyState,
      'search-empty': SearchGraphEmptyState,
      'filtered-relation-empty': NoRelationsForFilterGraphEmptyState,
      'filtered-active-empty': FilteredActiveGraphEmptyState,
      'onboarding-empty': OntologyOnboardingEmptyState,
      'no-terms-empty': NoTermsGraphEmptyState,
      'data-empty': DataLayerGraphEmptyState,
      'no-matching-relation': NoRelationsForFilterGraphEmptyState,
    };

    const emptyStateKind = resolveEmptyStateKind();
    if (emptyStateKind === 'null-state') {
      return null;
    }

    const EmptyStateComponent = graphEmptyStateComponents[emptyStateKind];
    if (EmptyStateComponent) {
      return <EmptyStateComponent />;
    }

    // Derives the props that vary between the model/data/hierarchy views of
    // OntologyGraph; isolated so its ternaries don't count against
    // renderGraphCanvas below.
    const computeGraphViewProps = () => ({
      focusNodeId:
        explorationMode === 'data' ? selectedNode?.id ?? entityId : entityId,
      hierarchyCombos:
        isHierarchyView && hierarchyGraphData
          ? hierarchyGraphData.combos.map((c) => ({
              glossaryId: c.glossaryId,
              id: c.id,
              label: c.label,
            }))
          : undefined,
      selectedNodeIdForGraph:
        explorationMode === 'data' && expandedTermIds.size > 1
          ? null
          : selectedNode?.id,
      expandedTermIdsForGraph:
        explorationMode === 'data' ? expandedTermIds : undefined,
    });

    const renderGraphCanvas = () => {
      // graphDataToShow is guaranteed non-null here: every kind
      // other than 'content' (which returns above) covers the null case.
      const graphData = graphDataToShow as NonNullable<typeof graphDataToShow>;
      const graphView = computeGraphViewProps();

      // Every drag on the graph pans it or moves a node, so it must not also
      // start a text selection.
      return (
        <div className="tw:relative tw:z-1 tw:h-full tw:w-full tw:min-h-0 tw:select-none">
          <ErrorBoundary
            fallback={
              <SomethingWentWrongPlaceholder
                className="tw:z-3"
                data-testid="ontology-graph-render-error"
                description={t('server.entity-fetch-error', {
                  entity: t('label.graph'),
                })}
              />
            }>
            {scope === 'global' && explorationMode === 'data' ? (
              <OntologyDataGraph
                data={graphData}
                glossaryColorMap={glossaryColorMap}
                hasMoreTerms={hasMoreDataTerms}
                isLoadingMoreTerms={isLoadingMore}
                relationTypes={relationTypes}
                onLoadMore={(node) =>
                  handleGraphNodeClick(node, undefined, {
                    dataModeLoadMoreBadgeClick: true,
                  })
                }
                onLoadMoreTerms={handleLoadMore}
                onPaneClick={() => {
                  setSelectedEdge(null);
                  handleGraphPaneClick();
                }}
                onSelectNode={(node) => {
                  setSelectedEdge(null);
                  handleGraphNodeClick(node);
                }}
              />
            ) : (
              <OntologyGraph
                edges={graphData.edges}
                expandedTermIds={graphView.expandedTermIdsForGraph}
                explorationMode={
                  isHierarchyView ? 'hierarchy' : explorationMode
                }
                focusNodeId={graphView.focusNodeId}
                glossaries={glossaries}
                glossaryColorMap={glossaryColorMap}
                graphSearchHighlight={graphSearchHighlight}
                hierarchyCombos={graphView.hierarchyCombos}
                nodePositions={hierarchyBakedPositions}
                nodes={graphData.nodes}
                ref={graphRef}
                relationTypes={relationTypes}
                selectedNodeId={graphView.selectedNodeIdForGraph}
                settings={settings}
                studioMode={scope === 'global'}
                onEdgeClick={handleGraphEdgeClick}
                onNodeClick={(node, position, meta) => {
                  setSelectedEdge(null);
                  handleGraphNodeClick(node, position, meta);
                }}
                onNodeDoubleClick={handleGraphNodeDoubleClick}
                onPaneClick={() => {
                  setSelectedEdge(null);
                  handleGraphPaneClick();
                }}
                onScrollNearEdge={handleScrollNearEdge}
              />
            )}
          </ErrorBoundary>
          {isLoadingMore && (
            <>
              <div className="tw:absolute tw:inset-0 tw:z-1 tw:cursor-wait" />
              <div className="tw:pointer-events-none tw:absolute tw:bottom-20 tw:left-1/2 tw:z-2 tw:-translate-x-1/2">
                <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-utility-gray-blue-100 tw:bg-primary tw:px-4 tw:py-2 tw:shadow-md">
                  <div
                    aria-label={t('label.loading')}
                    className="tw:h-4 tw:w-4 tw:animate-spin tw:rounded-full tw:border-2 tw:border-secondary tw:border-t-(--tw-color-bg-brand-solid)"
                    role="status"
                  />
                  <Typography size="text-sm" weight="medium">
                    {t('label.loading-more-terms')}
                  </Typography>
                </div>
              </div>
            </>
          )}
        </div>
      );
    };

    return renderGraphCanvas();
  };

  if (scope === 'term' && !entityId) {
    return (
      <div
        className={classNames(
          'tw:flex tw:items-center tw:justify-center tw:overflow-hidden',
          className
        )}
        data-testid="ontology-explorer-no-entity"
        style={{ height }}>
        <Typography as="p" className="tw:text-center tw:text-tertiary">
          {t('message.no-glossary-terms-found')}
        </Typography>
      </div>
    );
  }

  // Whether the graph area should show its onboarding illustration instead of
  // the toolbar + graph; isolated as an IIFE so its && chains don't add to the
  // component's own complexity.
  const showOnboardingEmptyState = (() => {
    // An empty data layer only means no term has linked assets yet; it must
    // keep the toolbar, or the layer switch back to the model goes with it.
    const hasEmptyConceptGraph =
      explorationMode === 'model' &&
      !loading &&
      graphDataToShow !== null &&
      graphDataToShow.nodes.length === 0;
    const hasNoActiveOntologyFilters =
      withoutOntologyAutocompleteAll(filters.relationTypes).length === 0 &&
      withoutOntologyAutocompleteAll(filters.glossaryIds).length === 0 &&
      filters.viewMode === 'overview' &&
      !filters.searchQuery.trim();

    return hasEmptyConceptGraph && hasNoActiveOntologyFilters;
  })();

  const renderDataModeEdgeLegend = () => (
    <Card
      className={classNames(
        'tw:absolute tw:right-4 tw:top-4 tw:flex tw:items-center tw:gap-4 tw:px-3 tw:py-2',
        ONTOLOGY_TOOLBAR_CARD_CLASS
      )}
      data-testid="ontology-data-edge-legend">
      <span className="tw:flex tw:items-center tw:gap-2">
        <span className="tw:w-7 tw:border-t-2 tw:border-dashed tw:border-brand" />
        <Typography size="text-xs" weight="medium">
          {t('label.semantic-edge-inferred')}
        </Typography>
      </span>
    </Card>
  );

  const clearSearchButton = (
    <OntologySearchClearButton
      value={searchInput}
      onClear={() => setSearchInput('')}
    />
  );

  const renderConceptSearch = () => (
    <Input
      aria-label={t('label.find-concept')}
      autoComplete="off"
      icon={SearchInputIcon}
      inputDataTestId="ontology-graph-search"
      placeholder={`${t('label.find-concept')}…`}
      size="sm"
      trailingSlot={clearSearchButton}
      value={searchInput}
      wrapperClassName="tw:absolute tw:left-3.5 tw:top-3.5 tw:z-6 tw:w-[216px]"
      onChange={setSearchInput}
    />
  );

  const renderGlobalScopeToolbar = () => (
    <>
      {explorationMode === 'model' ? renderConceptSearch() : null}
      <Tabs
        className="tw:absolute tw:right-3.5 tw:top-3.5 tw:z-6 tw:w-fit!"
        data-testid="ontology-layer-switch"
        selectedKey={explorationMode}
        onSelectionChange={handleExplorationModeSelection}>
        <Tabs.List size="sm" type="button-border">
          <Tabs.Item id="model" label={t('label.model')} />
          <Tabs.Item
            id="data"
            isDisabled={loading || isLoadingMore}
            label={t('label.data')}
          />
        </Tabs.List>
        <Tabs.Panel className="tw:hidden" id="model" />
        <Tabs.Panel className="tw:hidden" id="data" />
      </Tabs>
    </>
  );

  const renderTermScopeToolbar = () => {
    const rdfExportEnabled = Boolean(rdfEnabled && exportableGlossaryId);

    return (
      <>
        <Card
          className={classNames(
            'tw:absolute tw:bottom-4 tw:left-1/2 tw:flex tw:-translate-x-1/2 tw:items-center tw:gap-2 tw:px-3 tw:py-1.5',
            ONTOLOGY_TOOLBAR_CARD_CLASS
          )}>
          <Tabs
            className="tw:w-fit!"
            selectedKey={explorationMode}
            onSelectionChange={handleExplorationModeSelection}>
            <Tabs.List size="sm" type="button-border">
              <Tabs.Item id="model" label={t('label.model')} />
              <Tabs.Item
                className={(state) =>
                  state.isDisabled ? 'tw:cursor-not-allowed!' : ''
                }
                id="data"
                isDisabled={loading || isLoadingMore}
                label={t('label.data')}
              />
            </Tabs.List>
            <Tabs.Panel className="tw:hidden" id="model" />
            <Tabs.Panel className="tw:hidden" id="data" />
          </Tabs>
          <div className="tw:relative">
            <Search
              aria-hidden="true"
              className="tw:pointer-events-none tw:absolute tw:left-3 tw:top-1/2 tw:z-1 tw:size-5 tw:-translate-y-1/2 tw:text-fg-quaternary"
            />
            <Input
              autoComplete="off"
              data-testid="ontology-graph-search"
              inputClassName="tw:pl-10"
              placeholder={t('label.search-in-graph')}
              trailingSlot={clearSearchButton}
              value={searchInput}
              onChange={setSearchInput}
            />
          </div>
          <ExportGraphPanel
            onExportJsonLd={rdfExportEnabled ? handleExportJsonLd : undefined}
            onExportPng={handleExportPng}
            onExportRdfXml={rdfExportEnabled ? handleExportRdfXml : undefined}
            onExportSvg={handleExportSvg}
            onExportTurtle={rdfExportEnabled ? handleExportTurtle : undefined}
          />
          <GraphSettingsPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
          />
        </Card>
      </>
    );
  };

  const renderGraphControls = () => (
    <Card
      className={classNames(
        'tw:absolute tw:bottom-4 tw:z-6 tw:flex tw:items-center tw:rounded-lg',
        scope === 'global' ? 'tw:left-4' : 'tw:right-4'
      )}
      data-testid="ontology-graph-controls"
      variant="elevated">
      <OntologyControlButtons
        isLoading={loading}
        onFitToScreen={handleFitToScreen}
        onRefresh={handleRefresh}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
    </Card>
  );

  const renderDataPagination = () => (
    <Card
      className={classNames(
        'tw:absolute tw:bottom-4 tw:left-4 tw:flex tw:max-w-80 tw:flex-col tw:gap-2 tw:p-2',
        ONTOLOGY_TOOLBAR_CARD_CLASS
      )}
      data-testid="ontology-data-pagination">
      {pageableTermNodes.map((node) => (
        <Button
          color="secondary"
          data-testid={`ontology-load-more-assets-${node.id}`}
          key={node.id}
          size="sm"
          onPress={() =>
            handleGraphNodeClick(node, undefined, {
              dataModeLoadMoreBadgeClick: true,
            })
          }>
          {t('label.load-more')} · {node.label} ·{' '}
          {(node.assetCount ?? 0) - (node.loadedAssetCount ?? 0)}
        </Button>
      ))}
    </Card>
  );

  const renderGraphToolbar = () => (
    <Fragment>
      {explorationMode === 'data' && scope !== 'global'
        ? renderDataModeEdgeLegend()
        : null}
      {scope === 'global'
        ? renderGlobalScopeToolbar()
        : renderTermScopeToolbar()}
      {scope !== 'global' || explorationMode !== 'data'
        ? renderGraphControls()
        : null}
      {scope !== 'global' && pageableTermNodes.length > 0
        ? renderDataPagination()
        : null}
    </Fragment>
  );

  const renderGraphSurfaceSection = () => (
    <>
      {!showOnboardingEmptyState ? renderGraphToolbar() : null}
      <div
        className={classNames(
          DEFAULT_GRAPH_BACKDROP_CLASS,
          'tw:overflow-hidden'
        )}>
        {renderGraphContent()}
      </div>
    </>
  );

  const renderOntologyRelationsSlot = () =>
    selectedNode && !isDataAssetLikeNode(selectedNode) ? (
      <OntologyNodeRelationsContent
        edges={(filteredGraphData?.edges ?? []).filter(
          (e) => e.relationType !== ASSET_RELATION_TYPE
        )}
        node={selectedNode}
        nodes={filteredGraphData?.nodes ?? []}
        relationTypes={relationTypes}
      />
    ) : undefined;

  const renderEntityPanel = () => {
    if (!showEntityPanel || !selectedNode) {
      return null;
    }

    return (
      <OntologyEntityPanel
        afterEntityUpdate={
          selectedNode
            ? (updatedData) =>
                handleNodeDataUpdate(selectedNode.id, updatedData)
            : undefined
        }
        entityDetails={
          activeNode
            ? buildOntologySlideoutEntityDetails(activeNode)
            : { details: {} as never }
        }
        isOpen={Boolean(selectedNode)}
        key={selectedNode?.id}
        ontologyRelationsSlot={renderOntologyRelationsSlot()}
        panelPath={
          selectedNode && isDataAssetLikeNode(selectedNode)
            ? 'glossary-term-assets-tab'
            : 'ontology-explorer'
        }
        sideDrawerOverviewOnly={
          selectedNode ? isDataAssetLikeNode(selectedNode) : false
        }
        onClose={() => setSelectedNode(null)}
      />
    );
  };

  const renderRelationDetailsPanel = () => {
    if (!selectedEdge) {
      return null;
    }

    return (
      <OntologyRelationDetailsPanel
        edge={selectedEdge}
        isEditable={false}
        isSaving={false}
        key={selectedEdge.id}
        nodes={graphDataToShow?.nodes ?? []}
        relationshipTypes={relationTypes}
        onClose={() => setSelectedEdge(null)}
      />
    );
  };

  const renderConceptInspector = () => {
    if (!showConceptInspector || !selectedNode) {
      return null;
    }

    return (
      <OntologyAuthoringInspector
        edges={(filteredGraphData?.edges ?? []).filter(
          (edge) => edge.relationType !== ASSET_RELATION_TYPE
        )}
        isEditable={false}
        key={selectedNode.id}
        node={selectedNode}
        nodes={filteredGraphData?.nodes ?? []}
        relationTypes={relationTypes}
        onAssetsChange={handleRefresh}
        onClose={() => {
          setSelectedEdge(null);
          handleGraphPaneClick();
        }}
        onSelectNode={(relatedNode) => {
          setSelectedEdge(null);
          setSelectedNode(relatedNode);
        }}
        onShowFullDetails={() => handleGraphNodeDoubleClick(selectedNode)}
      />
    );
  };

  const renderExplorerContent = () => (
    <div
      className={classNames(
        'tw:flex tw:flex-col tw:overflow-hidden',
        {
          'ontology-slideout-open': Boolean(selectedNode),
        },
        className
      )}
      data-testid="ontology-explorer"
      style={{ height }}>
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:overflow-hidden tw:p-px">
        <div
          className={classNames(
            'tw:relative tw:isolate tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden',
            scope === 'global'
              ? 'tw:rounded-lg tw:border-0'
              : 'tw:rounded-lg tw:border tw:border-utility-gray-blue-100'
          )}>
          {renderGraphSurfaceSection()}
          {renderEntityPanel()}
        </div>
        {renderRelationDetailsPanel()}
        {renderConceptInspector()}
      </div>
    </div>
  );

  return renderExplorerContent();
};

export default OntologyExplorer;
