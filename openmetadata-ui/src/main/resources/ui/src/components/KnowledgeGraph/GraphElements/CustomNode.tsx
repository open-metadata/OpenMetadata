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

import type { NodeData } from '@antv/g6';
import { Box, Button } from '@openmetadata/ui-core-components';
import {
  BookClosed,
  CheckCircle,
  ChevronRight,
  Columns03,
  Database01,
  Dataflow03,
  Globe01,
  Table,
  Tag01,
  User01,
  Users01,
} from '@untitledui/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getEntityNameLabel,
  getPluralizeEntityName,
} from '../../../utils/EntityNameUtils';
import { getGraphNodeLabel } from '../../../utils/knowledge-graph/knowledgeGraphPresentation.utils';
import { GraphNodePresentation } from '../KnowledgeGraph.interface';
import { normalizeRelationKey } from '../KnowledgeGraph.relations';
import './custom-node.less';

export interface CustomNodeProps {
  nodeData: NodeData;
  nodeRenderKey: string;
  onSelect?: (keyboard: boolean) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onExpand?: () => void;
}

export const NODE_ICONS = {
  table: Table,
  column: Columns03,
  property: Columns03,
  glossaryterm: BookClosed,
  concept: BookClosed,
  term: BookClosed,
  glossary: BookClosed,
  tag: Tag01,
  classification: Tag01,
  domain: Globe01,
  dataproduct: Globe01,
  team: Users01,
  user: User01,
  pipeline: Dataflow03,
  testcase: CheckCircle,
  testsuite: CheckCircle,
  certification: CheckCircle,
};

/** Glossary terms read as business concepts on the graph, as in the design. */
export const getNodeTypeLabel = (type: string, t: (key: string) => string) => {
  const key = type.toLowerCase();
  if (key === 'property') {
    return t('label.property');
  }
  if (key === 'glossaryterm') {
    return t('label.concept');
  }

  return getEntityNameLabel(type);
};

export const getNodeIcon = (type: string) =>
  NODE_ICONS[type.toLowerCase() as keyof typeof NODE_ICONS] ?? Database01;

const getNodeView = (nodeData: NodeData) => {
  const data = nodeData.data ?? {};
  const type = String(data.type ?? '');
  const presentation = data.presentation as GraphNodePresentation | undefined;

  return {
    data,
    type,
    presentation,
    isRoot: Boolean(presentation?.root),
    mapped: Boolean(presentation?.root && presentation.coverage === 'mapped'),
    Icon: getNodeIcon(type),
    rawLabel: String(data.label ?? ''),
    level: data.level ?? 1,
  };
};

function CustomNode({
  nodeData,
  onSelect,
  onFocus,
  onBlur,
  onExpand,
}: Readonly<CustomNodeProps>) {
  const { t } = useTranslation();
  const { data, type, presentation, isRoot, mapped, Icon, rawLabel, level } =
    getNodeView(nodeData);
  const members = presentation?.members;
  const color = data.colorMain as string | undefined;
  const typeLabel = getNodeTypeLabel(type, t);
  const groupLabel = () => {
    const predicate = normalizeRelationKey(presentation?.predicate ?? '');
    if (['hasfollower', 'followedby'].includes(predicate)) {
      return t('label.follower-plural');
    }
    const keys: Record<string, string> = {
      column: 'label.column-plural',
      query: 'label.query-plural',
      property: 'label.property-plural',
      tag: 'label.tag-plural',
      user: 'label.user-plural',
      team: 'label.team-plural',
    };

    return keys[type] ? t(keys[type]) : getPluralizeEntityName(type);
  };
  const label = members ? groupLabel() : rawLabel;

  return (
    <Box
      className={classNames('knowledge-graph-custom-node', {
        highlighted: data.highlighted,
        dimmed: data.dimmed,
        'kg-node-root': isRoot,
        'kg-node-group': members,
        'kg-node-gap': presentation?.coverage === 'unmapped',
      })}
      direction="col">
      <Button
        noTextPadding
        aria-label={t('label.kg-node-description', {
          name: label,
          type: typeLabel,
          level,
        })}
        className="kg-node-select"
        color="tertiary"
        data-level={data.level}
        data-node-id={nodeData.id}
        data-testid={'node-' + rawLabel}
        title={label}
        onBlur={onBlur}
        onFocus={onFocus}
        onPress={(event) => onSelect?.(event.pointerType === 'keyboard')}>
        <Box align="center" className="tw:w-full tw:min-w-0" gap={2}>
          <Box
            align="center"
            className="node-icon tw:rounded-md tw:border"
            justify="center"
            style={{
              color,
              backgroundColor: data.colorLight as string | undefined,
              borderColor: color,
            }}>
            <Icon aria-hidden="true" size={isRoot ? 18 : 16} />
          </Box>
          <Box
            className="tw:min-w-0 tw:flex-1 tw:text-left"
            direction="col"
            gap={0}>
            <span className="kg-node-name tw:truncate" data-testid="label">
              {label}
            </span>
            <span className="kg-node-type" data-testid="type-tag">
              {typeLabel}
            </span>
          </Box>
          {members && (
            <span
              className="kg-node-count tw:rounded-full tw:border tw:px-1.5"
              style={{
                color,
                backgroundColor: data.colorLight as string | undefined,
                borderColor: color,
              }}>
              {members.length}
            </span>
          )}
        </Box>
      </Button>
      {mapped && (
        <Box
          align="center"
          className="kg-node-note tw:px-3 tw:pb-2 tw:text-success-primary"
          gap={1}>
          <CheckCircle aria-hidden="true" size={12} />
          <span>{t('label.kg-mapped-to-ontology')}</span>
        </Box>
      )}
      {members && (
        <Box
          className="tw:mx-3 tw:min-h-0 tw:border-t tw:border-secondary tw:pt-1"
          direction="col"
          gap={0}>
          {members.slice(0, 3).map((member) => (
            <span className="kg-node-member tw:truncate" key={member.id}>
              {getGraphNodeLabel(member)}
            </span>
          ))}
          <Box align="center" className="tw:mt-1" justify="between">
            <Button
              aria-expanded={Boolean(presentation.expanded)}
              color="link-color"
              iconTrailing={ChevronRight}
              size="xs"
              onPress={onExpand}>
              {t(
                presentation.expanded
                  ? 'label.kg-collapse-group'
                  : 'label.kg-expand-group'
              )}
            </Button>
            {members.length > 3 && (
              <span className="kg-node-more">
                {t('label.kg-more-count', { count: members.length - 3 })}
              </span>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default React.memo(
  CustomNode,
  (prev, next) => prev.nodeRenderKey === next.nodeRenderKey
);
