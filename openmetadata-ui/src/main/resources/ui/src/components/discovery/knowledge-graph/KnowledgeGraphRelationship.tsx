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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  GraphNode,
  KnowledgeGraphG6Edge,
} from './KnowledgeGraph.interface';
import { getRelationStyle } from './KnowledgeGraph.relations';
import {
  InspectorSection,
  InspectorStatement,
} from './KnowledgeGraphInspectorParts';

interface RelationshipProps {
  edge: KnowledgeGraphG6Edge;
  nodes: ReadonlyMap<string, GraphNode>;
  renderNode: (node?: GraphNode) => ReactNode;
}

const KnowledgeGraphRelationship = ({
  edge,
  nodes,
  renderNode,
}: RelationshipProps) => {
  const { t } = useTranslation();
  const derivation = edge.data.derivation;
  const style = getRelationStyle(edge.data.category);
  if (!derivation) {
    return (
      <Box className="kg-inspector-body" direction="col">
        <InspectorStatement
          code={edge.data.relationType ?? edge.data.label}
          codeTestId="relationship-predicate"
          color={style.color}
          family={t(style.labelKey)}
          statement={
            <Box direction="col" gap={1}>
              {renderNode(nodes.get(edge.source))}
              <span>{'→ ' + edge.data.label + ' →'}</span>
              {renderNode(nodes.get(edge.target))}
            </Box>
          }
        />
        {edge.data.members && (
          <>
            <Typography className="tw:text-tertiary" size="text-xs">
              {t('message.kg-group-explanation', {
                count: edge.data.members.length,
              })}
            </Typography>
            <InspectorSection
              meta={t('label.kg-showing-of', {
                shown: Math.min(6, edge.data.members.length),
                total: edge.data.members.length,
              })}
              title={t('label.member-plural')}>
              {edge.data.members.slice(0, 6).map((member) => (
                <Box
                  className="tw:border-t tw:border-secondary tw:pt-2"
                  direction="col"
                  key={JSON.stringify([
                    member.from,
                    member.relationType ?? member.label,
                    member.to,
                  ])}>
                  {renderNode(nodes.get(member.from))}
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {'→ ' + member.label + ' →'}
                  </Typography>
                  {renderNode(nodes.get(member.to))}
                </Box>
              ))}
            </InspectorSection>
          </>
        )}
      </Box>
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
