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
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { SearchMd } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { addTermRelation } from '../../rest/glossaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useGenericContext } from '../Customization/GenericProvider/GenericContext';
import { buildOntologySlideoutEntityDetails } from './buildOntologySlideoutEntityDetails';
import ExportGraphPanel from './ExportGraphPanel';
import GraphSettingsPanel from './GraphSettingsPanel';
import { useOntologyExplorer } from './hooks/useOntologyExplorer';
import OntologyControlButtons from './OntologyControlButtons';
import { OntologyEntityPanel } from './OntologyEntityPanel';
import { withoutOntologyAutocompleteAll } from './OntologyExplorer.constants';
import {
  ExplorationMode,
  OntologyExplorerProps,
} from './OntologyExplorer.interface';
import OntologyGraph from './OntologyGraphG6';
import OntologyHealthPanel from './OntologyHealthPanel';
import { OntologyNodeRelationsContent } from './OntologyNodeRelationsContent';
import {
  buildOntologyTreeGroups,
  getOntologyHealthSummary,
} from './OntologyStudio.utils';
import OntologyTermEditor from './OntologyTermEditor';
import OntologyTreeView from './OntologyTreeView';
import {
  ASSET_NODE_TYPE,
  ASSET_RELATION_TYPE,
  isDataAssetLikeNode,
  METRIC_NODE_TYPE,
} from './utils/graphBuilders';

const DEFAULT_GRAPH_BACKDROP_CLASS =
  'tw:absolute tw:inset-0 tw:z-0 tw:bg-primary tw:[background-image:radial-gradient(circle,rgba(148,163,184,0.22)_1px,transparent_1px)] tw:[background-size:14px_14px]';
const STUDIO_GRAPH_BACKDROP_CLASS =
  'tw:absolute tw:inset-0 tw:z-0 tw:bg-white tw:[background-image:radial-gradient(circle,#E4E4E7_1px,transparent_1px)] tw:[background-size:22px_22px]';

const ONTOLOGY_TOOLBAR_CARD_CLASS =
  'tw:z-6 tw:border tw:border-utility-gray-blue-100 tw:ring-0 tw:shadow-md';

interface GraphEmptyStateProps {
  readonly message: string;
  readonly testId: string;
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
  isEditMode = false,
  surface = 'graph',
  showHealth = false,
  globalGlossaryIds,
  onStatsChange,
  onLoadingChange,
  onGlossariesChange,
  onGraphDataChange,
  onRelationTypesChange,
  onRequestEdit,
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
    combinedGraphData,
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
    handleExportJsonLd,
    handleModeChange,
    handleRefresh,
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
  const lastSelectedNodeRef = useRef(selectedNode);
  if (selectedNode) {
    lastSelectedNodeRef.current = selectedNode;
  }
  const activeNode = selectedNode ?? lastSelectedNodeRef.current;
  const searchInputRef = useRef(searchInput);
  searchInputRef.current = searchInput;

  const healthSummary = useMemo(
    () => getOntologyHealthSummary(combinedGraphData, filters),
    [combinedGraphData, filters]
  );
  const treeGroups = useMemo(
    () =>
      buildOntologyTreeGroups(
        combinedGraphData,
        filters,
        glossaries,
        relationTypes
      ),
    [combinedGraphData, filters, glossaries, relationTypes]
  );

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

  useEffect(() => {
    if (scope !== 'global' || !globalGlossaryIds) {
      return;
    }

    setFilters((previousFilters) => {
      if (
        previousFilters.glossaryIds.length === globalGlossaryIds.length &&
        previousFilters.glossaryIds.every(
          (glossaryId, index) => glossaryId === globalGlossaryIds[index]
        )
      ) {
        return previousFilters;
      }

      return { ...previousFilters, glossaryIds: globalGlossaryIds };
    });
  }, [globalGlossaryIds, scope, setFilters]);

  useEffect(() => {
    onGlossariesChange?.(glossaries);
  }, [glossaries, onGlossariesChange]);

  useEffect(() => {
    if (combinedGraphData) {
      onGraphDataChange?.(combinedGraphData);
    }
  }, [combinedGraphData, onGraphDataChange]);

  useEffect(() => {
    onRelationTypesChange?.(relationTypes);
  }, [onRelationTypesChange, relationTypes]);

  const handleCreateRelation = useCallback(
    async (fromId: string, toId: string, relationType: string) => {
      try {
        await addTermRelation(fromId, {
          relationType,
          term: { id: toId, type: EntityType.GLOSSARY_TERM },
        });
        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.relationship'),
          })
        );
        handleRefresh();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [handleRefresh, t]
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

    if (fetchError && !loading && !graphDataToShow) {
      return (
        <GraphEmptyState
          message={t('server.entity-fetch-error', {
            entity: t('label.graph'),
          })}
          testId="ontology-graph-error"
        />
      );
    }

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
      if (hasRelationFilter) {
        return (
          <GraphEmptyState
            message={t('message.no-relations-for-selected-filter')}
            testId="ontology-graph-no-relations"
          />
        );
      }

      const hasActiveFilter =
        withoutOntologyAutocompleteAll(filters.glossaryIds).length > 0;

      return (
        <GraphEmptyState
          message={
            hasActiveFilter
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
      <div className="tw:relative tw:z-1 tw:h-full tw:w-full tw:min-h-0">
        <ErrorBoundary
          fallback={
            <GraphEmptyState
              message={t('server.entity-fetch-error', {
                entity: t('label.graph'),
              })}
              testId="ontology-graph-render-error"
            />
          }>
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
            glossaries={glossaries}
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
            isEditMode={isEditMode}
            nodePositions={hierarchyBakedPositions}
            nodes={graphDataToShow.nodes}
            ref={graphRef}
            relationTypes={relationTypes}
            selectedNodeId={
              explorationMode === 'data' && expandedTermIds.size > 1
                ? null
                : selectedNode?.id
            }
            settings={settings}
            studioMode={scope === 'global'}
            onCreateRelation={handleCreateRelation}
            onNodeClick={handleGraphNodeClick}
            onNodeDoubleClick={handleGraphNodeDoubleClick}
            onPaneClick={handleGraphPaneClick}
            onScrollNearEdge={handleScrollNearEdge}
          />
        </ErrorBoundary>
        {isLoadingMore && (
          <>
            <div className="tw:absolute tw:inset-0 tw:z-1 tw:cursor-wait" />
            <div className="tw:pointer-events-none tw:absolute tw:bottom-20 tw:left-1/2 tw:z-2 tw:-translate-x-1/2">
              <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-full tw:border tw:border-utility-gray-blue-100 tw:bg-primary tw:px-4 tw:py-2 tw:shadow-md">
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
    );
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

  return (
    <div
      className={classNames(
        'tw:flex tw:flex-col tw:overflow-hidden',
        { 'ontology-slideout-open': Boolean(selectedNode) },
        className
      )}
      data-testid="ontology-explorer"
      style={{ height }}>
      <div className="tw:flex tw:min-h-0 tw:flex-1 tw:overflow-hidden">
        <div
          className={classNames(
            'tw:relative tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-hidden',
            scope === 'global'
              ? 'tw:border-0'
              : 'tw:rounded-lg tw:border tw:border-utility-gray-blue-100'
          )}>
          {surface === 'graph' ? (
            <>
              {explorationMode === 'data' ? (
                <Card
                  className={classNames(
                    'tw:absolute tw:right-4 tw:top-4 tw:flex tw:items-center tw:gap-4 tw:px-3 tw:py-2',
                    ONTOLOGY_TOOLBAR_CARD_CLASS
                  )}
                  data-testid="ontology-data-edge-legend">
                  <span className="tw:flex tw:items-center tw:gap-2">
                    <span className="tw:w-7 tw:border-t-2 tw:border-dashed tw:border-brand-solid" />
                    <Typography size="text-xs" weight="medium">
                      {t('label.semantic-edge-inferred')}
                    </Typography>
                  </span>
                  <span className="tw:flex tw:items-center tw:gap-2">
                    <span className="tw:w-7 tw:border-t-2 tw:border-tertiary" />
                    <Typography size="text-xs" weight="medium">
                      {t('label.observed-lineage')}
                    </Typography>
                  </span>
                </Card>
              ) : null}
              {scope === 'global' ? (
                <label
                  className={classNames(
                    'tw:absolute tw:left-3.5 tw:top-3.5 tw:z-6 tw:flex tw:w-[216px] tw:items-center',
                    'tw:gap-[7px] tw:rounded-[9px] tw:border tw:border-gray-200 tw:bg-white tw:px-2.5',
                    'tw:py-[7px] tw:shadow-[0_2px_8px_-2px_rgba(10,13,18,0.12)]'
                  )}>
                  <SearchMd
                    aria-hidden="true"
                    className="tw:size-3.5 tw:shrink-0 tw:text-gray-500"
                  />
                  <input
                    className={classNames(
                      'tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:p-0 tw:font-body',
                      'tw:text-xs tw:leading-[normal] tw:font-normal tw:text-gray-900 tw:outline-none',
                      'tw:placeholder:text-gray-400'
                    )}
                    data-testid="ontology-graph-search"
                    placeholder={`${t('label.find-concept')}\u2026`}
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                </label>
              ) : (
                <>
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
                      value={searchInput}
                      onChange={setSearchInput}
                    />
                    <ExportGraphPanel
                      onExportJsonLd={
                        rdfEnabled && exportableGlossaryId
                          ? handleExportJsonLd
                          : undefined
                      }
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
                </>
              )}

              <Card
                className={classNames(
                  'tw:absolute tw:bottom-4 tw:right-4 tw:flex tw:items-center tw:gap-1 tw:p-1',
                  ONTOLOGY_TOOLBAR_CARD_CLASS
                )}
                data-testid="ontology-graph-controls">
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
                  scope === 'global'
                    ? STUDIO_GRAPH_BACKDROP_CLASS
                    : DEFAULT_GRAPH_BACKDROP_CLASS,
                  'tw:overflow-hidden'
                )}>
                {renderGraphContent()}
              </div>
            </>
          ) : surface === 'tree' ? (
            <OntologyTreeView
              groups={treeGroups}
              selectedNodeId={selectedNode?.id}
              onSelect={setSelectedNode}
            />
          ) : (
            <OntologyTermEditor
              edges={(filteredGraphData?.edges ?? []).filter(
                (edge) => edge.relationType !== ASSET_RELATION_TYPE
              )}
              nodes={filteredGraphData?.nodes ?? []}
              relationTypes={relationTypes}
              selectedNode={selectedNode}
              onCreateRelation={handleCreateRelation}
              onSelectNode={setSelectedNode}
            />
          )}

          {surface !== 'term' ? (
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
              ontologyRelationsSlot={
                selectedNode && !isDataAssetLikeNode(selectedNode) ? (
                  <OntologyNodeRelationsContent
                    edges={(filteredGraphData?.edges ?? []).filter(
                      (e) => e.relationType !== ASSET_RELATION_TYPE
                    )}
                    isEditMode={isEditMode}
                    node={selectedNode}
                    nodes={filteredGraphData?.nodes ?? []}
                    relationTypes={relationTypes}
                  />
                ) : undefined
              }
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
          ) : null}
        </div>
        {showHealth ? (
          <OntologyHealthPanel
            health={healthSummary}
            onConnect={(node) => {
              setSelectedNode(node);
              onRequestEdit?.();
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default OntologyExplorer;
