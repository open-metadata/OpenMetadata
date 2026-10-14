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
  Autocomplete,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { useShallow } from 'zustand/react/shallow';
import { ZOOM_TRANSITION_DURATION } from '../../../../constants/Lineage.constants';
import { LineagePlatformView } from '../../../../hooks/lineage/types';
import { useLineageStore } from '../../../../hooks/useLineageStore';
import { getEntityChildrenAndLabel } from '../../../../utils/EntityLineageNodeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import { useLineageHandlers } from '../../../Lineage/Lineage/LineageHandlersContext';

const LineageSearchSelect = () => {
  const { t } = useTranslation();
  const { onNodeClick } = useLineageHandlers();
  const { nodes, reactFlowInstance } = useLineageStore(
    useShallow((s) => ({
      nodes: s.nodes,
      reactFlowInstance: s.reactFlowInstance,
    }))
  );
  const { zoomValue, isPlatformLineage, platformView, setSelectedColumn } =
    useLineageStore();
  // Options are built on first focus: a large graph has thousands of columns.
  const [isActivated, setIsActivated] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectItemType[]>([]);

  const options = useMemo(() => {
    if (!isActivated) {
      return [];
    }
    const optionsMap = new Map<string, SelectItemType>();

    nodes.forEach((nodeObj) => {
      const { node } = nodeObj.data;
      if (!node?.fullyQualifiedName) {
        return;
      }

      const icon = (
        <img
          alt={node.serviceType}
          height="16px"
          src={serviceUtilClassBase.getServiceTypeLogo(node)}
          width="16px"
        />
      );
      const nodeName = getEntityName(node);
      optionsMap.set(node.fullyQualifiedName, {
        id: node.fullyQualifiedName,
        label: nodeName,
        icon,
      });

      const { children: childrenFlatten } = getEntityChildrenAndLabel(node);

      childrenFlatten.forEach((column) => {
        // A metric is its own column-lineage endpoint, so its only child is the
        // node itself. Both options key on FQN, so without this the child would
        // overwrite the node option added above and render the node with the
        // column-style label.
        if (
          !column.fullyQualifiedName ||
          column.fullyQualifiedName === node.fullyQualifiedName
        ) {
          return;
        }

        optionsMap.set(column.fullyQualifiedName, {
          id: column.fullyQualifiedName,
          label: getEntityName(column),
          supportingText: nodeName,
          icon,
        });
      });
    });

    return Array.from(optionsMap.values());
  }, [isActivated, nodes]);

  const onOptionSelect = useCallback(
    (value?: string) => {
      const selectedNode = nodes.find(
        (node: Node) => node.data.node.fullyQualifiedName === value
      );
      if (selectedNode) {
        onNodeClick(selectedNode);

        // Centre on what is actually drawn. LineageMap keeps the laid-out nodes
        // in its own state and feeds them to React Flow; the array reached here
        // through the provider is a different one, whose nodes are seeded at the
        // origin and never carry the ELK coordinates. Centring on those puts the
        // viewport at (0,0), and since the canvas renders with
        // onlyRenderVisibleElements, the node just picked is never drawn -- the
        // drawer opens on it while the graph sits somewhere else entirely.
        // Matching on fullyQualifiedName, the same key the lookup above uses,
        // avoids depending on the two arrays sharing node ids.
        const renderedPosition = reactFlowInstance
          ?.getNodes()
          .find(
            (node) => node.data?.node?.fullyQualifiedName === value
          )?.position;
        const { x, y } = renderedPosition ?? selectedNode.position;

        reactFlowInstance?.setCenter(x, y, {
          duration: ZOOM_TRANSITION_DURATION,
          zoom: zoomValue,
        });
      } else {
        setSelectedColumn(value ?? '');
      }
    },
    [onNodeClick, reactFlowInstance, setSelectedColumn, nodes, zoomValue]
  );

  const handleItemInserted = useCallback(
    (key: React.Key) => {
      const item = options.find((option) => option.id === key);
      setSelectedItems(item ? [item] : []);
      onOptionSelect(String(key));
    },
    [options, onOptionSelect]
  );

  const handleItemCleared = useCallback(() => {
    setSelectedItems([]);
    onOptionSelect(undefined);
  }, [onOptionSelect]);

  if (isPlatformLineage || platformView !== LineagePlatformView.None) {
    return null;
  }

  const placeholder = t('label.search-entity', {
    entity: t('label.lineage'),
  });

  return (
    <div className="tw:w-80">
      <Autocomplete
        aria-label={placeholder}
        data-testid="lineage-search"
        items={options}
        multiple={false}
        placeholder={placeholder}
        selectedItems={selectedItems}
        onFocus={() => setIsActivated(true)}
        onItemCleared={handleItemCleared}
        onItemInserted={handleItemInserted}>
        {(item) => (
          <Autocomplete.Item
            data-testid={`option-${item.id}`}
            icon={item.icon}
            id={item.id}
            key={item.id}
            label={item.label}
            supportingText={item.supportingText}
          />
        )}
      </Autocomplete>
    </div>
  );
};

export default React.memo(LineageSearchSelect);
