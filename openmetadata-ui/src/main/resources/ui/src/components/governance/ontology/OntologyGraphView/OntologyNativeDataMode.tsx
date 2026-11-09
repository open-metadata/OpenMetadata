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
  Alert,
  Box,
  Button,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Database01 } from '@openmetadata/ui-core-components/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/type/entityReference';
import { useNativeOntologyDataGraph } from '../../../../hooks/governance/ontology/useNativeOntologyDataGraph';
import { useOntologyAssetLinking } from '../../../../hooks/governance/ontology/useOntologyAssetLinking';
import { useOntologyAssetUnlink } from '../../../../hooks/governance/ontology/useOntologyAssetUnlink';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import {
  getOntologyAssetPath,
  NATIVE_BINDING_ASSET_TYPES,
} from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import {
  DataPickerConcept,
  readDataPick,
  rememberDataPick,
} from '../../../../utils/governance/ontology/OntologyDataConceptPick.utils';
import {
  buildNativeDataGraph,
  NATIVE_CONTEXT_CONCEPT_LIMIT,
  toBoundColumnsByAsset,
} from '../../../../utils/governance/ontology/OntologyNativeDataGraph.utils';
import OntologyDataAssetPicker from '../../../OntologyExplorer/OntologyDataAssetPicker';
import OntologyDataGraph from '../../../OntologyExplorer/OntologyDataGraph';
import {
  BoundColumn,
  OntologyNode,
} from '../../../OntologyExplorer/OntologyExplorer.interface';
import { columnNodeKey } from '../../../OntologyExplorer/utils/dataColumnLayout';
import OntologyColumnMappingStep, {
  ColumnMappingProperty,
} from '../OntologyConceptInspector/OntologyColumnMappingStep';
import OntologyDataAssetPanel from './OntologyDataAssetPanel';
import OntologyDataColumnPanel from './OntologyDataColumnPanel';
import OntologyDataConceptPicker, {
  OntologyDataConceptChip,
} from './OntologyDataConceptPicker';
import { AI_GRAPH_BACKDROP_CLASS } from './OntologyGraphView.constants';

const NO_RELATION_TYPES: never[] = [];
const NO_COLORS: Record<string, never> = {};
const SKELETON_WIDTHS = [62, 48, 70, 55, 66, 44];
const CLASSIC_BACKDROP_CLASS = [
  'tw:pointer-events-none tw:absolute tw:inset-0 tw:bg-canvas tw:[background-size:22px_22px]',
  'tw:[background-image:radial-gradient(circle,var(--tw-border-color-secondary)_1px,transparent_1px)]',
].join(' ');
const CENTERED_CARD_CLASS = [
  'tw:absolute tw:top-1/2 tw:left-1/2 tw:z-10 tw:flex tw:w-96 tw:max-w-[calc(100%-2rem)]',
  'tw:-translate-x-1/2 tw:-translate-y-1/2 tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-6 tw:shadow-lg',
].join(' ');

interface OntologyNativeDataModeProps {
  /** Whether the person may link and unlink assets of the picked concept. */
  canEditBindings?: boolean;
  concepts: ReadonlyArray<
    Pick<DataPickerConcept, 'id' | 'name'> & { synonyms?: string[] }
  >;
  /** The properties a column of the concept can be bound to; without it, no column step is offered. */
  getConceptProperties?: (conceptId: string) => ColumnMappingProperty[];
  isActive?: boolean;
  ontologyId: string;
  revision?: number;
  selectedConceptId?: string;
  onSelectConcept: (conceptId: string) => void;
}

/**
 * Data mode shows one concept at a time: the assets bound to it and, under each
 * asset, the columns bound to its properties. The chosen concept is remembered
 * per ontology.
 */
const OntologyNativeDataMode = ({
  canEditBindings = false,
  concepts,
  getConceptProperties,
  isActive,
  ontologyId,
  revision,
  selectedConceptId,
  onSelectConcept,
}: OntologyNativeDataModeProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const navigate = useNavigate();
  const {
    failure,
    graph,
    isLoading,
    isLoadingClusters,
    loadingConceptIds,
    loadMoreAssets,
    loadMoreClusters,
    retry,
  } = useNativeOntologyDataGraph(ontologyId, { isActive, revision });
  const isKnown = useCallback(
    (id?: string) => Boolean(id && concepts.some((item) => item.id === id)),
    [concepts]
  );
  const [pickedId, setPickedId] = useState<string | undefined>(() =>
    isKnown(selectedConceptId)
      ? selectedConceptId
      : [readDataPick(ontologyId).selectedId].find(isKnown)
  );
  const [recentIds, setRecentIds] = useState(
    () => readDataPick(ontologyId).recentIds
  );
  const [isPicking, setIsPicking] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [bindAssets, setBindAssets] = useState<EntityReference[]>();
  const [panelAssetId, setPanelAssetId] = useState<string>();
  const [panelColumnKey, setPanelColumnKey] = useState<string>();

  const choose = useCallback(
    (conceptId: string | undefined, announce: boolean) => {
      setPickedId(conceptId);
      setIsPicking(false);
      setIsLinking(false);
      setBindAssets(undefined);
      setPanelAssetId(undefined);
      setPanelColumnKey(undefined);
      rememberDataPick(ontologyId, conceptId);
      setRecentIds(readDataPick(ontologyId).recentIds);
      if (conceptId && announce) {
        onSelectConcept(conceptId);
      }
    },
    [ontologyId, onSelectConcept]
  );

  // A concept chosen in Model, or from the concept panel, is the one Data shows.
  const followedId = useRef(selectedConceptId);
  useEffect(() => {
    if (followedId.current === selectedConceptId) {
      return;
    }
    followedId.current = selectedConceptId;
    if (isKnown(selectedConceptId) && selectedConceptId !== pickedId) {
      choose(selectedConceptId, false);
    }
  }, [choose, isKnown, pickedId, selectedConceptId]);

  const hasMoreClusters =
    graph.nextClusterOffset !== undefined && !graph.contextFull;
  // Picker counts and the picked cluster need every page of clusters.
  const canLoadClusters = [
    isActive,
    hasMoreClusters,
    !isLoading,
    !isLoadingClusters,
    !failure,
  ].every(Boolean);
  useEffect(() => {
    if (canLoadClusters) {
      loadMoreClusters();
    }
  }, [canLoadClusters, loadMoreClusters]);

  const picked = concepts.find((item) => item.id === pickedId);
  const pickedCluster = graph.clusters.find(
    (cluster) => cluster.concept.id === pickedId
  );
  const bindings = useOntologyConceptBindings(pickedId);
  const linking = useOntologyAssetLinking(pickedId ?? '', bindings);
  const unlinkAsset = useOntologyAssetUnlink(bindings, picked?.name ?? '');
  const boundColumns = useMemo(
    () => toBoundColumnsByAsset(bindings.data?.assets ?? []),
    [bindings.data]
  );
  const data = useMemo(
    () =>
      buildNativeDataGraph(
        {
          ...graph,
          clusters: pickedCluster ? [pickedCluster] : [],
        },
        loadingConceptIds,
        t('label.lineage'),
        boundColumns
      ),
    [boundColumns, graph, loadingConceptIds, pickedCluster, t]
  );
  const pickerConcepts = useMemo(
    () =>
      concepts.map((item) => ({
        ...item,
        assetCount: graph.clusters.find(
          (cluster) => cluster.concept.id === item.id
        )?.assetCount,
      })),
    [concepts, graph.clusters]
  );
  const isCountPending = [isLoading, hasMoreClusters, isLoadingClusters].some(
    Boolean
  );
  const isUndrawn = Boolean(picked) && !pickedCluster;
  const isBeyondContext = isUndrawn && graph.contextFull;
  const isEmpty =
    isUndrawn && [!isCountPending, !failure, !isBeyondContext].every(Boolean);
  const panelNode = data.nodes.find(
    (node) => node.type === 'dataAsset' && node.entityRef?.id === panelAssetId
  );

  const selectNode = useCallback(
    (node: OntologyNode) => {
      if (node.type === 'ontologyConcept') {
        onSelectConcept(node.id);

        return;
      }
      setPanelAssetId(node.entityRef?.id);
      setPanelColumnKey(undefined);
    },
    [onSelectConcept]
  );
  const selectColumn = useCallback(
    (asset: OntologyNode, column: BoundColumn) => {
      setPanelAssetId(asset.entityRef?.id);
      setPanelColumnKey(columnNodeKey(asset.id, column.path));
    },
    []
  );
  const clearPanel = useCallback(() => {
    setPanelAssetId(undefined);
    setPanelColumnKey(undefined);
  }, []);

  const summary = (() => {
    if (!pickedCluster) {
      return '';
    }
    const sources = new Set(
      pickedCluster.assets.flatMap((row) =>
        row.serviceType ? [row.serviceType] : []
      )
    ).size;
    const columnCount = [...boundColumns.values()].reduce(
      (total, columns) => total + columns.length,
      0
    );

    return [
      t('label.count-asset', { count: pickedCluster.assetCount }),
      ...(columnCount > 0
        ? [t('label.bound-column-count', { count: columnCount })]
        : []),
      ...(sources > 0
        ? [t('label.ontology-source-count', { count: sources })]
        : []),
    ].join(' · ');
  })();

  const renderBackdrop = () => (
    <div
      aria-hidden="true"
      className={isAiMode ? AI_GRAPH_BACKDROP_CLASS : CLASSIC_BACKDROP_CLASS}
    />
  );

  const renderPicker = () => (
    <OntologyDataConceptPicker
      concepts={pickerConcepts}
      isCountPending={isCountPending}
      recentIds={recentIds}
      onClose={picked ? () => setIsPicking(false) : undefined}
      onPick={(id) => choose(id, true)}
    />
  );

  const renderNoPick = () => (
    <div className={CENTERED_CARD_CLASS} data-testid="ontology-data-no-pick">
      <Box direction="col" gap={1}>
        <Typography size="text-md" weight="semibold">
          {t('message.ontology-data-pick-title')}
        </Typography>
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-data-pick-hint')}
        </Typography>
      </Box>
      {renderPicker()}
    </div>
  );

  const renderChip = () =>
    picked ? (
      <div className="tw:absolute tw:top-16 tw:left-3.5 tw:z-10 tw:flex tw:flex-col tw:gap-2">
        <OntologyDataConceptChip
          name={picked.name}
          summary={summary}
          onChange={() => setIsPicking((current) => !current)}
          onClear={() => choose(undefined, false)}
        />
        {isPicking ? (
          <div className="tw:w-80 tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-3 tw:shadow-lg">
            {renderPicker()}
          </div>
        ) : null}
      </div>
    ) : null;

  const renderFailure = () => {
    if (!failure) {
      return null;
    }
    const message =
      failure.reason === 'stale'
        ? t('message.ontology-data-graph-stale')
        : t('message.ontology-data-graph-unavailable');
    const retryButton = (
      <Button color="link-color" size="xs" onPress={retry}>
        {t('label.retry')}
      </Button>
    );
    if (pickedCluster) {
      return (
        <Alert
          className="tw:absolute tw:top-3.5 tw:left-1/2 tw:z-10 tw:-translate-x-1/2"
          data-testid="ontology-native-data-error"
          variant="error">
          {message}
          {retryButton}
        </Alert>
      );
    }

    return (
      <div
        className={CENTERED_CARD_CLASS}
        data-testid="ontology-native-data-error"
        role="alert">
        <Typography size="text-md" weight="semibold">
          {t('message.ontology-data-error-title')}
        </Typography>
        <Typography color="secondary" size="text-sm">
          {message} {t('message.ontology-data-error-unchanged')}
        </Typography>
        <Box>{retryButton}</Box>
      </div>
    );
  };

  const renderLoading = () => {
    if (!isLoading) {
      return null;
    }
    if (pickedCluster) {
      return (
        <Typography
          className="tw:pointer-events-none tw:absolute tw:top-3.5 tw:left-1/2 tw:z-10 tw:-translate-x-1/2"
          role="status">
          {t('label.loading')}
        </Typography>
      );
    }

    return (
      <div
        className="tw:absolute tw:top-32 tw:left-3.5 tw:z-10 tw:flex tw:w-96 tw:flex-col tw:gap-3"
        data-testid="ontology-data-skeleton"
        role="status">
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-data-loading')}
        </Typography>
        {SKELETON_WIDTHS.map((width) => (
          <Skeleton
            height={40}
            key={width}
            variant="rounded"
            width={`${width}%`}
          />
        ))}
      </div>
    );
  };

  const renderBeyondContext = () =>
    isBeyondContext ? (
      <div
        className={CENTERED_CARD_CLASS}
        data-testid="ontology-data-context-full">
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-data-context-full', {
            count: NATIVE_CONTEXT_CONCEPT_LIMIT,
          })}
        </Typography>
      </div>
    ) : null;

  const renderEmpty = () =>
    isEmpty && picked ? (
      <div
        className={`${CENTERED_CARD_CLASS} tw:items-center tw:text-center`}
        data-testid="ontology-data-empty">
        <Database01 aria-hidden="true" className="tw:size-8 tw:text-tertiary" />
        <Typography size="text-md" weight="semibold">
          {t('message.ontology-data-empty-title', { name: picked.name })}
        </Typography>
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-data-empty-hint')}
        </Typography>
        {canEditBindings ? (
          <Button
            color="primary"
            data-testid="ontology-data-link-asset"
            isDisabled={!bindings.editableSnapshot}
            size="sm"
            onPress={() => setIsLinking(true)}>
            {t('label.link-asset')}
          </Button>
        ) : null}
      </div>
    ) : null;

  const conceptProperties = useMemo(
    () => (pickedId ? getConceptProperties?.(pickedId) ?? [] : []),
    [getConceptProperties, pickedId]
  );

  const renderLinkDialogContent = (conceptName: string, synonyms?: string[]) =>
    bindAssets && pickedId ? (
      <OntologyColumnMappingStep
        assets={bindAssets}
        conceptId={pickedId}
        conceptName={conceptName}
        properties={conceptProperties}
        onClose={() => setBindAssets(undefined)}
      />
    ) : (
      <OntologyDataAssetPicker
        native={{
          assetTypes: NATIVE_BINDING_ASSET_TYPES,
          isDisabled: !bindings.editableSnapshot,
          linkedIds: (bindings.data?.assets ?? []).map(
            (binding) => binding.assetId
          ),
          saveAssets: linking.saveAssets,
          concept: { name: conceptName, synonyms },
        }}
        onCancel={() => {
          linking.cancel();
          setIsLinking(false);
        }}
        onSave={(linked) => {
          setIsLinking(false);
          const tables = linked.filter(
            (asset) => asset.type === EntityType.TABLE
          );
          if (tables.length > 0 && conceptProperties.length > 0) {
            setBindAssets(tables);
          }
        }}
      />
    );

  const isLinkDialogOpen = Boolean(isLinking || bindAssets);
  const renderLinkDialog = () =>
    isLinkDialogOpen && picked && canEditBindings ? (
      <div
        aria-label={t('label.link-asset')}
        aria-modal="true"
        className="tw:absolute tw:inset-0 tw:z-30 tw:flex tw:items-center tw:justify-center tw:bg-overlay/40 tw:p-4"
        data-testid="ontology-data-link-dialog"
        role="dialog">
        <div className="tw:max-h-full tw:w-full tw:max-w-xl tw:overflow-y-auto">
          {renderLinkDialogContent(picked.name, picked.synonyms)}
        </div>
      </div>
    ) : null;

  const renderPanel = () => {
    if (!panelNode || !picked) {
      return null;
    }
    const panelColumn = panelNode.boundColumns?.find(
      (column) => columnNodeKey(panelNode.id, column.path) === panelColumnKey
    );
    if (panelColumn) {
      return (
        <OntologyDataColumnPanel
          asset={panelNode}
          column={panelColumn}
          onClose={clearPanel}
          onOpenAsset={() => setPanelColumnKey(undefined)}
        />
      );
    }
    const binding = bindings.data?.assets.find(
      (item) => item.assetId === panelAssetId
    );

    return (
      <OntologyDataAssetPanel
        binding={binding}
        canBindColumns={
          canEditBindings &&
          Boolean(bindings.editableSnapshot) &&
          conceptProperties.length > 0 &&
          binding?.asset.type === EntityType.TABLE
        }
        canUnlink={canEditBindings && Boolean(bindings.editableSnapshot)}
        conceptName={picked.name}
        node={panelNode}
        onBindColumns={() => {
          if (binding) {
            setBindAssets([binding.asset]);
          }
        }}
        onClose={clearPanel}
        onOpenAsset={() => {
          const path =
            panelNode.entityRef && getOntologyAssetPath(panelNode.entityRef);
          if (path) {
            navigate(path);
          }
        }}
        onUnlink={unlinkAsset}
      />
    );
  };

  return (
    <Box
      className="tw:relative tw:h-full tw:min-h-0 tw:flex-1"
      data-testid="ontology-native-data-graph"
      direction="col">
      {renderBackdrop()}
      {picked ? null : renderNoPick()}
      {renderChip()}
      {renderFailure()}
      {renderLoading()}
      {renderEmpty()}
      {renderBeyondContext()}
      {pickedCluster ? (
        <OntologyDataGraph
          isSingleConcept
          data={data}
          glossaryColorMap={NO_COLORS}
          hasMoreTerms={false}
          isLoadingMoreTerms={false}
          relationTypes={NO_RELATION_TYPES}
          selectedAssetNodeId={panelNode?.id}
          selectedColumnKey={panelColumnKey}
          selectedNodeId={selectedConceptId}
          variant="native"
          onLoadMore={(node) => loadMoreAssets(node.id)}
          onLoadMoreTerms={loadMoreClusters}
          onPaneClick={clearPanel}
          onSelectColumn={selectColumn}
          onSelectNode={selectNode}
        />
      ) : null}
      {renderPanel()}
      {renderLinkDialog()}
    </Box>
  );
};

export default OntologyNativeDataMode;
