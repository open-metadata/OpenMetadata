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

import {
  Box,
  Button,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { Link01, XClose } from '@untitledui/icons';
import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { GraphSelection } from '../../hooks/knowledge-graph/useKnowledgeGraphCanvas';
import {
  getGraphNodeHref,
  isGraphColumnNode,
} from '../../utils/knowledge-graph/knowledgeGraphNavigation.utils';
import {
  getColorSetForType,
  resolveFocusNodeId,
} from '../../utils/KnowledgeGraph.utils';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import { SearchSourceDetails } from '../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';
import { getNodeTypeLabel } from './GraphElements/CustomNode';
import { ENTITY_UUID_REGEX, PANEL_WIDTH } from './KnowledgeGraph.constants';
import {
  EdgeTooltipState,
  GraphNode,
  KnowledgeGraphG6Edge,
} from './KnowledgeGraph.interface';
import KnowledgeGraphGroupInspector from './KnowledgeGraphGroupInspector';
import {
  entityTile,
  InspectorRow,
  InspectorSection,
  InspectorStatement,
  relationTile,
} from './KnowledgeGraphInspectorParts';
import KnowledgeGraphRelationship from './KnowledgeGraphRelationship';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () => import('../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);

const edgeArrow = (derived: boolean, outgoing: boolean) => {
  if (derived) {
    return '— ';
  }

  return outgoing ? '→ ' : '← ';
};

const getInspectorSubtitle = (
  t: (key: string, options?: Record<string, unknown>) => string,
  node?: GraphNode,
  edge?: KnowledgeGraphG6Edge
) => {
  if (node?.presentation?.members) {
    return t('label.kg-bundle-subtitle', {
      count: node.presentation.members.length,
    });
  }
  if (node) {
    const type = getNodeTypeLabel(node.type, t);

    return node.presentation?.root
      ? type + ' · ' + t('label.kg-starting-entity')
      : type;
  }

  return t(
    edge?.data.derivation ? 'label.ontology-inferred' : 'label.relationship'
  );
};

const getInspectorTile = (node?: GraphNode, edge?: KnowledgeGraphG6Edge) =>
  node
    ? entityTile(node.type)
    : relationTile(edge?.data.category ?? 'other', Link01);

const canPreviewNode = (node: GraphNode) =>
  Boolean(node.fullyQualifiedName) && !isGraphColumnNode(node);

const getInspectorTitle = (node?: GraphNode, edge?: KnowledgeGraphG6Edge) =>
  node?.presentation?.predicate ?? node?.label ?? edge?.data.label;

interface InspectorProps {
  nodes: GraphNode[];
  edges: KnowledgeGraphG6Edge[];
  /** The entity the graph is centred on; its label anchors the statements. */
  rootId: string;
  selection: GraphSelection;
  tooltip: EdgeTooltipState | null;
  onSelectionChange: (selection: GraphSelection) => void;
  onExpandGroup?: (id: string) => void;
  onViewRelationships?: (groupId?: string) => void;
}

interface NodeInspectorProps
  extends Pick<
    InspectorProps,
    'onSelectionChange' | 'onExpandGroup' | 'onViewRelationships'
  > {
  node: GraphNode;
  root?: GraphNode;
  connections: KnowledgeGraphG6Edge[];
  nodeMap: Map<string, GraphNode>;
  nodeHref: string;
  onDetails: (node: GraphNode) => void;
}
const GraphNodeInspector = ({
  node,
  root,
  connections,
  nodeMap,
  nodeHref,
  onDetails,
  onSelectionChange,
  onViewRelationships,
}: NodeInspectorProps) => {
  const { t } = useTranslation();
  const typeLabel = getNodeTypeLabel(node.type, t);
  const isRoot = Boolean(node.presentation?.root);
  const statement = isRoot
    ? t('message.kg-root-statement', { count: connections.length })
    : t('message.kg-node-statement', {
        type: typeLabel,
        root: root?.label ?? '',
      });

  return (
    <>
      <Box className="kg-inspector-body" direction="col">
        <InspectorStatement
          code={node.fullyQualifiedName}
          color={getColorSetForType(node.type).main}
          family={typeLabel}
          statement={statement}
        />
        {node.description && (
          <Typography className="tw:text-tertiary" size="text-xs">
            {node.description}
          </Typography>
        )}
        {node.ontologyProperty && (
          <InspectorSection title={t('label.details')}>
            <Typography
              className="tw:break-all tw:text-secondary"
              size="text-sm">
              {t('label.kg-range') + ': ' + node.ontologyProperty.range}
            </Typography>
            <Typography className="tw:text-secondary" size="text-sm">
              {t('label.kg-cardinality') +
                ': ' +
                t(
                  node.ontologyProperty.functional
                    ? 'label.kg-at-most-one'
                    : 'label.kg-not-declared'
                )}
            </Typography>
          </InspectorSection>
        )}
        <InspectorSection
          meta={t('label.kg-in-view', { count: connections.length })}
          title={t('label.relationship-plural')}>
          {connections.slice(0, 8).map((edge) => {
            const otherId = edge.source === node.id ? edge.target : edge.source;
            const other = nodeMap.get(otherId);
            const arrow = edgeArrow(
              Boolean(edge.data.derivation),
              edge.source === node.id
            );

            return (
              <InspectorRow
                detail={arrow + String(edge.data?.label ?? '')}
                key={edge.id}
                name={other?.label ?? otherId}
                tile={entityTile(other?.type ?? node.type, 'sm')}
                onPress={() =>
                  onSelectionChange({ kind: 'edge', id: String(edge.id) })
                }
              />
            );
          })}
          <Button
            className="tw:self-start"
            color="link-color"
            size="sm"
            onPress={() => onViewRelationships?.()}>
            {t('label.kg-view-relationships')}
          </Button>
        </InspectorSection>
      </Box>
      {(canPreviewNode(node) || nodeHref) && (
        <Box className="kg-inspector-actions" gap={2}>
          {canPreviewNode(node) && (
            <Button color="primary" size="md" onPress={() => onDetails(node)}>
              {t('label.kg-view-details')}
            </Button>
          )}
          {nodeHref && (
            <Button
              color="secondary"
              href={nodeHref}
              rel="noopener noreferrer"
              size="md"
              target="_blank">
              {t('label.kg-open-entity-page')}
            </Button>
          )}
        </Box>
      )}
    </>
  );
};

const KnowledgeGraphOverlays = ({
  nodes,
  edges,
  rootId,
  selection,
  tooltip,
  onSelectionChange,
  onExpandGroup,
  onViewRelationships,
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
      const relatedIds = new Set([
        selectedNode?.id,
        ...(selectedNode?.presentation?.members?.map((node) => node.id) ?? []),
      ]);
      const connections = selectedNode
        ? edges.filter(
            (edge) =>
              !edge.data.members &&
              (relatedIds.has(edge.source) || relatedIds.has(edge.target))
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
  const nodeLink = (node?: GraphNode) => {
    const href = getGraphNodeHref(node);

    return href ? (
      <Button
        className="tw:whitespace-normal tw:break-words tw:text-left"
        color="link-color"
        href={href}
        rel="noopener noreferrer"
        size="sm"
        target="_blank">
        {node?.label}
      </Button>
    ) : (
      <Typography size="text-sm">{node?.label ?? ''}</Typography>
    );
  };
  const inspectorTitle =
    getInspectorTitle(selectedNode, selectedEdge) ?? t('label.relationship');
  const rootNode = nodeMap.get(resolveFocusNodeId(nodes, rootId));
  const inspectorSubtitle = getInspectorSubtitle(t, selectedNode, selectedEdge);
  const inspectorTile = getInspectorTile(selectedNode, selectedEdge);

  return (
    <>
      <div
        aria-hidden="true"
        className="tw:hidden"
        data-testid="knowledge-graph-edges">
        {edges
          .filter((edge) => !edge.data.members)
          .map((edge) => (
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
            {tooltip.sourceLabel +
              (tooltip.derived ? ' — ' : ' → ') +
              tooltip.targetLabel}
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
          <Box align="start" className="kg-inspector-header" gap={2}>
            {inspectorTile}
            <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={0}>
              <h3
                className="tw:m-0! tw:text-md! tw:leading-6! tw:font-semibold tw:text-primary tw:break-words"
                ref={headingRef}
                tabIndex={-1}>
                {inspectorTitle}
              </h3>
              <Typography className="tw:text-tertiary" size="text-xs">
                {inspectorSubtitle}
              </Typography>
            </Box>
            <Button
              aria-label={t('label.close')}
              color="tertiary"
              iconLeading={XClose}
              size="sm"
              onPress={closeInspector}
            />
          </Box>
          {selectedEdge && (
            <KnowledgeGraphRelationship
              edge={selectedEdge}
              nodes={nodeMap}
              renderNode={nodeLink}
            />
          )}
          {selectedNode?.presentation?.members ? (
            <KnowledgeGraphGroupInspector
              edges={edges}
              node={selectedNode}
              nodes={nodeMap}
              onExpand={() => onExpandGroup?.(selectedNode.id)}
              onSelectRelationship={(id) =>
                onSelectionChange({ kind: 'edge', id })
              }
              onViewRelationships={() => onViewRelationships?.(selectedNode.id)}
            />
          ) : (
            selectedNode && (
              <GraphNodeInspector
                connections={connections}
                node={selectedNode}
                nodeHref={getGraphNodeHref(selectedNode)}
                nodeMap={nodeMap}
                root={rootNode}
                onDetails={setDetailsNode}
                onExpandGroup={onExpandGroup}
                onSelectionChange={onSelectionChange}
                onViewRelationships={onViewRelationships}
              />
            )
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
