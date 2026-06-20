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

import { AxiosError } from 'axios';
import classNames from 'classnames';
import Qs from 'qs';
import {
  FC,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as ExitFullScreenIcon } from '../../assets/svg/ic-exit-fullscreen.svg';
import { ReactComponent as FullscreenIcon } from '../../assets/svg/ic-fullscreen.svg';
import { ReactComponent as LineageIcon } from '../../assets/svg/ic-platform-lineage.svg';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { getEntityGraphData } from '../../rest/rdfAPI';
import { GraphData } from '../../rest/rdfAPI.interface';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import { STAGE_BACKDROP } from './KnowledgeGraph3D.constants';
import {
  KnowledgeGraph3DProps,
  KnowledgeGraph3DSceneProps,
} from './KnowledgeGraph3D.interface';
import './KnowledgeGraph3D.less';
import { idOf, linkKey, viewGraph } from './KnowledgeGraph3D.utils';
import KnowledgeGraph3DControls from './KnowledgeGraph3DControls';
import KnowledgeGraph3DEdgePanel from './KnowledgeGraph3DEdgePanel';
import KnowledgeGraph3DLegend from './KnowledgeGraph3DLegend';
import KnowledgeGraph3DPanel, { TYPE_LABEL_KEY } from './KnowledgeGraph3DPanel';
import {
  adaptRdfGraph,
  enrichWithEntityFields,
  RELATION_LABEL_KEYS,
} from './rdfGraphAdapter';
import { GraphLink3D, GraphNode3D, Lens, Level } from './types';

const KnowledgeGraph3DScene = lazy(() => import('./KnowledgeGraph3DScene'));

/** Asset types whose child fields are called "fields" rather than "columns". */
const FIELD_ASSET_TYPES = new Set<string>(['topic', 'searchIndex']);

const downloadDataUrl = (dataUrl: string): void => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = 'knowledge-graph.png';
  link.click();
};

const KnowledgeGraph3D: FC<KnowledgeGraph3DProps> = ({
  entity,
  entityType,
  depth = 1,
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { preferences } = useCurrentUserPreferences();

  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<GraphData | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(depth);
  const [level, setLevel] = useState<Level>('asset');
  const [lens, setLens] = useState<Lens>('all');
  const [gaps, setGaps] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink3D | null>(null);

  const resetViewRef = useRef<(() => void) | null>(null);
  const exportImageRef = useRef<(() => Promise<string | null>) | null>(null);

  const base = useMemo(() => adaptRdfGraph(rawData), [rawData]);
  const adapted = useMemo(
    () => (showColumns ? enrichWithEntityFields(base, entity) : base),
    [base, entity, showColumns]
  );
  const columnsToggleLabel = useMemo(
    () =>
      FIELD_ASSET_TYPES.has(entityType)
        ? t('label.show-field-plural')
        : t('label.show-column-plural'),
    [entityType, t]
  );
  const view = useMemo(
    () => viewGraph(adapted, level, lens),
    [adapted, level, lens]
  );
  const nodesById = useMemo(
    () => new Map(adapted.nodes.map((node) => [node.id, node])),
    [adapted.nodes]
  );
  const selectedNode = useMemo(
    () => (selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null),
    [nodesById, selectedNodeId]
  );
  const selectedLinkKey = useMemo(
    () => (selectedLink ? linkKey(selectedLink) : null),
    [selectedLink]
  );
  const selectedEdge = useMemo(() => {
    let result = null;
    if (selectedLink) {
      const source = nodesById.get(idOf(selectedLink.source));
      const target = nodesById.get(idOf(selectedLink.target));
      if (source && target) {
        result = { link: selectedLink, source, target };
      }
    }

    return result;
  }, [selectedLink, nodesById]);

  const getNodeTooltip = useCallback<
    NonNullable<KnowledgeGraph3DSceneProps['getNodeTooltip']>
  >((node) => `${node.name} · ${t(TYPE_LABEL_KEY[node.type])}`, [t]);

  const getLinkTooltip = useCallback<
    NonNullable<KnowledgeGraph3DSceneProps['getLinkTooltip']>
  >(
    (link) =>
      RELATION_LABEL_KEYS[link.label]
        ? t(RELATION_LABEL_KEYS[link.label])
        : link.label,
    [t]
  );

  const isFullscreen = useMemo(() => {
    const params = Qs.parse(location.search, { ignoreQueryPrefix: true });

    return params[FULLSCREEN_QUERY_PARAM_KEY] === 'true';
  }, [location.search]);

  const caption = useMemo(() => {
    const total = view.nodes.length;
    const description = t(`message.knowledge-graph-level-${level}-description`);
    const lensSuffix =
      lens === 'all' ? '' : t(`message.knowledge-graph-lens-${lens}-suffix`);

    return {
      total,
      description: description + lensSuffix,
      truncated: Boolean(rawData?.truncated),
    };
  }, [view.nodes.length, level, lens, t, rawData?.truncated]);

  useEffect(() => {
    if (!entity?.id) {
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    const run = async (): Promise<void> => {
      try {
        const data = await getEntityGraphData(
          { entityId: entity.id, entityType, depth: selectedDepth },
          { signal: controller.signal }
        );
        setRawData(data);
      } catch (error) {
        // A superseded request (depth/entity changed, or unmount) aborts; that
        // is expected, not a user-facing error.
        if (!controller.signal.aborted) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    run();

    return () => controller.abort();
  }, [entity?.id, entityType, selectedDepth]);

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedLink(null);
  }, []);

  const handleDepthChange = useCallback(
    (next: number) => {
      clearSelection();
      setSelectedDepth(next);
    },
    [clearSelection]
  );

  const handleLevelChange = useCallback(
    (next: Level) => {
      clearSelection();
      setLevel(next);
    },
    [clearSelection]
  );

  const handleLensChange = useCallback(
    (next: Lens) => {
      clearSelection();
      setLens(next);
    },
    [clearSelection]
  );

  const handleSelectNode = useCallback((node: GraphNode3D | null) => {
    setSelectedLink(null);
    setSelectedNodeId(node?.id ?? null);
  }, []);

  const handleSelectLink = useCallback((link: GraphLink3D | null) => {
    setSelectedNodeId(null);
    setSelectedLink(link);
  }, []);

  const handleResetView = useCallback(() => {
    resetViewRef.current?.();
  }, []);

  const handleExport = useCallback(async () => {
    const exportImage = exportImageRef.current;
    if (!exportImage) {
      return;
    }
    const dataUrl = await exportImage();
    if (dataUrl) {
      downloadDataUrl(dataUrl);
    } else {
      showErrorToast(t('server.unexpected-error'));
    }
  }, [t]);

  const handleFullscreen = useCallback(() => {
    navigate({
      search: isFullscreen
        ? ''
        : Qs.stringify({ [FULLSCREEN_QUERY_PARAM_KEY]: true }),
    });
  }, [isFullscreen, navigate]);

  const registerResetView = useCallback<
    NonNullable<KnowledgeGraph3DSceneProps['registerResetView']>
  >((fn) => {
    resetViewRef.current = fn;
  }, []);

  const registerExportImage = useCallback<
    NonNullable<KnowledgeGraph3DSceneProps['registerExportImage']>
  >((fn) => {
    exportImageRef.current = fn;
  }, []);

  if (!entity) {
    return (
      <ErrorPlaceHolder
        className="tw:h-full"
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        {t('label.no-entity-selected', { entity: t('label.asset') })}
      </ErrorPlaceHolder>
    );
  }

  const isEmpty = !loading && adapted.nodes.length === 0;
  const hasGraph = !loading && adapted.nodes.length > 0;

  return (
    <div
      className={classNames('knowledge-graph-3d', {
        'full-screen-knowledge-graph-3d': isFullscreen,
        'sidebar-collapsed': isFullscreen && preferences?.isSidebarCollapsed,
        'sidebar-expanded': isFullscreen && !preferences?.isSidebarCollapsed,
      })}
      data-testid="knowledge-graph-3d">
      <KnowledgeGraph3DControls
        columnsToggleLabel={columnsToggleLabel}
        depth={selectedDepth}
        gaps={gaps}
        hasGraph={hasGraph}
        lens={lens}
        level={level}
        showColumns={showColumns}
        onDepthChange={handleDepthChange}
        onExport={handleExport}
        onGapsChange={setGaps}
        onLensChange={handleLensChange}
        onLevelChange={handleLevelChange}
        onResetView={handleResetView}
        onShowColumnsChange={setShowColumns}
      />

      <div className="knowledge-graph-3d-caption">
        <span className="knowledge-graph-3d-scope">
          {t(
            `label.${
              level === 'asset'
                ? 'data-asset'
                : level === 'product'
                ? 'data-product'
                : 'domain'
            }`
          )}{' '}
          {t('label.level')}
        </span>
        <span className="knowledge-graph-3d-caption-sep">·</span>
        <span className="knowledge-graph-3d-caption-count">
          {t('message.knowledge-graph-node-count', { count: caption.total })}
        </span>
        <span className="knowledge-graph-3d-caption-sep">·</span>
        <span className="knowledge-graph-3d-caption-desc">
          {caption.description}
        </span>
        {caption.truncated && (
          <>
            <span className="knowledge-graph-3d-caption-sep">·</span>
            <span
              className="knowledge-graph-3d-caption-truncated"
              data-testid="knowledge-graph-3d-truncated">
              {t('message.knowledge-graph-truncated')}
            </span>
          </>
        )}
      </div>

      <div
        className="knowledge-graph-3d-stage"
        style={{ background: STAGE_BACKDROP }}>
        {isEmpty ? (
          <ErrorPlaceHolder
            className="knowledge-graph-3d-empty"
            icon={<LineageIcon height={SIZE.LARGE} width={SIZE.LARGE} />}
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            {t('message.no-knowledge-graph-data')}
          </ErrorPlaceHolder>
        ) : (
          <ErrorBoundary
            fallbackRender={() => (
              <ErrorPlaceHolder
                className="knowledge-graph-3d-empty"
                icon={<LineageIcon height={SIZE.LARGE} width={SIZE.LARGE} />}
                type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                {t('message.knowledge-graph-3d-webgl-unavailable')}
              </ErrorPlaceHolder>
            )}>
            <Suspense fallback={<Loader />}>
              <KnowledgeGraph3DScene
                data={view}
                gaps={gaps}
                getLinkTooltip={getLinkTooltip}
                getNodeTooltip={getNodeTooltip}
                level={level}
                registerExportImage={registerExportImage}
                registerResetView={registerResetView}
                selectedLinkKey={selectedLinkKey}
                selectedNodeId={selectedNodeId}
                onSelectLink={handleSelectLink}
                onSelectNode={handleSelectNode}
              />
            </Suspense>

            <KnowledgeGraph3DLegend />

            <div className="kg3d-hint tw:pointer-events-none tw:absolute tw:top-4 tw:right-4 tw:rounded-lg tw:border tw:border-white/10 tw:px-3 tw:py-2 tw:text-xs">
              {t('message.knowledge-graph-3d-hint')}
            </div>

            <button
              aria-label={t(
                isFullscreen ? 'label.exit-full-screen' : 'label.full-screen'
              )}
              className="kg3d-fullscreen-btn"
              data-testid={isFullscreen ? 'exit-full-screen' : 'full-screen'}
              type="button"
              onClick={handleFullscreen}>
              {isFullscreen ? <ExitFullScreenIcon /> : <FullscreenIcon />}
            </button>

            {selectedEdge ? (
              <KnowledgeGraph3DEdgePanel
                link={selectedEdge.link}
                source={selectedEdge.source}
                target={selectedEdge.target}
                onClose={clearSelection}
                onSelectNode={handleSelectNode}
              />
            ) : (
              selectedNode && (
                <KnowledgeGraph3DPanel
                  graph={adapted}
                  node={selectedNode}
                  onClose={clearSelection}
                />
              )
            )}
          </ErrorBoundary>
        )}

        {loading && (
          <div className="knowledge-graph-3d-loading">
            <Loader />
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeGraph3D;
