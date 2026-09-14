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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { getPluralizeEntityName } from '../../utils/EntityNameUtils';
import { getGroupRelationship } from '../../utils/KnowledgeGraph.utils';
import { GraphNode, KnowledgeGraphG6Edge } from './KnowledgeGraph.interface';
import { getRelationStyle } from './KnowledgeGraph.relations';
import {
  entityTile,
  InspectorRow,
  InspectorSection,
  InspectorStatement,
} from './KnowledgeGraphInspectorParts';

interface GroupInspectorProps {
  node: GraphNode;
  edges: KnowledgeGraphG6Edge[];
  nodes: ReadonlyMap<string, GraphNode>;
  onSelectRelationship: (id: string) => void;
  onExpand: () => void;
  onViewRelationships: () => void;
}

/** How many members an expanded bundle lays out on the canvas. */
const PREVIEW_SIZE = 6;

/** The statement, identifier and family line of a bundle, resolved once. */
const describeBundle = (
  node: GraphNode,
  edges: KnowledgeGraphG6Edge[],
  nodes: ReadonlyMap<string, GraphNode>,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const presentation = node.presentation;
  const members = presentation?.members ?? [];
  const bundle = getGroupRelationship(node, edges);
  const memberType =
    node.type === 'column'
      ? t('label.column-plural')
      : getPluralizeEntityName(node.type);
  const memberSummary = `${members.length} ${memberType}`;
  const endpoint = (id?: string) =>
    id === node.id ? memberSummary : nodes.get(id ?? '')?.label;
  const direction = t(
    presentation?.direction === 'in' ? 'label.kg-incoming' : 'label.kg-outgoing'
  );
  const style = bundle ? getRelationStyle(bundle.data.category) : undefined;

  return {
    bundle,
    members,
    statement: [
      endpoint(bundle?.source),
      presentation?.predicate,
      endpoint(bundle?.target),
    ]
      .filter(Boolean)
      .join(' → '),
    code: bundle?.data.relationType ?? bundle?.data.label,
    color: style?.color ?? 'var(--om-color-gray-400)',
    family: style ? t(style.labelKey) + ' · ' + direction : '',
  };
};

const KnowledgeGraphGroupInspector = ({
  node,
  edges,
  nodes,
  onSelectRelationship,
  onExpand,
  onViewRelationships,
}: GroupInspectorProps) => {
  const { t } = useTranslation();
  const presentation = node.presentation;
  const { bundle, members, statement, code, color, family } = describeBundle(
    node,
    edges,
    nodes,
    t
  );
  const preview = members.slice(0, PREVIEW_SIZE);
  const expandCount = Math.min(members.length, PREVIEW_SIZE);

  return (
    <>
      <Box className="kg-inspector-body" direction="col">
        <InspectorStatement
          code={code}
          codeTestId="relationship-predicate"
          color={color}
          family={family}
          statement={
            <span data-testid="group-relationship-summary">{statement}</span>
          }
        />
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.kg-group-explanation', { count: members.length })}
        </Typography>
        <InspectorSection
          meta={t('label.kg-showing-of', {
            shown: preview.length,
            total: members.length,
          })}
          title={t('label.member-plural')}>
          {preview.map((member) => {
            const relationship = bundle?.data.members?.find(
              (edge) => edge.from === member.id || edge.to === member.id
            );

            return (
              <InspectorRow
                detail={
                  (relationship?.from === member.id ? '← ' : '→ ') +
                  presentation?.predicate
                }
                isDisabled={!relationship?.id}
                key={member.id}
                name={member.label}
                tile={entityTile(member.type, 'sm')}
                onPress={() => {
                  if (relationship?.id) {
                    onSelectRelationship(relationship.id);
                  }
                }}
              />
            );
          })}
        </InspectorSection>
      </Box>
      <Box className="kg-inspector-actions" gap={2}>
        <Button
          aria-expanded={Boolean(presentation?.expanded)}
          color="primary"
          size="md"
          onPress={onExpand}>
          {presentation?.expanded
            ? t('label.kg-collapse-bundle')
            : t('label.kg-expand-all-in-graph', { count: expandCount })}
        </Button>
        <Button color="secondary" size="md" onPress={onViewRelationships}>
          {t('label.kg-view-in-list')}
        </Button>
      </Box>
    </>
  );
};

export default KnowledgeGraphGroupInspector;
