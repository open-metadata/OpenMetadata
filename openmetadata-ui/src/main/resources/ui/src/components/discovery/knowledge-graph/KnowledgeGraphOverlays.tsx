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
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  Link01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import {
  lazy,
  ReactNode,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useKeyboard } from 'react-aria';
import { useTranslation } from 'react-i18next';
import {
  ENTITY_UUID_REGEX,
  PANEL_WIDTH,
} from '../../../constants/discovery/knowledge-graph.constants';
import { EntityType } from '../../../enums/entity.enum';
import { GraphSelection } from '../../../hooks/discovery/knowledge-graph/useKnowledgeGraphCanvas';
import { MappingCoverage } from '../../../interface/discovery/knowledge-graph.interface';
import {
  getColorSetForType,
  getGroupRelationship,
} from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import {
  getGraphNodeHref,
  isGraphColumnNode,
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphNavigation.utils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import { SearchSourceDetails } from '../../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';
import { getNodeTypeLabel } from './GraphElements/CustomNode';
import {
  EdgeTooltipState,
  GraphNode,
  KnowledgeGraphG6Edge,
} from './KnowledgeGraph.interface';
import { getRelationStyle } from './KnowledgeGraph.relations';
import KnowledgeGraphGroupInspector from './KnowledgeGraphGroupInspector';
import {
  entityTile,
  InspectorGapNote,
  InspectorIdentityCard,
  InspectorRelationshipRow,
  InspectorSection,
  relationTile,
} from './KnowledgeGraphInspectorParts';
import {
  INLINE_RELATIONSHIPS,
  PREVIEW_RELATIONSHIPS,
} from './KnowledgeGraphOverlays.constants';
import { getBackTarget, InspectorBack } from './KnowledgeGraphOverlays.utils';
import KnowledgeGraphRelationship from './KnowledgeGraphRelationship';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () =>
      import('../../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);

const getInspectorSubtitle = (
  t: (key: string, options?: Record<string, unknown>) => string,
  node?: GraphNode,
  edge?: KnowledgeGraphG6Edge,
  edges?: KnowledgeGraphG6Edge[]
) => {
  if (node?.presentation?.members && edges) {
    // Mock 2f: "Grouped · N relationships · <Family>" — the family name
    // belongs on the drawer header so the statement card stays uncluttered.
    const bundle = getGroupRelationship(node, edges);
    const style = bundle ? getRelationStyle(bundle.data.category) : undefined;
    const base = t('label.kg-bundle-subtitle', {
      count: node.presentation.members.length,
    });

    return style ? base + ' · ' + t(style.labelKey) : base;
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
  /**
   * Opens the paged relationships table, scoped to a group's bundle
   * (`groupId`) or to an explicit set of edges (`scope`).
   */
  onViewRelationships?: (
    groupId?: string,
    scope?: { label: string; edgeIds: string[] }
  ) => void;
}

interface NodeInspectorProps
  extends Pick<InspectorProps, 'onExpandGroup' | 'onViewRelationships'> {
  node: GraphNode;
  root?: GraphNode;
  connections: KnowledgeGraphG6Edge[];
  nodeMap: Map<string, GraphNode>;
  nodeHref: string;
  coverage?: MappingCoverage;
  onDetails: (node: GraphNode) => void;
  onSelectRelationship: (id: string) => void;
  showAllRelationships: boolean;
  onShowAllRelationshipsChange: (showAll: boolean) => void;
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
  onSelectRelationship: (id: string) => void;
  onViewRelationships?: InspectorProps['onViewRelationships'];
  showAll: boolean;
  onShowAllChange: (showAll: boolean) => void;
}

const RelationshipsSection = ({
  node,
  connections,
  nodeMap,
  onSelectRelationship,
  onViewRelationships,
  showAll,
  onShowAllChange,
}: RelationshipsSectionProps) => {
  const { t } = useTranslation();
  const previewSlice = connections.slice(
    0,
    showAll ? INLINE_RELATIONSHIPS : PREVIEW_RELATIONSHIPS
  );
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
        const outgoing = edge.source === node.id;
        const subject = outgoing ? node.label : other?.label ?? otherId;
        const object = outgoing ? other?.label ?? otherId : node.label;

        return (
          <InspectorRelationshipRow
            key={edge.id}
            object={object}
            predicate={String(edge.data?.label ?? '')}
            subject={subject}
            tile={entityTile(other?.type ?? node.type, 'sm')}
            onPress={() => onSelectRelationship(String(edge.id))}
          />
        );
      })}
      {connections.length > PREVIEW_RELATIONSHIPS && (
        <Button
          aria-expanded={showAll}
          className="tw:self-start"
          color="link-color"
          size="sm"
          onPress={() => onShowAllChange(!showAll)}>
          {showAll
            ? t('label.view-less')
            : t('label.kg-view-all-relationships', {
                count: connections.length,
              })}
        </Button>
      )}
      {showAll && connections.length > INLINE_RELATIONSHIPS && (
        <Button
          className="tw:self-start"
          color="link-color"
          size="sm"
          onPress={() =>
            onViewRelationships?.(undefined, {
              label: node.label,
              edgeIds: connections.map((edge) => String(edge.id)),
            })
          }>
          {t('label.kg-view-in-list')}
        </Button>
      )}
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
    <Box className="kg-inspector-actions" gap={2} justify="end">
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
  onSelectRelationship,
  onViewRelationships,
  showAllRelationships,
  onShowAllRelationshipsChange,
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
          <div className="kg-inspector-description tw:text-xs tw:text-tertiary">
            <RichTextEditorPreviewerNew
              clampByLines
              enableSeeMoreVariant
              markdown={bodyDescription}
              maxLineLength="6"
            />
          </div>
        )}
        {node.ontologyProperty && (
          <OntologyDetails property={node.ontologyProperty} />
        )}
        <RelationshipsSection
          connections={connections}
          node={node}
          nodeMap={nodeMap}
          showAll={showAllRelationships}
          onSelectRelationship={onSelectRelationship}
          onShowAllChange={onShowAllRelationshipsChange}
          onViewRelationships={onViewRelationships}
        />
      </Box>
      <InspectorActions node={node} nodeHref={nodeHref} onDetails={onDetails} />
    </>
  );
};

interface InspectorHeaderProps {
  tile: ReactNode;
  title?: string;
  subtitle: string;
  headingRef: RefObject<HTMLHeadingElement>;
  onBack?: () => void;
  onClose: () => void;
}

const InspectorHeader = ({
  tile,
  title,
  subtitle,
  headingRef,
  onBack,
  onClose,
}: InspectorHeaderProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="start"
      className="tw:shrink-0 tw:border-b tw:border-secondary tw:px-3.5 tw:pt-3.5 tw:pb-3"
      gap={2}>
      {onBack && (
        <Button
          aria-label={t('label.back')}
          color="tertiary"
          data-testid="inspector-back"
          iconLeading={ChevronLeft}
          size="sm"
          onPress={onBack}
        />
      )}
      {tile}
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={0}>
        <Typography
          as="h3"
          className="tw:m-0! tw:break-words tw:text-sm! tw:leading-5! tw:text-primary"
          ref={headingRef}
          size="text-sm"
          tabIndex={-1}
          weight="semibold">
          {title ?? t('label.relationship')}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {subtitle}
        </Typography>
      </Box>
      <Button
        aria-label={t('label.close')}
        color="tertiary"
        iconLeading={XClose}
        size="sm"
        onPress={onClose}
      />
    </Box>
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
  // Where the inspector came from when it drilled into a relationship, so the
  // header can offer a way back. Only valid while that relationship is shown.
  const [back, setBack] = useState<InspectorBack | null>(null);
  // Lives here, not in the section, so "back" from a relationship returns to
  // the list as the user left it rather than collapsed to three rows.
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
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
  // Escape inside the panel closes only the panel; the fullscreen overlay above
  // it must not also see the key. Not useOverlay: that would make the panel the
  // topmost overlay, and fullscreen would ignore Escape pressed elsewhere.
  // react-aria shares one stop-propagation flag across this handler's events,
  // so Escape restores it explicitly rather than relying on the default.
  const { keyboardProps: inspectorKeyboardProps } = useKeyboard({
    onKeyDown: (event) => {
      if (event.key !== 'Escape') {
        event.continuePropagation();

        return;
      }
      if (!event.isPropagationStopped()) {
        event.stopPropagation();
      }
      closeInspector();
    },
  });
  // Leaving the drilled-into relationship (canvas click, close, another row)
  // ends the trip, so a later direct selection of that edge offers no "back".
  useEffect(() => {
    if (back && !getBackTarget(back, selection)) {
      setBack(null);
    }
  }, [back, selection]);
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
  // Drilling in or going back unmounts the control that had focus (the row,
  // the Back button); land keyboard users on the inspector heading instead of
  // letting focus fall to the page.
  const focusHeadingAfterRender = () =>
    requestAnimationFrame(() =>
      headingRef.current?.focus({ preventScroll: true })
    );
  const openRelationship = (id: string) => {
    setBack({ from: selection, to: id });
    onSelectionChange({ kind: 'edge', id });
    focusHeadingAfterRender();
  };
  const backTarget = getBackTarget(back, selection);

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
        // The canvas has no DOM node per edge, so a zero-size anchor at the
        // hover point stands in as the tooltip trigger.
        <span
          className="tw:pointer-events-none tw:fixed tw:size-0"
          style={{ left: tooltip.x, top: tooltip.y }}>
          <Tooltip
            excludeTriggerFromTabOrder
            isOpen
            crossOffset={12}
            data-testid="edge-tooltip"
            description={
              tooltip.sourceLabel +
              (tooltip.derived ? ' — ' : ' → ') +
              tooltip.targetLabel
            }
            key={tooltip.edgeId}
            offset={12}
            placement="bottom start"
            // The core tooltip takes the pointer once it settles; here that would
            // fire G6's edge:pointerleave and re-anchor the tooltip under the cursor.
            style={{ pointerEvents: 'none' }}
            title={tooltip.labels.map((label) => (
              <span
                className="tw:block"
                data-testid="edge-tooltip-label"
                key={label}>
                {label}
              </span>
            ))}>
            <span />
          </Tooltip>
        </span>
      )}
      {inspectorOpen && (
        <div
          aria-label={t('label.kg-inspector')}
          aria-modal={false}
          className="kg-inspector tw:relative tw:z-10 tw:flex tw:h-full tw:min-h-0 tw:min-w-0 tw:flex-col tw:overflow-hidden tw:bg-surface"
          data-testid="graph-inspector"
          role="dialog"
          {...inspectorKeyboardProps}>
          <InspectorHeader
            headingRef={headingRef}
            subtitle={getInspectorSubtitle(
              t,
              selectedNode,
              selectedEdge,
              edges
            )}
            tile={getInspectorTile(selectedNode, selectedEdge)}
            title={getInspectorTitle(selectedNode, selectedEdge)}
            onBack={
              backTarget
                ? () => {
                    setBack(null);
                    onSelectionChange(backTarget);
                    focusHeadingAfterRender();
                  }
                : undefined
            }
            onClose={closeInspector}
          />
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
              onSelectRelationship={openRelationship}
              onViewRelationships={() => onViewRelationships?.(selectedNode.id)}
            />
          ) : (
            selectedNode && (
              <GraphNodeInspector
                connections={connections}
                coverage={coverage?.get(selectedNode.id)}
                key={selectedNode.id}
                node={selectedNode}
                nodeHref={getGraphNodeHref(selectedNode)}
                nodeMap={nodeMap}
                showAllRelationships={expandedNodeId === selectedNode.id}
                onDetails={setDetailsNode}
                onExpandGroup={onExpandGroup}
                onSelectRelationship={openRelationship}
                onShowAllRelationshipsChange={(showAll) =>
                  setExpandedNodeId(showAll ? selectedNode.id : null)
                }
                onViewRelationships={onViewRelationships}
              />
            )
          )}
        </div>
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
