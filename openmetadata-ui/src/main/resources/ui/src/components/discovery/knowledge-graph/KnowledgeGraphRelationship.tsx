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
    Badge,
    Box,
    Button,
    Typography
} from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getColorSetForType } from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import { getGraphNodeHref } from '../../../utils/discovery/knowledge-graph/knowledgeGraphNavigation.utils';
import {
    getGroupMemberLabelKey,
    getSharedMemberType
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';
import { getPluralizeEntityName } from '../../../utils/EntityNameUtils';
import { getNodeIcon } from './GraphElements/CustomNode';
import type {
    GraphNode,
    KnowledgeGraphG6Edge
} from './KnowledgeGraph.interface';
import { getRelationStyle } from './KnowledgeGraph.relations';
import {
    entityTile,
    InspectorKeyValue,
    InspectorRelationshipRow,
    InspectorSection,
    InspectorStatement
} from './KnowledgeGraphInspectorParts';

interface RelationshipProps {
  edge: KnowledgeGraphG6Edge;
  nodes: ReadonlyMap<string, GraphNode>;
  renderNode: (node?: GraphNode) => ReactNode;
  onViewInList?: () => void;
}

/**
 * Build the "N Users" / "N Columns" pill rendered in the aggregate side of
 * a bundle statement. Returns `null` when there's nothing to aggregate.
 */
const buildAggregatePill = (
  members: NonNullable<KnowledgeGraphG6Edge['data']['members']>,
  aggregateType: string,
  memberType: string
): ReactNode => {
  if (members.length === 0) {
    return null;
  }
  const palette = getColorSetForType(aggregateType);
  const Icon = getNodeIcon(aggregateType);

  return (
    <span
      className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium"
      style={{
        color: palette.main,
        backgroundColor: palette.light,
        border: '1px solid ' + palette.main,
      }}>
      <Icon aria-hidden="true" size={12} />
      {`${members.length} ${memberType}`}
    </span>
  );
};

/** Lift a bundle's members (edge records) to real GraphNodes from the map. */
const bundleMemberNodes = (
  members: NonNullable<KnowledgeGraphG6Edge['data']['members']>,
  nodes: ReadonlyMap<string, GraphNode>,
  sourceIsAggregate: boolean,
  fallbackType: string
): GraphNode[] =>
  members.map((m) => {
    const memberId = sourceIsAggregate ? m.from : m.to;
    const found = nodes.get(memberId);
    if (found) {
      return found;
    }

    return { id: memberId, type: fallbackType, label: memberId } as GraphNode;
  });

const resolveAggregateType = (
  memberNodes: GraphNode[],
  fallbackType: string
): string => {
  const shared = getSharedMemberType(memberNodes);
  if (shared) {
    return shared;
  }

  return memberNodes[0]?.type ?? fallbackType ?? 'other';
};

/**
 * Build the member rows for a bundle-edge inspector. Each row navigates to
 * the member entity's page (new tab) so the bundle inspector stays usable
 * for jumping into any one of the aggregated relationships; rows without a
 * resolvable href render disabled so the chevron doesn't lie about navigation.
 */
const buildMemberRows = (
  members: NonNullable<KnowledgeGraphG6Edge['data']['members']>,
  nodes: ReadonlyMap<string, GraphNode>,
  sourceIsAggregate: boolean,
  aggregateType: string
) =>
  members.slice(0, 6).map((member) => {
    const fromNode = nodes.get(member.from);
    const toNode = nodes.get(member.to);
    const memberNode = sourceIsAggregate ? fromNode : toNode;
    const href = getGraphNodeHref(memberNode);
    const key = JSON.stringify([
      member.from,
      member.relationType ?? member.label,
      member.to,
    ]);

    return (
      <InspectorRelationshipRow
        isDisabled={!href}
        key={key}
        object={toNode?.label ?? member.to}
        predicate={member.label}
        subject={fromNode?.label ?? member.from}
        tile={entityTile(memberNode?.type ?? aggregateType, 'sm')}
        onPress={
          href
            ? () => window.open(href, '_blank', 'noopener,noreferrer')
            : undefined
        }
      />
    );
  });

/** Resolve the aggregate-side entity type and the pluralised member label. */
const resolveBundleTypes = (
  members: NonNullable<KnowledgeGraphG6Edge['data']['members']>,
  nodes: ReadonlyMap<string, GraphNode>,
  sourceIsAggregate: boolean,
  sourceNode: GraphNode | undefined,
  targetNode: GraphNode | undefined,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const aggregateNode = sourceIsAggregate ? sourceNode : targetNode;
  const peerNode = sourceIsAggregate ? targetNode : sourceNode;
  const memberNodes = bundleMemberNodes(
    members,
    nodes,
    sourceIsAggregate,
    aggregateNode?.type ?? ''
  );
  const aggregateType = resolveAggregateType(
    memberNodes,
    aggregateNode?.type ?? ''
  );
  const memberKey = getGroupMemberLabelKey(memberNodes, peerNode?.type ?? '');
  const memberType = memberKey
    ? t(memberKey)
    : getPluralizeEntityName(aggregateType);

  return { aggregateType, memberType };
};

/**
 * Pull the bundle metadata (aggregate type, display count, aggregate pill)
 * out of the body function so RelationshipBody only orchestrates the layout
 * and stays under the sonar complexity threshold. Also pre-resolves which side
 * of the statement renders as the aggregate pill vs. the raw node.
 */
const describeBundleEdge = (
  edge: KnowledgeGraphG6Edge,
  nodes: ReadonlyMap<string, GraphNode>,
  renderNode: (node?: GraphNode) => ReactNode,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const sourceNode = nodes.get(edge.source);
  const targetNode = nodes.get(edge.target);
  const members = edge.data.members ?? [];
  const sourceIsAggregate = Boolean(sourceNode?.presentation?.members);
  const { aggregateType, memberType } = resolveBundleTypes(
    members,
    nodes,
    sourceIsAggregate,
    sourceNode,
    targetNode,
    t
  );
  const aggregatePill = buildAggregatePill(members, aggregateType, memberType);
  const isBundle = members.length > 0;
  const sourceSlot =
    isBundle && sourceIsAggregate ? aggregatePill : renderNode(sourceNode);
  const targetSlot =
    isBundle && !sourceIsAggregate ? aggregatePill : renderNode(targetNode);

  return {
    members,
    sourceIsAggregate,
    aggregateType,
    isBundle,
    sourceSlot,
    targetSlot,
  };
};

/**
 * The statement + members body for a selected edge. When the edge is a
 * bundle (`edge.data.members` set), the aggregate side renders as a coloured
 * member-family pill (mock 2f); otherwise it's a plain subject → predicate →
 * object with the family dot restored.
 */
const RelationshipBody = ({
  edge,
  nodes,
  renderNode,
  onViewInList,
}: RelationshipProps) => {
  const { t } = useTranslation();
  const style = getRelationStyle(edge.data.category);
  const systemName = edge.data.relationType ?? edge.data.label;
  const {
    members,
    sourceIsAggregate,
    aggregateType,
    isBundle,
    sourceSlot,
    targetSlot,
  } = describeBundleEdge(edge, nodes, renderNode, t);
  const arrow = (
    <span aria-hidden="true" className="tw:text-tertiary">
      {' → '}
    </span>
  );

  return (
    <>
      <Box className="kg-inspector-body" direction="col">
        <InspectorStatement
          color={isBundle ? undefined : style.color}
          family={isBundle ? undefined : t(style.labelKey)}
          statement={
            <span className="tw:inline-flex tw:flex-wrap tw:items-center tw:gap-1">
              <span>{sourceSlot}</span>
              {arrow}
              <span className="tw:font-medium">{edge.data.label}</span>
              {arrow}
              <span>{targetSlot}</span>
            </span>
          }
        />
        {systemName && (
          <InspectorKeyValue
            label={t('label.kg-system-name')}
            value={
              <span className="tw:font-mono tw:text-utility-purple-700">
                {systemName}
              </span>
            }
            valueTestId="relationship-predicate"
          />
        )}
        {isBundle && (
          <InspectorSection
            meta={t('label.kg-showing-of', {
              shown: Math.min(6, members.length),
              total: members.length,
            })}
            title={t('label.member-plural')}>
            {buildMemberRows(members, nodes, sourceIsAggregate, aggregateType)}
          </InspectorSection>
        )}
      </Box>
      {onViewInList && (
        <Box className="kg-inspector-actions" gap={2}>
          <Button color="secondary" size="md" onPress={onViewInList}>
            {t('label.kg-view-in-list')}
          </Button>
        </Box>
      )}
    </>
  );
};

const KnowledgeGraphRelationship = ({
  edge,
  nodes,
  renderNode,
  onViewInList,
}: RelationshipProps) => {
  const { t } = useTranslation();
  const derivation = edge.data.derivation;
  if (!derivation) {
    return (
      <RelationshipBody
        edge={edge}
        nodes={nodes}
        renderNode={renderNode}
        onViewInList={onViewInList}
      />
    );
  }

  return (
    <Box className="kg-inspector-body" direction="col">
      <Badge color="purple" size="sm">
        {t('label.ontology-inferred')}
      </Badge>
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('message.knowledge-graph-ontology-inferred')}
      </Typography>
      <ol
        className="tw:m-0 tw:list-none tw:p-0"
        data-testid="ontology-derivation">
        {derivation.nodes.map((node, index) => {
          const relationship = derivation.edges[index];
          const forward = relationship?.from === node.id;
          const endpoint = index === 0 || index === derivation.nodes.length - 1;

          return (
            <li key={node.id}>
              <Box
                align="start"
                className="tw:rounded-md tw:border tw:border-secondary tw:bg-secondary tw:p-2"
                gap={2}
                justify="between">
                {renderNode(node)}
                <Badge color={endpoint ? 'gray' : 'purple'} size="sm">
                  {t(endpoint ? 'label.asset' : 'label.concept')}
                </Badge>
              </Box>
              {relationship && (
                <Typography
                  className="tw:my-2 tw:ml-3 tw:break-words tw:text-secondary"
                  data-source={relationship.from}
                  data-target={relationship.to}
                  data-testid="derivation-relationship"
                  size="text-sm"
                  title={relationship.relationType}
                  weight="medium">
                  {(forward ? '↓ ' : '↑ ') +
                    (relationship.label.trim() ||
                      relationship.relationType ||
                      '')}
                </Typography>
              )}
            </li>
          );
        })}
      </ol>
    </Box>
  );
};

export default KnowledgeGraphRelationship;
