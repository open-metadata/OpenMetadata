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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  SlideoutMenu,
} from '@openmetadata/ui-core-components';
import { Home02 } from '@untitledui/icons';
import { LoadingState } from 'Models';
import { lazy, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Edge, Node } from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import { FULLSCREEN_QUERY_PARAM_KEY } from '../../../constants/constants';
import { EntityReference } from '../../../generated/type/entityLineage';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { LineageConfig } from '../../../interface/lineage.interface';
import { SourceType } from '../../../interface/source.interface';
import { getEntityBreadcrumbs } from '../../../utils/EntityBreadcrumbPureUtils';
import { getModalBodyText } from '../../../utils/EntityLineageEdgeUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleLink } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import EdgeInfoDrawer from '../../Entity/EntityInfoDrawer/EdgeInfoDrawer.component';
import AddPipeLineModal from '../../Entity/EntityLineage/AppPipelineModel/AddPipeLineModal';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () =>
      import('../../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);

// Bundles the pipeline entity selected in the AddPipeLineModal so Task 17's
// handler can decide how to persist it. There is no richer "selected edge
// info" payload upstream today - the modal only ever hands back an
// (optional) pipeline EntityReference.
export type SelectedEdgeInfo = EntityReference;

export type LineageOverlaysHandlers = {
  onConfirmDelete: () => void | Promise<void>;
  onConfirmAddEdge: (pipeline?: SelectedEdgeInfo) => void | Promise<void>;
  onEntityUpdate: (updatedEntity: SourceType) => Promise<void>;
  onCloseDrawer: () => void;
};

type LineageOverlaysProps = {
  handlers: LineageOverlaysHandlers;
};

type LineageBreadcrumbsProps = {
  breadcrumbs: TitleLink[];
  isFullScreen: boolean;
};

const LineageBreadcrumbs = ({
  breadcrumbs,
  isFullScreen,
}: LineageBreadcrumbsProps) => {
  if (!isFullScreen || breadcrumbs.length === 0) {
    return null;
  }

  return (
    <TitleBreadcrumb
      useCustomArrow
      className="p-b-sm"
      titleLinks={breadcrumbs}
    />
  );
};

type LineageDrawerOverlayProps = {
  isEditMode: boolean;
  selectedNode?: SourceType;
  selectedEdge?: Edge;
  isDrawerOpen: boolean;
  nodes: Node[];
  lineageConfig: LineageConfig;
  onCloseDrawer: () => void;
  onEntityUpdate: (updatedEntity: Partial<SourceType>) => void;
};

const LineageDrawerOverlay = ({
  isEditMode,
  selectedNode,
  selectedEdge,
  isDrawerOpen,
  nodes,
  lineageConfig,
  onCloseDrawer,
  onEntityUpdate,
}: LineageDrawerOverlayProps) => {
  if (isEditMode || (!selectedNode && !selectedEdge)) {
    return null;
  }

  return (
    <SlideoutMenu
      isDismissable
      className="tw:z-999"
      data-testid="lineage-entity-panel"
      dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0 lineage-entity-panel"
      isOpen={isDrawerOpen}
      width={576}
      onOpenChange={(open) => {
        if (!open) {
          onCloseDrawer();
        }
      }}>
      {selectedNode && (
        <EntitySummaryPanel
          isSideDrawer
          downstreamDepth={lineageConfig.downstreamDepth}
          entityDetails={{ details: selectedNode }}
          handleClosePanel={onCloseDrawer}
          nodesPerLayer={lineageConfig.nodesPerLayer}
          panelPath="lineage"
          pipelineViewMode={lineageConfig.pipelineViewMode}
          upstreamDepth={lineageConfig.upstreamDepth}
          onEntityUpdate={onEntityUpdate}
        />
      )}
      {selectedEdge && (
        <EdgeInfoDrawer
          hasEditAccess
          visible
          edge={selectedEdge}
          nodes={nodes}
          onClose={onCloseDrawer}
        />
      )}
    </SlideoutMenu>
  );
};

type LineageDeleteModalProps = {
  showDeleteModal: boolean;
  selectedEdge?: Edge;
  deletionState: { loading: boolean; status: LoadingState };
  onClose: () => void;
  onConfirm: () => void;
};

const LineageDeleteModal = ({
  showDeleteModal,
  selectedEdge,
  deletionState,
  onClose,
  onConfirm,
}: LineageDeleteModalProps) => {
  const { t } = useTranslation();

  if (!showDeleteModal || !selectedEdge) {
    return null;
  }

  return (
    <ModalOverlay
      isDismissable={!deletionState.loading}
      isOpen={showDeleteModal}
      style={{ zIndex: 999 }}
      onOpenChange={(open) => {
        if (!open && !deletionState.loading) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog data-testid="delete-edge-confirmation-modal" width={400}>
          <Dialog.Header title={t('message.remove-lineage-edge')} />
          <Dialog.Content>{getModalBodyText(selectedEdge)}</Dialog.Content>
          <Dialog.Footer>
            <Button
              color="tertiary"
              data-testid="cancel-button"
              onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="confirm-button"
              isDisabled={deletionState.loading}
              isLoading={deletionState.loading}
              onPress={onConfirm}>
              {t('label.confirm')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export const LineageOverlays: React.FC<LineageOverlaysProps> = ({
  handlers,
}) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const isFullScreen =
    new URLSearchParams(location.search).get(FULLSCREEN_QUERY_PARAM_KEY) ===
    'true';

  const {
    isEditMode,
    lineageConfig,
    selectedNode,
    selectedEdge,
    setSelectedEdge,
    isDrawerOpen,
    nodes,
    showDeleteModal,
    deletionState,
    closeDeleteModal,
    showAddEdgeModal,
    closeAddEdgeModal,
    openDeleteModal,
    sceneBand,
    loading,
    status,
    entity,
    entityType,
    platformView,
  } = useLineageStore(
    useShallow((state) => ({
      isEditMode: state.isEditMode,
      lineageConfig: state.lineageConfig,
      selectedNode: state.selectedNode,
      selectedEdge: state.selectedEdge,
      setSelectedEdge: state.setSelectedEdge,
      isDrawerOpen: state.isDrawerOpen,
      nodes: state.nodes,
      showDeleteModal: state.showDeleteModal,
      deletionState: state.deletionState,
      closeDeleteModal: state.closeDeleteModal,
      showAddEdgeModal: state.showAddEdgeModal,
      closeAddEdgeModal: state.closeAddEdgeModal,
      openDeleteModal: state.openDeleteModal,
      sceneBand: state.sceneBand,
      loading: state.loading,
      status: state.status,
      entity: state.entity,
      entityType: state.entityType,
      platformView: state.platformView,
    }))
  );

  const breadcrumbs = useMemo(() => {
    const platformBreadcrumbs = platformView
      ? [
          {
            name: '',
            icon: <Home02 size={12} />,
            url: '/',
            activeTitle: true,
          },
          {
            name: t('label.lineage'),
            url: '',
          },
        ]
      : [];

    return entity
      ? [
          ...getEntityBreadcrumbs(entity, entityType, isFullScreen),
          {
            name: t('label.lineage'),
            url: '',
            activeTitle: true,
          },
        ]
      : platformBreadcrumbs;
  }, [entity, isFullScreen, entityType, platformView, t]);

  const handleEntityUpdate = useCallback(
    (updatedEntity: Partial<SourceType>) => {
      void handlers.onEntityUpdate({
        ...selectedNode,
        ...updatedEntity,
      } as SourceType);
    },
    [handlers, selectedNode]
  );

  const handleModalCancel = useCallback(() => {
    closeAddEdgeModal();
    setSelectedEdge(undefined);
  }, [closeAddEdgeModal, setSelectedEdge]);

  const handleRemoveEdgeClick = useCallback(() => {
    openDeleteModal();
    closeAddEdgeModal();
  }, [openDeleteModal, closeAddEdgeModal]);

  const handleAddPipelineModalSave = useCallback(
    (pipelineData?: EntityReference) => {
      void handlers.onConfirmAddEdge(pipelineData);
    },
    [handlers]
  );

  const handleConfirmDelete = useCallback(() => {
    void handlers.onConfirmDelete();
  }, [handlers]);

  return (
    <>
      <LineageBreadcrumbs
        breadcrumbs={breadcrumbs}
        isFullScreen={isFullScreen}
      />
      <LineageDrawerOverlay
        isDrawerOpen={isDrawerOpen}
        isEditMode={isEditMode}
        lineageConfig={lineageConfig}
        nodes={nodes}
        selectedEdge={selectedEdge}
        selectedNode={selectedNode}
        onCloseDrawer={handlers.onCloseDrawer}
        onEntityUpdate={handleEntityUpdate}
      />
      <LineageDeleteModal
        deletionState={deletionState}
        selectedEdge={selectedEdge}
        showDeleteModal={showDeleteModal}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
      />
      {showAddEdgeModal && (
        <AddPipeLineModal
          loading={sceneBand === undefined ? loading : status === 'waiting'}
          selectedEdge={selectedEdge}
          showAddEdgeModal={showAddEdgeModal}
          onModalCancel={handleModalCancel}
          onRemoveEdgeClick={handleRemoveEdgeClick}
          onSave={handleAddPipelineModalSave}
        />
      )}
    </>
  );
};

export default LineageOverlays;
