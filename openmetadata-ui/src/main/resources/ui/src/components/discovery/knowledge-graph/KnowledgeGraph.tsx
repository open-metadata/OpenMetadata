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

import { Card, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { toPng } from 'html-to-image';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FocusScope, useOverlay, usePreventScroll } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import 'react-reflex/styles.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../../constants/constants';
import {
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from '../../../constants/discovery/knowledge-graph.constants';
import {
  GraphSelection,
  useKnowledgeGraphCanvas,
} from '../../../hooks/discovery/knowledge-graph/useKnowledgeGraphCanvas';
import { useKnowledgeGraphData } from '../../../hooks/discovery/knowledge-graph/useKnowledgeGraphData';
import { useKnowledgeGraphExplorer } from '../../../hooks/discovery/knowledge-graph/useKnowledgeGraphExplorer';
import { downloadEntityGraph } from '../../../rest/rdfAPI';
import { EntityGraphExportFormat } from '../../../rest/rdfAPI.interface';
import { resolveCssColor } from '../../../utils/common/cssColor.utils';
import {
  getGroupRelationship,
  graphLevelToExportDepth,
  normalizeGraphLevel,
} from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import { getGraphRelationshipRows } from '../../../utils/discovery/knowledge-graph/knowledgeGraphExport.utils';
import { downloadCsv } from '../../../utils/Export/ExportUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import CustomNode from './GraphElements/CustomNode';
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

const hasGraphFilters = (filters: KnowledgeGraphFilters) =>
  [filters.entityTypes, filters.relationshipTypes].some(
    (items) => items.length > 0
  );

/** The design draws level bands only once there is a level beyond the entity itself. */
const areBandsVisible = (showBands: boolean, level: KnowledgeGraphLevel) =>
  showBands && level > 1;

const selectedNodeId = (selection: GraphSelection) =>
  selection?.kind === 'node' ? selection.id : undefined;

const selectedFamily = (selection: GraphSelection) =>
  selection?.kind === 'category' ? selection.category : null;

// This component orchestrates data, canvas, drawer, overlays and footer
// through several hooks and a few optional branches — the cyclomatic
// cost comes from being an integration site, not from branchy logic that
// should be split. Keeping it one file keeps the KG wiring reviewable in
// one read; dropping sections into child components only moves the deps
// through props.

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
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const [refresh, setRefresh] = useState(0);
  const {
    result,
    rootEntityId,
    rootEntityType,
    displayData,
    presented,
    columns,
    ontology,
    coverage,
    scene,
    counts,
    detailCounts,
  } = useKnowledgeGraphExplorer({
    entityId: entity?.id ?? '',
    entityType,
    selectedLevel,
    mode,
    filters,
    refresh,
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
    NodeComponent: CustomNode,
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
  const status = {
    failed: view.failed,
    loading: result.loading,
    partial: view.partial,
  };
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
  const hasFilters = hasGraphFilters(filters);
  useEffect(() => {
    setSelection(null);
    setExpanded([]);
    setDrawer(null);
    setRelationshipScope(null);
  }, [entity?.id, entityType, mode]);

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

  const handleZoomIn = useCallback(
    () => canvas.zoomBy(ZOOM_IN_FACTOR),
    [canvas]
  );
  const handleZoomOut = useCallback(
    () => canvas.zoomBy(ZOOM_OUT_FACTOR),
    [canvas]
  );
  const handleExtendToLevel3 = useCallback(() => setSelectedLevel(3), []);
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
    const container = canvas.container?.parentElement;
    if (!container || !canvas.ready) {
      return;
    }
    try {
      const url = await toPng(container, {
        backgroundColor: resolveCssColor('var(--color-bg-primary)', '#ffffff'),
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
  }, [canvas.container, canvas.ready]);

  const handleExportCsv = useCallback(async () => {
    const { unparse } = await import('papaparse');
    downloadCsv(
      unparse(getGraphRelationshipRows(displayData), { escapeFormulae: true }),
      'knowledge-graph-relationships.csv'
    );
  }, [displayData]);

  if (!entity) {
    return (
      <Typography>
        {t('label.no-entity-selected', { entity: t('label.asset') })}
      </Typography>
    );
  }

  // Lifted out of the JSX so stageChildren below can slot it into the
  // first ReflexElement without duplicating the bands + canvas + loader +
  // empty + view-controls block.
  const canvasContent = (
    <div className="knowledge-graph-body">
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
        data-graph-origin={canvas.viewportOrigin}
        data-ready={canvas.ready}
        data-testid="knowledge-graph-canvas"
        ref={canvas.containerRef}
        role="region"
      />
      {view.initialLoading && (
        <div className="tw:pointer-events-none tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center">
          <Loader />
        </div>
      )}
      {view.empty && (
        <KnowledgeGraphEmptyState
          hasFilters={hasFilters}
          level={view.level}
          mode={mode}
          onClearFilters={clearFilters}
          onExtend={handleExtendToLevel3}
        />
      )}
      <KnowledgeGraphViewControls
        isFullscreen={isFullscreen}
        zoom={canvas.zoom}
        onFit={handleFit}
        onFullscreen={handleFullscreen}
        onRefresh={handleRefresh}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
      />
    </div>
  );
  const detailsElement =
    drawer && displayData ? (
      <KnowledgeGraphDetails
        columns={columns}
        coverage={coverage}
        data={displayData}
        drawer={drawer}
        mode={mode}
        relationshipScope={relationshipScope}
        onClearRelationshipScope={() => setRelationshipScope(null)}
        onClose={() => setDrawer(null)}
        onDrawerChange={setDrawer}
        onRetry={handleRefresh}
        onSelect={(kind, id) =>
          kind === 'node' ? findNode(id) : setSelection({ kind, id })
        }
      />
    ) : null;
  // Precomputed children for ReflexContainer: canvas always, splitter +
  // details pane only when the drawer is open. react-reflex iterates its
  // direct children with React.Children.map (which flattens an array) to
  // clone each with `events`/`index`; the splitter and details element
  // have to be direct children for that injection to reach them. If G6
  // ever has to re-attach because the ReflexElement remounts the canvas
  // container, `useKnowledgeGraphCanvas`'s callback ref drives a fresh
  // init + draw via its `containerNode` dep.
  const stageChildren: ReactNode[] = [
    <ReflexElement
      className="kg-stage-canvas-pane"
      key="canvas"
      minSize={160}
      propagateDimensions={false}>
      {canvasContent}
    </ReflexElement>,
  ];
  if (detailsElement) {
    stageChildren.push(
      <ReflexSplitter
        className={classNames(
          'kg-stage-splitter',
          'tw:relative tw:cursor-row-resize',
          "tw:before:absolute tw:before:inset-x-0 tw:before:-inset-y-1 tw:before:content-['']"
        )}
        key="splitter"
        propagate={false}>
        {/* ReflexSplitter forwards only data-*, className, style, id and
            children — a11y attrs on the splitter are dropped, so they live
            on this child element instead. */}
        <span
          aria-label={t('label.kg-resize-details')}
          aria-orientation="horizontal"
          className="tw:sr-only"
          role="separator"
        />
      </ReflexSplitter>,
      <ReflexElement
        className="kg-stage-details-pane"
        flex={0.4}
        key="details"
        minSize={180}>
        {detailsElement}
      </ReflexElement>
    );
  }

  // Fullscreen turns the KG root into a modal dialog; non-fullscreen leaves
  // the element unlabelled so screen readers follow the surrounding page.
  const fullscreenAria = isFullscreen
    ? {
        'aria-label': t('label.knowledge-graph'),
        'aria-modal': true,
        role: 'dialog' as const,
      }
    : null;

  return (
    <FocusScope contain={isFullscreen}>
      <div
        {...overlayProps}
        {...fullscreenAria}
        className={classNames({
          // `overflow-auto` is a short-viewport safety net: once the toolbar +
          // canvas floor + drawer min stack past the viewport, the page can
          // still scroll to reach the drawer footer.
          'full-screen-knowledge-graph tw:fixed tw:inset-0 tw:z-900 tw:flex tw:flex-col tw:overflow-auto tw:bg-primary tw:p-4':
            isFullscreen,
        })}
        ref={fullscreenRef}>
        <Card
          className={classNames('knowledge-graph-container', {
            'kg-details-open': drawer,
          })}
          data-testid="knowledge-graph-container">
          <Card.Header
            className="kg-toolbar-header tw:block tw:shrink-0 tw:px-3!"
            extra={
              <KnowledgeGraphToolbar
                filterOptions={result.unfiltered?.filterOptions}
                filters={filters}
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
              <ReflexContainer
                className="kg-stage-main"
                orientation="horizontal">
                {stageChildren}
              </ReflexContainer>
              <KnowledgeGraphOverlays
                coverage={coverage}
                edges={scene.edges}
                key={entityType + ':' + entity.id}
                nodes={scene.nodes}
                selection={selection}
                tooltip={canvas.tooltip}
                onExpandGroup={expandGroup}
                onSelectionChange={setSelection}
                onViewRelationships={(groupId, scope) => {
                  if (scope) {
                    setRelationshipScope(scope);
                    setDrawer('relationships');

                    return;
                  }
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
