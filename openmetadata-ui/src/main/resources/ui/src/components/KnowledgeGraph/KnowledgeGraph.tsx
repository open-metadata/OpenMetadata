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

import { Card, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { toPng } from 'html-to-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FocusScope, useOverlay, usePreventScroll } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import {
  GraphSelection,
  useKnowledgeGraphCanvas,
} from '../../hooks/knowledge-graph/useKnowledgeGraphCanvas';
import { useKnowledgeGraphData } from '../../hooks/knowledge-graph/useKnowledgeGraphData';
import { useKnowledgeGraphExplorer } from '../../hooks/knowledge-graph/useKnowledgeGraphExplorer';
import { downloadEntityGraph } from '../../rest/rdfAPI';
import { EntityGraphExportFormat } from '../../rest/rdfAPI.interface';
import { resolveCssColor } from '../../utils/common/cssColor.utils';
import { downloadFile } from '../../utils/Export/ExportUtils';
import { getGraphRelationshipRows } from '../../utils/knowledge-graph/knowledgeGraphExport.utils';
import {
  getGroupRelationship,
  graphLevelToExportDepth,
  normalizeGraphLevel,
} from '../../utils/KnowledgeGraph.utils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from './KnowledgeGraph.constants';
import {
  KnowledgeGraphDrawer,
  KnowledgeGraphFilters,
  KnowledgeGraphLabelMode,
  KnowledgeGraphLayout,
  KnowledgeGraphLevel,
  KnowledgeGraphMode,
  KnowledgeGraphPresentation,
  KnowledgeGraphProps,
} from './KnowledgeGraph.interface';
import { RelationCategory } from './KnowledgeGraph.relations';
import './KnowledgeGraph.style.less';
import KnowledgeGraphBands from './KnowledgeGraphBands';
import KnowledgeGraphDetails from './KnowledgeGraphDetails';
import KnowledgeGraphEmptyState from './KnowledgeGraphEmptyState';
import KnowledgeGraphFooter from './KnowledgeGraphFooter';
import KnowledgeGraphLegend from './KnowledgeGraphLegend';
import KnowledgeGraphOverlays from './KnowledgeGraphOverlays';
import KnowledgeGraphStatus from './KnowledgeGraphStatus';
import KnowledgeGraphToolbar from './KnowledgeGraphToolbar';
import KnowledgeGraphViewControls from './KnowledgeGraphViewControls';

const EMPTY_FILTERS: KnowledgeGraphFilters = {
  entityTypes: [],
  relationshipTypes: [],
};

const getGraphMode = (search: string): KnowledgeGraphMode =>
  new URLSearchParams(search).get('graphMode') === 'ontology'
    ? 'ontology'
    : 'knowledge-graph';

const getGraphViewState = (
  result: ReturnType<typeof useKnowledgeGraphData>,
  canvasError: unknown,
  level: KnowledgeGraphLevel
) => {
  const data = result.data ?? { nodes: [], edges: [] };

  return {
    nodes: data.nodes,
    level,
    failed: Boolean(result.error || canvasError),
    partial: Boolean(result.data?.truncated || result.unfiltered?.truncated),
    initialLoading: !result.data && result.loading,
    empty: Boolean(result.data && data.edges.length === 0 && !result.loading),
  };
};

const hasGraphFilters = (
  filters: KnowledgeGraphFilters,
  families: RelationCategory[],
  coverage: string
) =>
  [filters.entityTypes, filters.relationshipTypes, families].some(
    (items) => items.length > 0
  ) || coverage !== 'all';

const getGraphStatus = (
  view: ReturnType<typeof getGraphViewState>,
  loading: boolean,
  mode: KnowledgeGraphMode,
  concepts: ReturnType<typeof useKnowledgeGraphExplorer>['concepts']
) => {
  const metadata =
    mode === 'ontology'
      ? concepts
      : { error: null, loading: false, partial: false };

  return {
    failed: view.failed || Boolean(metadata.error),
    loading: loading || metadata.loading,
    partial: view.partial || metadata.partial,
  };
};
/** The design draws level bands only once there is a level beyond the entity itself. */
const areBandsVisible = (showBands: boolean, level: KnowledgeGraphLevel) =>
  showBands && level > 1;

const selectedNodeId = (selection: GraphSelection) =>
  selection?.kind === 'node' ? selection.id : undefined;

const selectedFamily = (selection: GraphSelection) =>
  selection?.kind === 'category' ? selection.category : null;

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  entity,
  entityType,
  levels = 2,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState(() =>
    normalizeGraphLevel(levels)
  );
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [layout, setLayout] = useState<KnowledgeGraphLayout>('lanes');
  const [labelMode, setLabelMode] = useState<KnowledgeGraphLabelMode>('auto');
  const mode = getGraphMode(location.search);
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(true);
  const [presentation, setPresentation] =
    useState<KnowledgeGraphPresentation>('balanced');
  const [showBands, setShowBands] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<KnowledgeGraphDrawer | null>(null);
  const [relationshipScope, setRelationshipScope] = useState<{
    label: string;
    edgeIds: string[];
  } | null>(null);
  const [excludedFamilies, setExcludedFamilies] = useState<RelationCategory[]>(
    []
  );
  const [coverageMode, setCoverageMode] = useState<
    'all' | 'mapped' | 'unmapped' | 'highlight'
  >('all');
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setExcludedFamilies([]);
    setCoverageMode('all');
  };
  const [refresh, setRefresh] = useState(0);
  const {
    result,
    rootEntityId,
    rootEntityType,
    displayData,
    presented,
    columns,
    concepts,
    ontology,
    coverage,
    scene,
    counts,
    familyCounts,
    detailCounts,
  } = useKnowledgeGraphExplorer({
    entityId: entity?.id ?? '',
    entityType,
    selectedLevel,
    mode,
    filters,
    refresh,
    excludedFamilies,
    coverageMode,
    presentation,
    expanded,
    focusedNodeId: selectedNodeId(selection),
  });
  const expandGroup = useCallback((id: string) => {
    setSelection({ kind: 'node', id });
    setExpanded((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }, []);
  const isFullscreen =
    new URLSearchParams(location.search).get(FULLSCREEN_QUERY_PARAM_KEY) ===
    'true';
  const canvas = useKnowledgeGraphCanvas({
    data: presented.data,
    unfiltered: presented.unfiltered,
    mode,
    entityId: rootEntityId,
    entityType: rootEntityType,
    layout,
    labelMode,
    selection,
    fitKey: JSON.stringify([
      mode,
      selectedLevel,
      presentation,
      ontology.concept?.id,
      excludedFamilies,
      expanded,
    ]),
    viewportKey: JSON.stringify([isFullscreen, drawer !== null]),
    onSelectionChange: setSelection,
    onExpandGroup: expandGroup,
  });
  const view = getGraphViewState(
    { ...result, data: displayData },
    canvas.error,
    selectedLevel
  );
  const status = getGraphStatus(view, result.loading, mode, concepts);
  const findNode = (id: string) => {
    const group = presented.data?.nodes.find((node) =>
      node.presentation?.members?.some((member) => member.id === id)
    );
    if (group) {
      setExpanded((current) =>
        current.includes(group.id) ? current : [...current, group.id]
      );
      canvas.selectNode(id);
    } else {
      canvas.selectNode(id);
    }
  };
  const hasFilters = hasGraphFilters(filters, excludedFamilies, coverageMode);
  useEffect(() => {
    setSelection(null);
    setExpanded([]);
    setDrawer(null);
    setRelationshipScope(null);
  }, [entity?.id, entityType]);

  const handleRefresh = useCallback(() => setRefresh((value) => value + 1), []);
  const handleModeChange = useCallback(
    (nextMode: KnowledgeGraphMode) => {
      const params = new URLSearchParams(location.search);
      if (nextMode === 'ontology') {
        params.set('graphMode', nextMode);
      } else {
        params.delete('graphMode');
      }
      navigate({ search: params.toString() }, { replace: true });
    },
    [location.search, navigate]
  );
  const handleFullscreen = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (isFullscreen) {
      params.delete(FULLSCREEN_QUERY_PARAM_KEY);
    } else {
      params.set(FULLSCREEN_QUERY_PARAM_KEY, 'true');
    }
    navigate({ search: params.toString() });
  }, [isFullscreen, location.search, navigate]);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const wasFullscreen = useRef(false);
  const { overlayProps } = useOverlay(
    { isOpen: isFullscreen, onClose: handleFullscreen },
    fullscreenRef
  );
  usePreventScroll({ isDisabled: !isFullscreen });
  useEffect(() => {
    if (isFullscreen || wasFullscreen.current) {
      fullscreenRef.current
        ?.querySelector<HTMLButtonElement>(
          isFullscreen
            ? '[data-testid="exit-full-screen"]'
            : '[data-testid="full-screen"]'
        )
        ?.focus({ preventScroll: true });
    }
    wasFullscreen.current = isFullscreen;
  }, [isFullscreen]);

  const handleZoom = useCallback(
    (factor: number) => {
      const graph = canvas.graphRef.current;
      if (graph && canvas.ready) {
        void graph
          .zoomTo(graph.getZoom() * factor, false)
          .catch((error) => showErrorToast(error as AxiosError));
      }
    },
    [canvas.graphRef, canvas.ready]
  );
  const handleFit = canvas.fit;
  const handleExport = useCallback(
    async (format: EntityGraphExportFormat) => {
      if (!result.appliedQuery || !entity) {
        return;
      }
      try {
        await downloadEntityGraph({
          ...result.appliedQuery,
          depth: graphLevelToExportDepth(selectedLevel),
          format,
          entityName:
            ontology.concept?.fullyQualifiedName ??
            entity.fullyQualifiedName ??
            entity.name ??
            'knowledge-graph',
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [
      result.appliedQuery,
      entity,
      ontology.concept?.fullyQualifiedName,
      selectedLevel,
    ]
  );
  const handleExportPng = useCallback(async () => {
    const container = canvas.containerRef.current?.parentElement;
    if (!container || !canvas.ready) {
      return;
    }
    try {
      const url = await toPng(container, {
        backgroundColor: resolveCssColor(
          'var(--om-color-bg-primary)',
          '#ffffff'
        ),
        pixelRatio: 2,
        filter: (node) =>
          !(node instanceof HTMLElement) ||
          ![
            'graph-inspector',
            'knowledge-graph-edges',
            'graph-view-controls',
          ].includes(node.dataset.testid ?? ''),
      });
      const link = document.createElement('a');
      link.href = url;
      link.download = 'knowledge-graph.png';
      link.click();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [canvas.containerRef, canvas.ready]);

  const handleExportCsv = useCallback(async () => {
    const { unparse } = await import('papaparse');
    downloadFile(
      unparse(getGraphRelationshipRows(displayData), { escapeFormulae: true }),
      'knowledge-graph-relationships.csv',
      'text/csv;charset=utf-8'
    );
  }, [displayData]);

  if (!entity) {
    return (
      <Typography>
        {t('label.no-entity-selected', { entity: t('label.asset') })}
      </Typography>
    );
  }

  return (
    <FocusScope contain={isFullscreen}>
      <div
        {...overlayProps}
        aria-label={isFullscreen ? t('label.knowledge-graph') : undefined}
        aria-modal={isFullscreen || undefined}
        className={classNames({ 'full-screen-knowledge-graph': isFullscreen })}
        ref={fullscreenRef}
        role={isFullscreen ? 'dialog' : undefined}>
        <Card
          className={classNames('knowledge-graph-container', {
            'kg-details-open': drawer,
          })}
          data-testid="knowledge-graph-container">
          <Card.Header
            className="kg-toolbar-header tw:block tw:shrink-0 tw:px-3!"
            extra={
              <KnowledgeGraphToolbar
                excludedFamilies={excludedFamilies}
                familyCounts={familyCounts}
                filterOptions={result.unfiltered?.filterOptions}
                filters={filters}
                hasFilters={hasFilters}
                labelMode={labelMode}
                layout={layout}
                mode={mode}
                nodes={view.nodes}
                ontology={{
                  concepts: ontology.concepts,
                  selectedId: ontology.concept?.id,
                  onChange: ontology.onConceptChange,
                }}
                presentation={presentation}
                selectedLevel={selectedLevel}
                showBands={showBands}
                viewport={{ isFullscreen, onFullscreen: handleFullscreen }}
                onClearFilters={clearFilters}
                onExportCsv={handleExportCsv}
                onExportJsonLd={() => handleExport('jsonld')}
                onExportPng={handleExportPng}
                onExportTurtle={() => handleExport('turtle')}
                onFiltersChange={setFilters}
                onFindNode={findNode}
                onLabelModeChange={setLabelMode}
                onLayoutChange={setLayout}
                onLevelChange={setSelectedLevel}
                onModeChange={handleModeChange}
                onPresentationChange={setPresentation}
                onToggleBands={() => setShowBands((value) => !value)}
                onToggleFamily={(family) =>
                  setExcludedFamilies((current) =>
                    current.includes(family)
                      ? current.filter((item) => item !== family)
                      : [...current, family]
                  )
                }
              />
            }
          />
          <div className="kg-content">
            <KnowledgeGraphStatus
              {...status}
              data={displayData}
              mode={mode}
              onRetry={handleRefresh}
            />
            <div className="kg-stage">
              <Card.Content className="knowledge-graph-body tw:p-0">
                <KnowledgeGraphBands
                  layout={layout}
                  rings={canvas.rings}
                  showBands={areBandsVisible(showBands, selectedLevel)}
                  zoom={canvas.zoom}
                />
                <div
                  aria-busy={result.loading}
                  aria-label={t('label.knowledge-graph')}
                  className="knowledge-graph-canvas"
                  data-ready={canvas.ready}
                  data-testid="knowledge-graph-canvas"
                  ref={canvas.containerRef}
                  role="region"
                />
                {view.initialLoading && (
                  <div className="knowledge-graph-loading">
                    <Loader />
                  </div>
                )}
                {view.empty && (
                  <KnowledgeGraphEmptyState
                    hasFilters={hasFilters}
                    level={view.level}
                    mode={mode}
                    onClearFilters={clearFilters}
                    onExtend={() => setSelectedLevel(3)}
                  />
                )}
                <KnowledgeGraphViewControls
                  isFullscreen={isFullscreen}
                  zoom={canvas.zoom}
                  onFit={handleFit}
                  onFullscreen={handleFullscreen}
                  onRefresh={handleRefresh}
                  onZoomIn={() => handleZoom(ZOOM_IN_FACTOR)}
                  onZoomOut={() => handleZoom(ZOOM_OUT_FACTOR)}
                />
              </Card.Content>
              {drawer && displayData && (
                <KnowledgeGraphDetails
                  columns={columns}
                  concepts={concepts}
                  coverage={coverage}
                  coverageMode={coverageMode}
                  data={displayData}
                  drawer={drawer}
                  mode={mode}
                  relationshipScope={relationshipScope}
                  onClearRelationshipScope={() => setRelationshipScope(null)}
                  onClose={() => setDrawer(null)}
                  onCoverageMode={setCoverageMode}
                  onDrawerChange={setDrawer}
                  onRetry={handleRefresh}
                  onSelect={(kind, id) =>
                    kind === 'node' ? findNode(id) : setSelection({ kind, id })
                  }
                />
              )}
              <KnowledgeGraphOverlays
                edges={scene.edges}
                key={entityType + ':' + entity.id}
                nodes={scene.nodes}
                rootId={rootEntityId}
                selection={selection}
                tooltip={canvas.tooltip}
                onExpandGroup={expandGroup}
                onSelectionChange={setSelection}
                onViewRelationships={(groupId) => {
                  const group = scene.nodes.find((node) => node.id === groupId);
                  const bundle = getGroupRelationship(group, scene.edges);
                  setRelationshipScope(
                    bundle?.data.members
                      ? {
                          label: bundle.data.label,
                          edgeIds: bundle.data.members.flatMap((edge) =>
                            edge.id ? [edge.id] : []
                          ),
                        }
                      : null
                  );
                  setDrawer('relationships');
                }}
              />
            </div>
            <KnowledgeGraphFooter
              data={presented.data}
              details={{
                active: drawer,
                counts: detailCounts,
                onChange: (next) => {
                  setRelationshipScope(null);
                  setDrawer((current) => (current === next ? null : next));
                },
              }}
              expanded={expanded}
              labelMode={labelMode}
              level={selectedLevel}
              mode={mode}
              presentation={presentation}
              onCollapse={() => setExpanded([])}>
              <KnowledgeGraphLegend
                counts={counts}
                hiddenCount={excludedFamilies.length}
                isCollapsed={legendCollapsed}
                selectedCategory={selectedFamily(selection)}
                onSelectCategory={(category) =>
                  setSelection(
                    selection?.kind === 'category' &&
                      selection.category === category
                      ? null
                      : { kind: 'category', category }
                  )
                }
                onToggleCollapsed={() => setLegendCollapsed((value) => !value)}
              />
            </KnowledgeGraphFooter>
          </div>
        </Card>
      </div>
    </FocusScope>
  );
};

export default KnowledgeGraph;
