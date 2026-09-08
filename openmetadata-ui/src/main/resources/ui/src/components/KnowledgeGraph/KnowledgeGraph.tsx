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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import {
  GraphSelection,
  useKnowledgeGraphCanvas,
} from '../../hooks/knowledge-graph/useKnowledgeGraphCanvas';
import { useKnowledgeGraphData } from '../../hooks/knowledge-graph/useKnowledgeGraphData';
import { downloadEntityGraph } from '../../rest/rdfAPI';
import { EntityGraphExportFormat } from '../../rest/rdfAPI.interface';
import { resolveCssColor } from '../../utils/common/cssColor.utils';
import { getEntityBreadcrumbs } from '../../utils/EntityBreadcrumbPureUtils';
import {
  countRelationCategories,
  getFullscreenClassNames,
  graphLevelToDepth,
  normalizeGraphLevel,
  transformToG6Format,
} from '../../utils/KnowledgeGraph.utils';
import { showErrorToast } from '../../utils/ToastUtils';
import Loader from '../common/Loader/Loader';
import TitleBreadcrumb from '../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import {
  FIT_SCALE_FACTOR,
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from './KnowledgeGraph.constants';
import {
  KnowledgeGraphFilters,
  KnowledgeGraphLabelMode,
  KnowledgeGraphLayout,
  KnowledgeGraphProps,
} from './KnowledgeGraph.interface';
import './KnowledgeGraph.style.less';
import KnowledgeGraphEmptyState from './KnowledgeGraphEmptyState';
import KnowledgeGraphLegend from './KnowledgeGraphLegend';
import KnowledgeGraphOverlays from './KnowledgeGraphOverlays';
import KnowledgeGraphStatus from './KnowledgeGraphStatus';
import KnowledgeGraphToolbar from './KnowledgeGraphToolbar';
import KnowledgeGraphViewControls from './KnowledgeGraphViewControls';

const EMPTY_FILTERS: KnowledgeGraphFilters = {
  entityTypes: [],
  relationshipTypes: [],
};

const getGraphViewState = (
  result: ReturnType<typeof useKnowledgeGraphData>,
  canvasError: unknown
) => {
  const data = result.data ?? { nodes: [], edges: [] };

  return {
    nodes: data.nodes,
    level: (result.appliedQuery?.depth ?? 1) + 1,
    failed: Boolean(result.error || canvasError),
    partial: Boolean(result.data?.truncated || result.unfiltered?.truncated),
    initialLoading: !result.data && result.loading,
    empty: Boolean(result.data && data.edges.length === 0 && !result.loading),
  };
};

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  entity,
  entityType,
  levels = 2,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { preferences } = useCurrentUserPreferences();
  const [selectedLevel, setSelectedLevel] = useState(() =>
    normalizeGraphLevel(levels)
  );
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [layout, setLayout] = useState<KnowledgeGraphLayout>('radial');
  const [labelMode, setLabelMode] = useState<KnowledgeGraphLabelMode>('auto');
  const [selection, setSelection] = useState<GraphSelection>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const query = useMemo(
    () => ({
      entityId: entity?.id ?? '',
      entityType,
      depth: graphLevelToDepth(selectedLevel),
      entityTypes: filters.entityTypes,
      relationshipTypes: filters.relationshipTypes,
    }),
    [entity?.id, entityType, selectedLevel, filters]
  );
  const result = useKnowledgeGraphData(query, refresh);
  const canvas = useKnowledgeGraphCanvas({
    data: result.data,
    unfiltered: result.unfiltered,
    entityId: entity?.id ?? '',
    entityType,
    layout,
    labelMode,
    selection,
    onSelectionChange: setSelection,
  });
  const view = getGraphViewState(result, canvas.error);
  const scene = useMemo(() => transformToG6Format(result.data), [result.data]);
  const counts = useMemo(
    () => countRelationCategories(result.data),
    [result.data]
  );
  const isFullscreen =
    new URLSearchParams(location.search).get(FULLSCREEN_QUERY_PARAM_KEY) ===
    'true';
  const hasFilters =
    filters.entityTypes.length > 0 || filters.relationshipTypes.length > 0;
  const breadcrumbs = useMemo(
    () =>
      entity?.fullyQualifiedName
        ? [
            ...getEntityBreadcrumbs(
              entity as SearchedDataProps['data'][number]['_source'],
              entityType as EntityType,
              isFullscreen
            ),
            { name: t('label.knowledge-graph'), url: '', activeTitle: true },
          ]
        : [],
    [entity, entityType, isFullscreen, t]
  );

  useEffect(() => {
    setSelection(null);
  }, [entity?.id, entityType]);

  const handleRefresh = useCallback(() => setRefresh((value) => value + 1), []);
  const handleFullscreen = useCallback(() => {
    const params = new URLSearchParams(location.search);
    if (isFullscreen) {
      params.delete(FULLSCREEN_QUERY_PARAM_KEY);
    } else {
      params.set(FULLSCREEN_QUERY_PARAM_KEY, 'true');
    }
    navigate({ search: params.toString() });
  }, [isFullscreen, location.search, navigate]);
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
  const handleFit = useCallback(() => {
    const graph = canvas.graphRef.current;
    if (graph && canvas.ready) {
      void graph
        .fitView()
        .then(() => {
          if (!graph.destroyed) {
            return graph.zoomTo(graph.getZoom() * FIT_SCALE_FACTOR, false);
          }

          return undefined;
        })
        .catch((error) => showErrorToast(error as AxiosError));
    }
  }, [canvas.graphRef, canvas.ready]);
  const handleExport = useCallback(
    async (format: EntityGraphExportFormat) => {
      if (!result.appliedQuery || !entity) {
        return;
      }
      try {
        await downloadEntityGraph({
          ...result.appliedQuery,
          format,
          entityName:
            entity.fullyQualifiedName ?? entity.name ?? 'knowledge-graph',
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [result.appliedQuery, entity]
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

  if (!entity) {
    return (
      <Typography>
        {t('label.no-entity-selected', { entity: t('label.asset') })}
      </Typography>
    );
  }

  return (
    <div
      className={classNames(
        getFullscreenClassNames(isFullscreen, preferences?.isSidebarCollapsed)
      )}>
      {isFullscreen && breadcrumbs.length > 0 && (
        <TitleBreadcrumb
          useCustomArrow
          className="tw:mb-2"
          titleLinks={breadcrumbs}
        />
      )}
      <Card
        className="knowledge-graph-container"
        data-testid="knowledge-graph-container">
        <Card.Header
          className="tw:block tw:shrink-0"
          extra={
            <KnowledgeGraphToolbar
              filterOptions={result.unfiltered?.filterOptions}
              filters={filters}
              labelMode={labelMode}
              layout={layout}
              nodes={view.nodes}
              selectedLevel={selectedLevel}
              onExportJsonLd={() => handleExport('jsonld')}
              onExportPng={handleExportPng}
              onExportTurtle={() => handleExport('turtle')}
              onFiltersChange={setFilters}
              onFindNode={canvas.selectNode}
              onLabelModeChange={setLabelMode}
              onLayoutChange={setLayout}
              onLevelChange={setSelectedLevel}
            />
          }
        />
        <KnowledgeGraphStatus
          data={result.data}
          failed={view.failed}
          level={view.level}
          loading={result.loading}
          partial={Boolean(
            result.data?.truncated || result.unfiltered?.truncated
          )}
          onRetry={handleRefresh}
        />
        <Card.Content className="knowledge-graph-body tw:p-0">
          <svg
            aria-hidden="true"
            className="kg-level-rings"
            data-testid="graph-level-rings">
            {canvas.rings.map((ring) => (
              <g data-testid={'graph-ring-' + ring.level} key={ring.level}>
                <ellipse
                  cx={ring.x}
                  cy={ring.y}
                  fill="none"
                  rx={ring.radiusX}
                  ry={ring.radiusY}
                  stroke="var(--om-color-border-secondary)"
                  strokeDasharray="4 6"
                />
              </g>
            ))}
          </svg>
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
              onClearFilters={() => setFilters(EMPTY_FILTERS)}
            />
          )}
          <KnowledgeGraphOverlays
            edges={scene.edges}
            key={entityType + ':' + entity.id}
            nodes={view.nodes}
            selection={selection}
            tooltip={canvas.tooltip}
            onSelectionChange={setSelection}
          />
          <KnowledgeGraphViewControls
            isFullscreen={isFullscreen}
            onFit={handleFit}
            onFullscreen={handleFullscreen}
            onRefresh={handleRefresh}
            onZoomIn={() => handleZoom(ZOOM_IN_FACTOR)}
            onZoomOut={() => handleZoom(ZOOM_OUT_FACTOR)}
          />
        </Card.Content>
        <KnowledgeGraphLegend
          counts={counts}
          isCollapsed={legendCollapsed}
          selectedCategory={
            selection?.kind === 'category' ? selection.category : null
          }
          onSelectCategory={(category) =>
            setSelection(
              selection?.kind === 'category' && selection.category === category
                ? null
                : { kind: 'category', category }
            )
          }
          onToggleCollapsed={() => setLegendCollapsed((value) => !value)}
        />
      </Card>
    </div>
  );
};

export default KnowledgeGraph;
