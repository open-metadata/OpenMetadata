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
import { Card } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { noop } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  Background,
  NodeMouseHandler,
  ReactFlowInstance,
  ReactFlowProvider,
} from 'reactflow';
import { LINEAGE_TAB_VIEW } from '../../../constants/Lineage.constants';
import { EntityType } from '../../../enums/entity.enum';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { getLineageDataByFQN } from '../../../rest/lineageAPI';
import {
  customEdges,
  nodeTypes,
  parseLineageData,
} from '../../../utils/EntityLineageUtils';
import { getEntityBreadcrumbs } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Loader from '../../common/Loader/Loader';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntityInfoDrawer from '../../Entity/EntityInfoDrawer/EntityInfoDrawer.component';
import CustomControlsComponent from '../../Entity/EntityLineage/CustomControls.component';
import { LineageConfig } from '../../Entity/EntityLineage/EntityLineage.interface';
import { LineageData } from '../Lineage.interface';
import { getPositionedNodesAndEdges, handleNodeClick } from './LineageNew.util';
import { useLineageStore } from './useLineageStore';

export const LineageNew = () => {
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const {
    setEntityLineage,
    setInit,
    setLoading,
    loading,
    isEditMode,
    rootEntity,
    nodes,
    edges,
    resetLineage,
    setReactFlowInstance,
    isDrawerOpen,
    selectedNode,
    setIsDrawerOpen,
  } = useLineageStore();
  const lineageDataRef = useRef<LineageData>();
  const { appPreferences } = useApplicationStore();
  const config: LineageConfig = useMemo(
    () => ({
      upstreamDepth: appPreferences?.lineageConfig?.upstreamDepth ?? 2,
      downstreamDepth: appPreferences?.lineageConfig?.downstreamDepth ?? 2,
      nodesPerLayer: 50,
    }),
    [appPreferences]
  );
  const { t } = useTranslation();
  const isFullScreen = window.location.pathname.includes('lineage/full-screen');

  const breadcrumbs = useMemo(
    () =>
      rootEntity
        ? [
            ...getEntityBreadcrumbs(rootEntity, entityType),
            {
              name: t('label.lineage'),
              url: '',
              activeTitle: true,
            },
          ]
        : [],
    [rootEntity, entityType]
  );

  const fetchEntityLineage = useCallback(
    async (fqn: string, entityType: string) => {
      // Fetch lineage data logic here

      try {
        const res = await getLineageDataByFQN({
          fqn,
          entityType,
          config,
          queryFilter: '',
        });
        // setLineageData(res);
        lineageDataRef.current = res;

        const { nodes, edges, entity } = parseLineageData(res, fqn, fqn);
        const updatedEntityLineage = {
          nodes,
          edges,
          entity,
        };

        setEntityLineage(updatedEntityLineage);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.lineage-data-lowercase'),
          })
        );
      } finally {
        setInit(true);
        setLoading(false);
      }
    },
    [fqn, entityType, config]
  );

  useEffect(() => {
    fetchEntityLineage(fqn, entityType);

    return () => resetLineage();
  }, [fetchEntityLineage]);

  const handleOnInit = useCallback(async (instance: ReactFlowInstance) => {
    await getPositionedNodesAndEdges({ entityFqn: fqn });
    setReactFlowInstance(instance);
    if (instance.viewportInitialized) {
      instance.fitView();
    }
  }, []);

  const _handleNodeClick: NodeMouseHandler = useCallback((_e, node) => {
    handleNodeClick(node);
    _e.stopPropagation();
  }, []);

  const drawer = useMemo(() => {
    if (isEditMode || !isDrawerOpen) {
      return null;
    }

    return selectedNode ? (
      <EntityInfoDrawer
        selectedNode={selectedNode}
        show={isDrawerOpen}
        onCancel={() => setIsDrawerOpen(false)}
      />
    ) : null;
  }, [isDrawerOpen, isEditMode, selectedNode]);

  if (loading) {
    return <Loader />;
  }

  return (
    <Card
      className="lineage-card border-none card-padding-0"
      data-testid="lineage-details"
      title={
        <div
          className={classNames('lineage-header', {
            'lineage-header-edit-mode': isEditMode,
          })}>
          {isFullScreen && breadcrumbs.length > 0 && (
            <TitleBreadcrumb className="p-b-lg" titleLinks={breadcrumbs} />
          )}

          <CustomControlsComponent
            activeViewTab={LINEAGE_TAB_VIEW.DIAGRAM_VIEW}
            handleActiveViewTabChange={noop}
            onlyShowTabSwitch={false}
          />
        </div>
      }>
      <div
        className="h-full relative lineage-container"
        data-testid="lineage-container"
        id="lineage-container" // ID is required for export PNG functionality
      >
        <ReactFlowProvider>
          <ReactFlow
            className="custom-react-flow"
            edgeTypes={customEdges}
            edges={edges}
            // maxZoom={MAX_ZOOM_VALUE}
            // minZoom={MIN_ZOOM_VALUE}
            nodeDragThreshold={1}
            nodeTypes={nodeTypes}
            nodes={nodes}
            nodesConnectable={isEditMode}
            onInit={handleOnInit}
            onNodeClick={_handleNodeClick}
            // onNodesChange={onNodesChange}
          >
            <Background />
          </ReactFlow>
        </ReactFlowProvider>
      </div>
      {drawer}
    </Card>
  );
};
