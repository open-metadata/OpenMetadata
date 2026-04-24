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
  Card,
  Input,
  SlideoutMenu,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchMd } from '@untitledui/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useGenericContext } from '../Customization/GenericProvider/GenericProvider';
import EntitySummaryPanel from '../Explore/EntitySummaryPanel/EntitySummaryPanel.component';
import { buildOntologySlideoutEntityDetails } from './buildOntologySlideoutEntityDetails';
import ExportGraphPanel from './ExportGraphPanel';
import FilterToolbar from './FilterToolbar';
import GraphSettingsPanel from './GraphSettingsPanel';
import {
  DEFAULT_FILTERS,
  useOntologyExplorer,
} from './hooks/useOntologyExplorer';
import OntologyControlButtons from './OntologyControlButtons';
import { withoutOntologyAutocompleteAll } from './OntologyExplorer.constants';
import {
  ExplorationMode,
  OntologyExplorerProps,
} from './OntologyExplorer.interface';
import OntologyGraph from './OntologyGraphG6';
import { OntologyNodeRelationsContent } from './OntologyNodeRelationsContent';
import {
  ASSET_NODE_TYPE,
  isDataAssetLikeNode,
  METRIC_NODE_TYPE,
} from './utils/graphBuilders';

const ONTOLOGY_GRAPH_BACKDROP_CLASS =
  'tw:absolute tw:inset-0 tw:z-0 tw:bg-primary tw:[background-image:radial-gradient(circle,rgba(148,163,184,0.22)_1px,transparent_1px)] tw:[background-size:14px_14px]';

const ONTOLOGY_TOOLBAR_CARD_CLASS =
  'tw:z-1 tw:border tw:border-utility-gray-blue-100 tw:ring-0 tw:shadow-md';

const ONTOLOGY_ENTITY_SUMMARY_SLIDEOUT_WIDTH = 576;

interface GraphEmptyStateProps {
  message: string;
  testId: string;
}

function GraphEmptyState({ message, testId }: GraphEmptyStateProps) {
  return (
    <div
      className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:flex-col tw:items-center tw:justify-center"
      data-testid={testId}>
      <Typography as="p" className="tw:text-center tw:text-tertiary">
        {message}
      </Typography>
    </div>
  );
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
    setFilters,
    setSelectedNode,
    handleZoomIn,
    handleZoomOut,
    handleFitToScreen,
    handleExportPng,
    handleExportSvg,
    handleExportTurtle,
    handleExportRdfXml,
    handleModeChange,
    handleViewModeChange,
    handleRefresh,
    handleScrollNearEdge,
    handleSettingsChange,
    handleFiltersChange,
    handleGraphNodeClick,
    handleGraphNodeDoubleClick,
    handleGraphPaneClick,
  } = useOntologyExplorer({
    scope,
    entityId,
    glossaryId,
    termGlossaryId,
    onStatsChange,
    onLoadingChange,
  });

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

    if (loading && hasNoVisibleNodes) {
      return (
        <div
          className="tw:absolute tw:inset-0 tw:z-3 tw:flex tw:flex-col tw:items-center tw:justify-center"
          data-testid="ontology-graph-loading">
          <div
            aria-label={t('label.loading')}
            className="tw:h-10 tw:w-10 tw:animate-spin tw:rounded-full tw:border-2 tw:border-border-secondary tw:border-t-(--color-bg-brand-solid)"
            role="status"
          />
          <Typography as="p" className="tw:mt-4 tw:text-tertiary">
            {t('label.loading-graph')}
          </Typography>
        </div>
      );
    }

    if (
      isHierarchyView &&
      hierarchyGraphData !== null &&
      hierarchyGraphData.edges.length === 0
    ) {
      return (
        <GraphEmptyState
          message={t('message.no-hierarchical-relations-found')}
          testId="ontology-graph-hierarchy-empty"
        />
      );
    }

    if (hasNoVisibleNodes && !loading && graphDataToShow !== null) {
      const hasActiveFilter =
        withoutOntologyAutocompleteAll(filters.glossaryIds).length > 0 ||
        hasRelationFilter;

      return (
        <GraphEmptyState
          message={
            hasRelationFilter
              ? t('message.no-relations-for-selected-filter')
              : hasActiveFilter
              ? t('message.no-data-available-for-selected-filter')
              : t('message.no-glossary-terms-found')
          }
          testId="ontology-graph-empty"
        />
      );
    }

    if (!graphDataToShow) {
      return null;
    }

    if (hasNoMatchingRelationEdges && !loading) {
      return (
        <GraphEmptyState
          message={t('message.no-relations-for-selected-filter')}
          testId="ontology-graph-no-relations"
        />
      );
    }

    return (
      <>
        {filters.searchQuery.trim() ? (
          <div
            aria-hidden
            className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-1 tw:bg-gray-950/6"
            data-testid="ontology-search-overlay"
          />
        ) : null}
        <div className="tw:relative tw:z-1 tw:h-full tw:w-full tw:min-h-0">
          <OntologyGraph
            edges={graphDataToShow.edges}
            expandedTermIds={
              explorationMode === 'data' ? expandedTermIds : undefined
            }
            explorationMode={isHierarchyView ? 'hierarchy' : explorationMode}
            focusNodeId={
              explorationMode === 'data'
                ? selectedNode?.id ?? entityId
                : entityId
            }
            glossaryColorMap={glossaryColorMap}
            graphSearchHighlight={graphSearchHighlight}
            hierarchyCombos={
              isHierarchyView && hierarchyGraphData
                ? hierarchyGraphData.combos.map((c) => ({
                    glossaryId: c.glossaryId,
                    id: c.id,
                    label: c.label,
                  }))
                : undefined
            }
            nodePositions={hierarchyBakedPositions}
            nodes={graphDataToShow.nodes}
            ref={graphRef}
            selectedNodeId={
              explorationMode === 'data' && expandedTermIds.size > 1
                ? null
                : selectedNode?.id
            }
            settings={settings}
            onNodeClick={handleGraphNodeClick}
            onNodeDoubleClick={handleGraphNodeDoubleClick}
            onPaneClick={handleGraphPaneClick}
            onScrollNearEdge={handleScrollNearEdge}
          />
          {isLoadingMore && (
            <>
              <div className="tw:absolute tw:inset-0 tw:z-1 tw:cursor-wait" />
              <div className="tw:pointer-events-none tw:absolute tw:bottom-20 tw:left-1/2 tw:z-2 tw:-translate-x-1/2">
                <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-utility-gray-blue-100 tw:bg-white tw:px-4 tw:py-2 tw:shadow-md">
                  <div
                    aria-label={t('label.loading')}
                    className="tw:h-4 tw:w-4 tw:animate-spin tw:rounded-full tw:border-2 tw:border-border-secondary tw:border-t-(--color-bg-brand-solid)"
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
      </>
    );
  };

  return (
    <div
      className={classNames(
        'tw:flex tw:flex-col tw:overflow-hidden',
        { 'ontology-slideout-open': Boolean(selectedNode) },
        className
      )}
      data-testid="ontology-explorer"
      style={{ height }}>
      {scope === 'global' && (
        <Card
          className="tw:rounded-b-none tw:border tw:border-utility-gray-blue-100 tw:px-3 tw:py-2.5 tw:ring-0 tw:shadow-none"
          data-testid="ontology-explorer-header">
          <FilterToolbar
            filters={filters}
            glossaries={glossaries}
            relationTypes={relationTypes}
            viewModeDisabled={explorationMode === 'data'}
            onClearAll={() => setFilters(DEFAULT_FILTERS)}
            onFiltersChange={handleFiltersChange}
            onViewModeChange={handleViewModeChange}
          />
        </Card>
      )}

      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:overflow-hidden">
        <div
          className={classNames(
            'tw:relative tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden',
            'tw:border tw:border-utility-gray-blue-100',
            scope === 'global'
              ? 'tw:rounded-b-lg tw:rounded-t-none tw:border-t-0'
              : 'tw:rounded-lg'
          )}>
          <Card
            className={classNames(
              'tw:absolute tw:bottom-4 tw:left-1/2 tw:flex tw:-translate-x-1/2 tw:items-center tw:gap-2 tw:px-3 tw:py-1.5',
              ONTOLOGY_TOOLBAR_CARD_CLASS
            )}>
            <Tabs
              className="tw:w-fit!"
              selectedKey={explorationMode}
              onSelectionChange={(key) => {
                if (key === 'model' || key === 'data') {
                  handleModeChange(key as ExplorationMode);
                }
              }}>
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
            <Input
              data-testid="ontology-graph-search"
              icon={SearchMd}
              inputClassName="tw:pl-10"
              placeholder={t('label.search-in-graph')}
              value={filters.searchQuery}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, searchQuery: value }))
              }
            />
            <ExportGraphPanel
              onExportPng={handleExportPng}
              onExportRdfXml={
                rdfEnabled && exportableGlossaryId
                  ? handleExportRdfXml
                  : undefined
              }
              onExportSvg={handleExportSvg}
              onExportTurtle={
                rdfEnabled && exportableGlossaryId
                  ? handleExportTurtle
                  : undefined
              }
            />
            <GraphSettingsPanel
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
          </Card>

          <Card
            className={classNames(
              'tw:absolute tw:bottom-4 tw:right-4 tw:flex tw:items-center tw:gap-1 tw:p-1',
              ONTOLOGY_TOOLBAR_CARD_CLASS
            )}>
            <OntologyControlButtons
              isLoading={loading}
              onFitToScreen={handleFitToScreen}
              onRefresh={handleRefresh}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
            />
          </Card>

          <div
            className={classNames(
              ONTOLOGY_GRAPH_BACKDROP_CLASS,
              'tw:overflow-hidden'
            )}>
            {renderGraphContent()}
          </div>

          {selectedNode && (
            <SlideoutMenu
              isDismissable
              isOpen
              className="tw:z-2"
              dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0"
              width={ONTOLOGY_ENTITY_SUMMARY_SLIDEOUT_WIDTH}
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  setSelectedNode(null);
                }
              }}>
              {({ close }) => (
                <EntitySummaryPanel
                  isSideDrawer
                  entityDetails={buildOntologySlideoutEntityDetails(
                    selectedNode
                  )}
                  handleClosePanel={() => {
                    setSelectedNode(null);
                    close();
                  }}
                  key={selectedNode.id}
                  ontologyExplorerRelationsSlot={
                    isDataAssetLikeNode(selectedNode) ? undefined : (
                      <OntologyNodeRelationsContent
                        edges={filteredGraphData?.edges ?? []}
                        node={selectedNode}
                        nodes={filteredGraphData?.nodes ?? []}
                        relationTypes={relationTypes}
                      />
                    )
                  }
                  panelPath={
                    isDataAssetLikeNode(selectedNode)
                      ? 'glossary-term-assets-tab'
                      : 'ontology-explorer'
                  }
                  sideDrawerOverviewOnly={isDataAssetLikeNode(selectedNode)}
                />
              )}
            </SlideoutMenu>
          )}
        </div>
      </div>
    </div>
  );
};

export default OntologyExplorer;
