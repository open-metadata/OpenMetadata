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
  Dialog,
  Modal,
  ModalOverlay,
  Popover,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  ChevronDown,
  Link01,
  Plus,
  Search,
  Table,
} from '@openmetadata/ui-core-components/icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/type/entityReference';
import { useNativeOntologyDataGraph } from '../../../../hooks/governance/ontology/useNativeOntologyDataGraph';
import { useOntologyAssetUnlink } from '../../../../hooks/governance/ontology/useOntologyAssetUnlink';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getOntologyAssetPath } from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import {
  readDataPick,
  rememberDataPick,
} from '../../../../utils/governance/ontology/OntologyDataConceptPick.utils';
import {
  buildAssetLineagePairs,
  buildNativeDataGraph,
  NATIVE_CONTEXT_CONCEPT_LIMIT,
  toBoundColumnsByAsset,
} from '../../../../utils/governance/ontology/OntologyNativeDataGraph.utils';
import Loader from '../../../common/Loader/Loader';
import {
  BoundColumn,
  OntologyNode,
} from '../../../OntologyExplorer/OntologyExplorer.interface';
import OntologyNativeDataCanvas, {
  NativeAssetMenu,
} from '../../../OntologyExplorer/OntologyNativeDataCanvas';
import { columnNodeKey } from '../../../OntologyExplorer/utils/dataColumnLayout';
import OntologyColumnMappingStep, {
  ColumnMappingProperty,
} from '../OntologyConceptInspector/OntologyColumnMappingStep';
import OntologyDataAssetPanel from './OntologyDataAssetPanel';
import OntologyDataColumnPanel from './OntologyDataColumnPanel';
import OntologyDataConceptPicker, {
  DataPickerOption,
  OntologyDataConceptChip,
} from './OntologyDataConceptPicker';
import { AI_GRAPH_BACKDROP_CLASS } from './OntologyGraphView.constants';

const SKELETON_KEYS = [1, 2, 3, 4, 5, 6];
const CLASSIC_BACKDROP_CLASS = [
  'tw:pointer-events-none tw:absolute tw:inset-0 tw:bg-canvas tw:[background-size:22px_22px]',
  'tw:[background-image:radial-gradient(circle,var(--tw-border-color-secondary)_1px,transparent_1px)]',
].join(' ');
const ICON_TILE_CLASS =
  'tw:flex tw:size-12 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:text-fg-secondary tw:shadow-xs';
// Where the loading and error states draw the root and its neighbour, level with the canvas layout.
const STATE_ROW_CLASS =
  'tw:absolute tw:top-28 tw:left-10 tw:z-10 tw:flex tw:items-start tw:gap-11';
const CENTERED_CARD_CLASS = [
  'tw:absolute tw:top-1/2 tw:left-1/2 tw:z-10 tw:flex tw:w-96 tw:max-w-[calc(100%-2rem)]',
  'tw:-translate-x-1/2 tw:-translate-y-1/2 tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:p-6 tw:shadow-lg',
].join(' ');

interface OntologyNativeDataModeProps {
  /** Whether the person may link and unlink assets of the picked concept. */
  canEditBindings?: boolean;
  concepts: ReadonlyArray<
    Pick<DataPickerOption, 'id' | 'name' | 'parentName'> & {
      synonyms?: string[];
    }
  >;
  /** The properties a column of the concept can be bound to; without it, no column step is offered. */
  getConceptProperties?: (conceptId: string) => ColumnMappingProperty[];
  isActive?: boolean;
  ontologyId: string;
  revision?: number;
  selectedConceptId?: string;
  onSelectConcept: (conceptId: string) => void;
  /** Opens the concept panel in Edit on its data-asset link form; without it, Link data is not offered. */
  onLinkData?: (conceptId: string) => void;
  /** The asset whose panel is open, so the concept panel can mark it in its list. */
  onSelectedAssetChange?: (assetId?: string) => void;
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
  onLinkData,
  onSelectedAssetChange,
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
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const [bindAssets, setBindAssets] = useState<EntityReference[]>();
  const [panelAssetId, setPanelAssetId] = useState<string>();
  const [panelColumnKey, setPanelColumnKey] = useState<string>();
  useEffect(() => {
    onSelectedAssetChange?.(panelAssetId);
  }, [onSelectedAssetChange, panelAssetId]);

  const choose = useCallback(
    (conceptId: string | undefined, announce: boolean) => {
      setPickedId(conceptId);
      setIsPicking(false);
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
    if (!pickedCluster || pickedCluster.assetCount === 0) {
      return t('label.ontology-no-linked-data');
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
      ...(sources > 0
        ? [t('label.ontology-source-count', { count: sources })]
        : []),
      ...(columnCount > 0
        ? [t('label.bound-column-count', { count: columnCount })]
        : []),
    ].join(' · ');
  })();

  const canLink = [canEditBindings, bindings.editableSnapshot].every(Boolean);
  const linkData =
    onLinkData && pickedId
      ? () => {
          setIsPicking(false);
          onLinkData(pickedId);
        }
      : undefined;
  const conceptNode = data.nodes.find(
    (node) => node.type === 'ontologyConcept'
  );
  const assetNodes = useMemo(
    () => data.nodes.filter((node) => node.type === 'dataAsset'),
    [data.nodes]
  );
  const lineage = useMemo(
    () =>
      pickedCluster
        ? buildAssetLineagePairs(graph.topology.lineageEdges, pickedCluster)
        : [],
    [graph.topology.lineageEdges, pickedCluster]
  );
  const openAsset = useCallback(
    (node: OntologyNode) => {
      const path = node.entityRef && getOntologyAssetPath(node.entityRef);
      if (path) {
        navigate(path);
      }
    },
    [navigate]
  );
  const assetMenu: NativeAssetMenu = useMemo(
    () => ({
      canUnlink: canLink,
      conceptName: picked?.name ?? '',
      getBinding: (node) =>
        bindings.data?.assets.find(
          (item) => item.assetId === node.entityRef?.id
        ),
      onOpenAsset: openAsset,
      onUnlink: unlinkAsset,
    }),
    [bindings.data, canLink, openAsset, picked?.name, unlinkAsset]
  );

  const renderBackdrop = () => (
    <div
      aria-hidden="true"
      className={isAiMode ? AI_GRAPH_BACKDROP_CLASS : CLASSIC_BACKDROP_CLASS}
    />
  );

  const renderPicker = (isInline?: boolean) => (
    <OntologyDataConceptPicker
      concepts={pickerConcepts}
      isCountPending={isCountPending}
      isInline={isInline}
      recentIds={recentIds}
      selectedId={pickedId}
      onClose={() => setIsPicking(false)}
      onLinkData={linkData}
      onPick={(id) => choose(id, true)}
    />
  );

  const renderPickerPopover = () => (
    <Popover
      aria-label={t('label.concept-plural')}
      className="tw:w-105 tw:max-w-[calc(100vw-2rem)]"
      isOpen={isPicking}
      placement="bottom start"
      triggerRef={pickerTriggerRef}
      onOpenChange={setIsPicking}>
      {renderPicker()}
    </Popover>
  );

  const renderNoPick = () => (
    <div
      className="tw:absolute tw:top-1/2 tw:left-1/2 tw:z-10 tw:flex tw:w-105 tw:max-w-[calc(100%-2rem)] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:flex-col tw:items-center tw:gap-4 tw:text-center"
      data-testid="ontology-data-no-pick">
      <span className={ICON_TILE_CLASS}>
        <Table aria-hidden="true" className="tw:size-5" />
      </span>
      <Box align="center" direction="col" gap={1}>
        <Typography size="text-lg" weight="semibold">
          {t('message.ontology-data-pick-title')}
        </Typography>
        <Typography className="tw:max-w-75" color="secondary" size="text-sm">
          {t('message.ontology-data-pick-hint')}
        </Typography>
      </Box>
      {isPicking ? (
        renderPicker(true)
      ) : (
        <button
          aria-expanded={false}
          aria-haspopup="listbox"
          className="tw:flex tw:h-12 tw:w-full tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-primary tw:bg-surface tw:px-4 tw:text-left tw:shadow-xs"
          data-testid="ontology-data-concept-picker-trigger"
          type="button"
          onClick={() => setIsPicking(true)}>
          <Search
            aria-hidden="true"
            className="tw:size-5 tw:text-fg-quaternary"
          />
          <Typography className="tw:flex-1 tw:text-placeholder" size="text-md">
            {`${t('label.search-concepts')}…`}
          </Typography>
          <ChevronDown
            aria-hidden="true"
            className="tw:size-5 tw:text-fg-quaternary"
          />
        </button>
      )}
    </div>
  );

  const renderChip = () =>
    picked ? (
      <div className="tw:absolute tw:top-3.5 tw:left-3.5 tw:z-10">
        <OntologyDataConceptChip
          isOpen={isPicking}
          name={picked.name}
          summary={summary}
          triggerRef={pickerTriggerRef}
          onChange={() => setIsPicking((current) => !current)}
          onClear={() => choose(undefined, false)}
        />
      </div>
    ) : null;

  const renderRootPlaceholder = () =>
    picked ? (
      <div className="tw:flex tw:h-9 tw:w-51 tw:shrink-0 tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-brand tw:bg-surface tw:px-3 tw:outline-4 tw:outline-utility-blue-100">
        <span
          aria-hidden="true"
          className="tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-utility-blue-500"
        />
        <Typography ellipsis size="text-sm" weight="semibold">
          {picked.name}
        </Typography>
        <Typography
          className="tw:ml-auto tw:shrink-0 tw:uppercase"
          color="brand"
          size="text-xs"
          weight="semibold">
          {t('label.root')}
        </Typography>
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
    if (pickedCluster) {
      return (
        <Alert
          className="tw:absolute tw:top-3.5 tw:left-1/2 tw:z-10 tw:-translate-x-1/2"
          data-testid="ontology-native-data-error"
          rightContent={
            <Button color="link-color" size="xs" onPress={retry}>
              {t('label.retry')}
            </Button>
          }
          variant="error">
          {message}
        </Alert>
      );
    }

    return (
      <div className={STATE_ROW_CLASS}>
        {renderRootPlaceholder()}
        <div
          className="tw:flex tw:w-90 tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-error tw:bg-surface tw:p-4 tw:shadow-xs"
          data-testid="ontology-native-data-error"
          role="alert">
          <Box align="center" gap={2}>
            <AlertCircle
              aria-hidden="true"
              className="tw:size-4 tw:shrink-0 tw:text-fg-error-primary"
            />
            <Typography size="text-sm" weight="semibold">
              {t('message.ontology-data-error-title')}
            </Typography>
          </Box>
          <Typography color="secondary" size="text-sm">
            {message} {t('message.ontology-data-error-unchanged')}
          </Typography>
          <Box>
            <Button color="secondary" size="sm" onPress={retry}>
              {t('label.retry')}
            </Button>
          </Box>
        </div>
      </div>
    );
  };

  const renderLoading = () => {
    if (pickedCluster) {
      return (
        <div className="tw:pointer-events-none tw:absolute tw:top-3.5 tw:left-1/2 tw:z-10 tw:-translate-x-1/2">
          <Loader size="small" />
        </div>
      );
    }

    return (
      <div
        className={STATE_ROW_CLASS}
        data-testid="ontology-data-skeleton"
        role="status">
        <span className="tw:sr-only">{t('message.ontology-data-loading')}</span>
        <Skeleton height={36} variant="rounded" width={204} />
        <div className="tw:flex tw:flex-col tw:gap-2">
          {SKELETON_KEYS.map((key) => (
            <div
              className="tw:flex tw:h-13 tw:w-65 tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:px-2.5"
              key={key}>
              <Skeleton height={32} variant="rounded" width={32} />
              <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1.5">
                <Skeleton height={8} variant="rounded" width="70%" />
                <Skeleton height={6} variant="rounded" width="45%" />
              </div>
            </div>
          ))}
        </div>
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
        className="tw:absolute tw:top-1/2 tw:left-1/2 tw:z-10 tw:flex tw:w-105 tw:max-w-[calc(100%-2rem)] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:flex-col tw:items-center tw:gap-4 tw:text-center"
        data-testid="ontology-data-empty">
        <span className={ICON_TILE_CLASS}>
          <Link01 aria-hidden="true" className="tw:size-5" />
        </span>
        <Box align="center" direction="col" gap={1}>
          <Typography size="text-lg" weight="semibold">
            {t('message.ontology-data-empty-title', { name: picked.name })}
          </Typography>
          <Typography color="secondary" size="text-sm">
            {t('message.ontology-data-empty-hint')}
          </Typography>
        </Box>
        {linkData ? (
          <Button
            color="primary"
            data-testid="ontology-data-link-asset"
            iconLeading={Plus}
            size="md"
            onPress={linkData}>
            {t('label.link-data-asset')}
          </Button>
        ) : null}
      </div>
    ) : null;

  // Exactly one of the no-pick, error, loading, beyond-context and empty states shows at a time.
  const renderState = () => {
    if (!picked) {
      return renderNoPick();
    }
    if (failure) {
      return renderFailure();
    }
    if (isLoading || (isUndrawn && isCountPending)) {
      return renderLoading();
    }

    return isBeyondContext ? renderBeyondContext() : renderEmpty();
  };

  const conceptProperties = useMemo(
    () => (pickedId ? getConceptProperties?.(pickedId) ?? [] : []),
    [getConceptProperties, pickedId]
  );

  // Binding a linked table's columns, started from the asset panel.
  const renderLinkDialog = () =>
    bindAssets && picked && canEditBindings ? (
      <ModalOverlay
        isDismissable
        isOpen
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setBindAssets(undefined);
          }
        }}>
        <Modal>
          <Dialog
            aria-label={t('label.link-data-to-entity', { entity: picked.name })}
            data-testid="ontology-data-link-dialog"
            dividers="scroll"
            width={880}>
            <Dialog.Content className="tw:pb-6">
              <OntologyColumnMappingStep
                assets={bindAssets}
                conceptId={picked.id}
                conceptName={picked.name}
                properties={conceptProperties}
                onClose={() => setBindAssets(undefined)}
              />
            </Dialog.Content>
          </Dialog>
        </Modal>
      </ModalOverlay>
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
          canLink &&
          conceptProperties.length > 0 &&
          binding?.asset.type === EntityType.TABLE
        }
        canUnlink={canLink}
        conceptName={picked.name}
        node={panelNode}
        onBindColumns={() => {
          if (binding) {
            setBindAssets([binding.asset]);
          }
        }}
        onClose={clearPanel}
        onOpenAsset={() => openAsset(panelNode)}
        onUnlink={unlinkAsset}
      />
    );
  };

  const renderCanvas = () =>
    pickedCluster && conceptNode ? (
      <OntologyNativeDataCanvas
        assets={assetNodes}
        concept={conceptNode}
        isConceptSelected={selectedConceptId === pickedCluster.concept.id}
        lineage={lineage}
        menu={assetMenu}
        selectedAssetNodeId={panelNode?.id}
        selectedColumnKey={panelColumnKey}
        onLinkData={linkData}
        onLoadMore={() => loadMoreAssets(pickedCluster.concept.id)}
        onPaneClick={clearPanel}
        onSelectAsset={selectNode}
        onSelectColumn={selectColumn}
        onSelectConcept={() => onSelectConcept(pickedCluster.concept.id)}
      />
    ) : null;

  return (
    <Box
      className="tw:relative tw:h-full tw:min-h-0 tw:flex-1"
      data-testid="ontology-native-data-graph"
      direction="col">
      {renderBackdrop()}
      {renderChip()}
      {picked ? renderPickerPopover() : null}
      {renderState()}
      {renderCanvas()}
      {renderPanel()}
      {renderLinkDialog()}
    </Box>
  );
};

export default OntologyNativeDataMode;
