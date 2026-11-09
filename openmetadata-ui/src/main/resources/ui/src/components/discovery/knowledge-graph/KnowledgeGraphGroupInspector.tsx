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

import { Box, Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  getColorSetForType,
  getGroupRelationship,
} from '../../../utils/discovery/knowledge-graph/knowledge-graph.utils';
import {
  getGroupMemberLabelKey,
  getSharedMemberType,
} from '../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';
import { getPluralizeEntityName } from '../../../utils/EntityNameUtils';
import { getNodeIcon } from './GraphElements/CustomNode';
import { GraphNode, KnowledgeGraphG6Edge } from './KnowledgeGraph.interface';
import { getRelationStyle } from './KnowledgeGraph.relations';
import {
  entityTile,
  InspectorKeyValue,
  InspectorRelationshipRow,
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

/**
 * The statement, identifier and family line of a bundle, resolved once. The
 * aggregate side (`N Users`, `N Columns`) renders as a coloured pill with its
 * entity-family icon so the user reads the bundle member type at a glance.
 */
const describeBundle = (
  node: GraphNode,
  edges: KnowledgeGraphG6Edge[],
  nodes: ReadonlyMap<string, GraphNode>,
  t: (key: string, options?: Record<string, unknown>) => string
) => {
  const presentation = node.presentation;
  const members = presentation?.members ?? [];
  const bundle = getGroupRelationship(node, edges);
  const memberKey = getGroupMemberLabelKey(members, node.type);
  const memberType = memberKey
    ? t(memberKey)
    : getPluralizeEntityName(getSharedMemberType(members));
  const memberLabel = `${members.length} ${memberType}`;
  // Mixed-type bundles have no shared type — fall back to the first member's
  // type so the pill still carries a sensible icon and colour.
  const memberFamilyType =
    getSharedMemberType(members) ?? members[0]?.type ?? node.type;
  const memberPalette = getColorSetForType(memberFamilyType);
  const MemberIcon = getNodeIcon(memberFamilyType);
  const aggregatePill = (
    <span
      className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium"
      style={{
        color: memberPalette.main,
        backgroundColor: memberPalette.light,
        border: '1px solid ' + memberPalette.main,
      }}>
      <MemberIcon aria-hidden="true" size={12} />
      {memberLabel}
    </span>
  );
  const endpoint = (id?: string): React.ReactNode =>
    id === node.id ? aggregatePill : nodes.get(id ?? '')?.label ?? '';
  const style = bundle ? getRelationStyle(bundle.data.category) : undefined;
  const arrow = (
    <span aria-hidden="true" className="tw:text-tertiary">
      {' → '}
    </span>
  );

  return {
    bundle,
    members,
    statement: (
      <span
        className="tw:inline-flex tw:flex-wrap tw:items-center tw:gap-1"
        data-testid="group-relationship-summary">
        <span>{endpoint(bundle?.source)}</span>
        {arrow}
        <span className="tw:font-medium">{presentation?.predicate}</span>
        {arrow}
        <span>{endpoint(bundle?.target)}</span>
      </span>
    ),
    code: bundle?.data.relationType ?? bundle?.data.label,
    color: style?.color ?? 'var(--tw-color-fg-quaternary)',
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
  const { bundle, members, statement, code } = describeBundle(
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
        {/* Family moved to the drawer header subtitle; the system name sits
            BELOW the statement card as a plain `System name: xxx` row so the
            gray card holds only the triple (mock 2f). */}
        <InspectorStatement statement={statement} />
        {code && (
          <InspectorKeyValue
            label={t('label.kg-system-name')}
            value={
              <span className="tw:font-mono tw:text-utility-purple-700">
                {code}
              </span>
            }
            valueTestId="relationship-predicate"
          />
        )}
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
            const memberIsSubject = relationship?.from === member.id;
            const otherId = memberIsSubject
              ? relationship?.to
              : relationship?.from;
            // When the bundle edge or the other endpoint is missing from the
            // nodes map, fall back to the anchor's label (the group bundle's
            // other side is always the anchor entity) so the row still reads
            // as a complete triple instead of showing a dangling arrow.
            const otherLabel =
              nodes.get(otherId ?? '')?.label ?? node.label ?? otherId ?? '';
            const subject = memberIsSubject ? member.label : otherLabel;
            const object = memberIsSubject ? otherLabel : member.label;

            return (
              <InspectorRelationshipRow
                isDisabled={!relationship?.id}
                key={member.id}
                object={object}
                predicate={presentation?.predicate ?? ''}
                subject={subject}
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
      <Box className="kg-inspector-actions" gap={2} justify="end">
        <Button color="secondary" size="md" onPress={onViewRelationships}>
          {t('label.kg-view-in-list')}
        </Button>
        <Button
          aria-expanded={Boolean(presentation?.expanded)}
          color="primary"
          size="md"
          onPress={onExpand}>
          {presentation?.expanded
            ? t('label.kg-collapse-bundle')
            : t('label.kg-expand-all-in-graph', { count: expandCount })}
        </Button>
      </Box>
    </>
  );
};

export default KnowledgeGraphGroupInspector;
