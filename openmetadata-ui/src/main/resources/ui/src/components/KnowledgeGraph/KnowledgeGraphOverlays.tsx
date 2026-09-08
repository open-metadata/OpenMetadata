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

import { EdgeData } from '@antv/g6';
import {
  Box,
  Button,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { GraphSelection } from '../../hooks/knowledge-graph/useKnowledgeGraphCanvas';
import { getEntityLinkFromType } from '../../utils/EntityLinkUtils';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import { SearchSourceDetails } from '../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';
import { ENTITY_UUID_REGEX, PANEL_WIDTH } from './KnowledgeGraph.constants';
import { EdgeTooltipState, GraphNode } from './KnowledgeGraph.interface';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () => import('../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);

interface InspectorProps {
  nodes: GraphNode[];
  edges: EdgeData[];
  selection: GraphSelection;
  tooltip: EdgeTooltipState | null;
  onSelectionChange: (selection: GraphSelection) => void;
}

const KnowledgeGraphOverlays = ({
  nodes,
  edges,
  selection,
  tooltip,
  onSelectionChange,
}: InspectorProps) => {
  const { t } = useTranslation();
  const [detailsNode, setDetailsNode] = useState<GraphNode | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const closeInspector = () => {
    onSelectionChange(null);
    requestAnimationFrame(() => {
      if (returnFocusRef.current?.isConnected) {
        returnFocusRef.current.focus({ preventScroll: true });
      }
    });
  };
  const nodeMap = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const { selectedNode, selectedEdge, connections, inspectorOpen } =
    useMemo(() => {
      const selectedNode =
        selection?.kind === 'node' ? nodeMap.get(selection.id) : undefined;
      const selectedEdge =
        selection?.kind === 'edge'
          ? edges.find((edge) => edge.id === selection.id)
          : undefined;
      const connections = selectedNode
        ? edges.filter(
            (edge) =>
              edge.source === selectedNode.id || edge.target === selectedNode.id
          )
        : [];

      return {
        selectedNode,
        selectedEdge,
        connections,
        inspectorOpen: Boolean(selectedNode || selectedEdge),
      };
    }, [selection, nodeMap, edges]);
  useEffect(() => {
    if (inspectorOpen) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    }
  }, [inspectorOpen]);
  const nodeLink = (node?: GraphNode) =>
    node?.fullyQualifiedName ? (
      <Button
        className="tw:whitespace-normal tw:break-words tw:text-left"
        color="link-color"
        href={getEntityLinkFromType(
          node.fullyQualifiedName,
          node.type as EntityType
        )}
        rel="noopener noreferrer"
        size="sm"
        target="_blank">
        {node.label}
      </Button>
    ) : (
      <Typography size="text-sm">{node?.label ?? ''}</Typography>
    );

  return (
    <>
      <div
        aria-hidden="true"
        className="tw:hidden"
        data-testid="knowledge-graph-edges">
        {edges.map((edge) => (
          <div
            data-edge-id={edge.id}
            data-edge-label={String(edge.data?.label ?? '')}
            data-edge-source={edge.source}
            data-edge-target={edge.target}
            data-testid={
              'edge-' +
              (nodeMap.get(edge.source)?.label ?? edge.source) +
              '-' +
              String(edge.data?.label ?? '') +
              '-' +
              (nodeMap.get(edge.target)?.label ?? edge.target)
            }
            key={edge.id}
          />
        ))}
      </div>
      {tooltip && (
        <div
          aria-hidden="true"
          className="kg-edge-tooltip"
          data-testid="edge-tooltip"
          style={{
            position: 'fixed',
            left: Math.min(tooltip.x + 12, window.innerWidth - 300),
            top: Math.min(tooltip.y + 12, window.innerHeight - 100),
          }}>
          <div className="kg-edge-tooltip__direction">
            {tooltip.sourceLabel + ' → ' + tooltip.targetLabel}
          </div>
          {tooltip.labels.map((label) => (
            <div className="kg-edge-tooltip__label" key={label}>
              {label}
            </div>
          ))}
        </div>
      )}
      {inspectorOpen && (
        <Box
          aria-label={t('label.kg-inspector')}
          aria-modal={false}
          className="kg-inspector"
          data-testid="graph-inspector"
          direction="col"
          role="dialog"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeInspector();
            }
          }}>
          <Box align="center" gap={2} justify="between">
            <h3
              className="tw:m-0 tw:text-sm tw:font-semibold tw:text-primary tw:break-words"
              ref={headingRef}
              tabIndex={-1}>
              {selectedNode?.label ?? t('label.relationship')}
            </h3>
            <Button
              aria-label={t('label.close')}
              color="tertiary"
              iconLeading={XClose}
              size="sm"
              onPress={closeInspector}
            />
          </Box>
          {selectedEdge && (
            <Box className="tw:mt-3" direction="col" gap={2}>
              {nodeLink(nodeMap.get(selectedEdge.source))}
              <Typography size="text-sm" weight="semibold">
                {'→ ' + String(selectedEdge.data?.label ?? '') + ' →'}
              </Typography>
              {nodeLink(nodeMap.get(selectedEdge.target))}
            </Box>
          )}
          {selectedNode && (
            <>
              <Box className="tw:my-2" gap={3} wrap="wrap">
                {selectedNode.fullyQualifiedName && (
                  <Button
                    color="link-color"
                    size="sm"
                    onPress={() => setDetailsNode(selectedNode)}>
                    {t('label.kg-view-details')}
                  </Button>
                )}
                {nodeLink(selectedNode)}
              </Box>
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('label.kg-connection-count', { count: connections.length })}
              </Typography>
              <ul className="tw:m-0 tw:mt-2 tw:list-none tw:p-0">
                {connections.map((edge) => (
                  <li key={edge.id} style={{ contentVisibility: 'auto' }}>
                    <Button
                      className="tw:w-full tw:justify-start tw:whitespace-normal tw:text-left"
                      color="tertiary"
                      size="sm"
                      onPress={() => {
                        onSelectionChange({
                          kind: 'edge',
                          id: String(edge.id),
                        });
                        requestAnimationFrame(() =>
                          headingRef.current?.focus()
                        );
                      }}>
                      {(nodeMap.get(edge.source)?.label ?? edge.source) +
                        ' → ' +
                        String(edge.data?.label ?? '') +
                        ' → ' +
                        (nodeMap.get(edge.target)?.label ?? edge.target)}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Box>
      )}
      {detailsNode?.fullyQualifiedName && (
        <SlideoutMenu
          isDismissable
          isOpen
          className="tw:z-1100"
          dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0"
          width={PANEL_WIDTH}
          onOpenChange={(open) => {
            if (!open) {
              setDetailsNode(null);
            }
          }}>
          {({ close }) => (
            <EntitySummaryPanel
              isSideDrawer
              entityDetails={{
                details: {
                  id:
                    ENTITY_UUID_REGEX.exec(detailsNode.id)?.[1] ??
                    detailsNode.id,
                  fullyQualifiedName: detailsNode.fullyQualifiedName,
                  entityType: detailsNode.type as EntityType,
                  name: detailsNode.name ?? detailsNode.label,
                  displayName: detailsNode.label,
                } as SearchSourceDetails,
              }}
              handleClosePanel={() => {
                setDetailsNode(null);
                close();
              }}
            />
          )}
        </SlideoutMenu>
      )}
    </>
  );
};

export default KnowledgeGraphOverlays;
