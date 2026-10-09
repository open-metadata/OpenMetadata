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
  Box,
  Button,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { Link01, XClose } from '@openmetadata/ui-core-components/icons';
import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ENTITY_UUID_REGEX,
  PANEL_WIDTH,
} from '../../../constants/discovery/knowledge-graph.constants';
import { EntityType } from '../../../enums/entity.enum';
import { GraphSelection } from '../../../hooks/discovery/knowledge-graph/useKnowledgeGraphCanvas';
import { MappingCoverage } from '../../../interface/discovery/knowledge-graph.interface';
import { getColorSetForType } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import {
  getGraphNodeHref,
  isGraphColumnNode,
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphNavigation.utils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { SearchSourceDetails } from '../../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';
import { getNodeTypeLabel } from './GraphElements/CustomNode';
import {
  EdgeTooltipState,
  GraphNode,
  KnowledgeGraphG6Edge,
} from './KnowledgeGraph.interface';
import KnowledgeGraphGroupInspector from './KnowledgeGraphGroupInspector';
import {
  entityTile,
  InspectorGapNote,
  InspectorIdentityCard,
  InspectorRow,
  InspectorSection,
  relationTile,
} from './KnowledgeGraphInspectorParts';
import KnowledgeGraphRelationship from './KnowledgeGraphRelationship';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () =>
      import('../../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
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
  selection: GraphSelection;
  tooltip: EdgeTooltipState | null;
  /** Coverage per node id — drives the Unmapped CTA on the entity drawer. */
  coverage?: Map<string, MappingCoverage>;
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
  coverage?: MappingCoverage;
  onDetails: (node: GraphNode) => void;
}

/** Entity types that render as "USERNAME" / "FQN" instead of "FULL PATH". */
const USERNAME_TYPES = new Set<string>([EntityType.USER, EntityType.TEAM]);
const FQN_TYPES = new Set<string>([EntityType.TAG, EntityType.CLASSIFICATION]);
/** Entity types where mapping-coverage CTAs (unmapped / owner) do not apply. */
const COVERAGE_SIGNAL_SKIP = new Set<string>([
  EntityType.USER,
  EntityType.TEAM,
  EntityType.TAG,
  EntityType.CLASSIFICATION,
  EntityType.DATABASE_SCHEMA,
  EntityType.DATABASE,
]);

/** Short caps field label above the identifier, chosen by entity family. */
const identityFieldKey = (type: string): string => {
  if (USERNAME_TYPES.has(type)) {
    return 'label.kg-username';
  }
  if (FQN_TYPES.has(type)) {
    return 'label.kg-fqn';
  }

  return 'label.kg-full-path';
};

const hasIdentityCard = (node: GraphNode) =>
  Boolean(node.fullyQualifiedName || node.name);

const hasMappingCoverageSignal = (type: string) =>
  !COVERAGE_SIGNAL_SKIP.has(type);

interface RelationshipsSectionProps {
  node: GraphNode;
  connections: KnowledgeGraphG6Edge[];
  nodeMap: Map<string, GraphNode>;
  onSelectionChange: (selection: GraphSelection) => void;
  onViewRelationships?: (groupId?: string) => void;
}

const RelationshipsSection = ({
  node,
  connections,
  nodeMap,
  onSelectionChange,
  onViewRelationships,
}: RelationshipsSectionProps) => {
  const { t } = useTranslation();
  const previewSlice = connections.slice(0, 3);
  if (connections.length === 0) {
    return null;
  }

  return (
    <InspectorSection
      meta={t('label.kg-in-view-of', {
        shown: previewSlice.length,
        total: connections.length,
      })}
      title={t('label.relationship-plural')}>
      {previewSlice.map((edge) => {
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
        {t('label.kg-view-all-relationships', { count: connections.length })}
      </Button>
    </InspectorSection>
  );
};

interface OntologyDetailsProps {
  property: NonNullable<GraphNode['ontologyProperty']>;
}

const OntologyDetails = ({ property }: OntologyDetailsProps) => {
  const { t } = useTranslation();
  const cardinality = property.functional
    ? 'label.kg-at-most-one'
    : 'label.kg-not-declared';

  return (
    <InspectorSection title={t('label.details')}>
      <Typography className="tw:break-all tw:text-secondary" size="text-sm">
        {t('label.kg-range') + ': ' + property.range}
      </Typography>
      <Typography className="tw:text-secondary" size="text-sm">
        {t('label.kg-cardinality') + ': ' + t(cardinality)}
      </Typography>
    </InspectorSection>
  );
};

interface IdentitySectionProps {
  node: GraphNode;
}

const IdentitySection = ({ node }: IdentitySectionProps) => {
  const { t } = useTranslation();
  if (!hasIdentityCard(node)) {
    return null;
  }
  const value = node.fullyQualifiedName ?? node.name ?? node.label;

  return (
    <InspectorIdentityCard
      color={getColorSetForType(node.type).main}
      family={getNodeTypeLabel(node.type, t)}
      fieldLabel={t(identityFieldKey(node.type))}
      value={value}
      valueTestId="inspector-identity-value"
    />
  );
};

interface GapNotesProps {
  showUnmappedCTA: boolean;
  showOwnerAssigned: boolean;
  nodeHref: string;
}

const GapNotes = ({
  showUnmappedCTA,
  showOwnerAssigned,
  nodeHref,
}: GapNotesProps) => {
  const { t } = useTranslation();
  if (!showUnmappedCTA && !showOwnerAssigned) {
    return null;
  }

  return (
    <Box direction="col" gap={2}>
      {showUnmappedCTA && (
        <InspectorGapNote
          actionHref={nodeHref || undefined}
          actionLabel={t('label.kg-map-term')}
          actionTestId="inspector-cta-map-term"
          text={t('label.kg-unmapped-glossary')}
          tone="warning"
        />
      )}
      {showOwnerAssigned && (
        <InspectorGapNote text={t('label.kg-owner-assigned')} tone="success" />
      )}
    </Box>
  );
};

interface InspectorActionsProps {
  node: GraphNode;
  nodeHref: string;
  onDetails: (node: GraphNode) => void;
}

const InspectorActions = ({
  node,
  nodeHref,
  onDetails,
}: InspectorActionsProps) => {
  const { t } = useTranslation();
  const previewable = canPreviewNode(node);
  if (!previewable && !nodeHref) {
    return null;
  }

  return (
    <Box className="kg-inspector-actions" gap={2}>
      {previewable && (
        <Button color="secondary" size="md" onPress={() => onDetails(node)}>
          {t('label.preview')}
        </Button>
      )}
      {nodeHref && (
        <Button
          color="primary"
          href={nodeHref}
          rel="noopener noreferrer"
          size="md"
          target="_blank">
          {t('label.kg-open-asset-page')}
        </Button>
      )}
    </Box>
  );
};

const GraphNodeInspector = ({
  node,
  connections,
  nodeMap,
  nodeHref,
  coverage,
  onDetails,
  onSelectionChange,
  onViewRelationships,
}: NodeInspectorProps) => {
  const canShowGapNotes = hasMappingCoverageSignal(node.type);
  const bodyDescription = node.description ?? null;

  return (
    <>
      <Box className="kg-inspector-body" direction="col">
        <IdentitySection node={node} />
        <GapNotes
          nodeHref={nodeHref}
          showOwnerAssigned={canShowGapNotes && Boolean(node.owner)}
          showUnmappedCTA={canShowGapNotes && coverage === 'unmapped'}
        />
        {bodyDescription && (
          <Typography className="tw:text-tertiary" size="text-xs">
            {bodyDescription}
          </Typography>
        )}
        {node.ontologyProperty && (
          <OntologyDetails property={node.ontologyProperty} />
        )}
        <RelationshipsSection
          connections={connections}
          node={node}
          nodeMap={nodeMap}
          onSelectionChange={onSelectionChange}
          onViewRelationships={onViewRelationships}
        />
      </Box>
      <InspectorActions node={node} nodeHref={nodeHref} onDetails={onDetails} />
    </>
  );
};

const KnowledgeGraphOverlays = ({
  nodes,
  edges,
  selection,
  tooltip,
  coverage,
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
              onViewInList={
                onViewRelationships ? () => onViewRelationships() : undefined
              }
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
                coverage={coverage?.get(selectedNode.id)}
                node={selectedNode}
                nodeHref={getGraphNodeHref(selectedNode)}
                nodeMap={nodeMap}
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
