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
import {
  Avatar,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
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
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomNodeProps } from '../../../../interface/discovery/knowledge-graph.interface';
import {
  getGraphNodeLabel,
  getGroupMemberLabelKey,
  getSharedMemberType,
} from '../../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';
import {
  getEntityNameLabel,
  getPluralizeEntityName,
} from '../../../../utils/EntityNameUtils';
import { GraphNodePresentation } from '../KnowledgeGraph.interface';
import { normalizeRelationKey } from '../KnowledgeGraph.relations';
import './custom-node.less';
import MemberVisual from './MemberVisual';

export type { CustomNodeProps };

export const NODE_ICONS: Partial<Record<string, typeof Table>> = {
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

export const getNodeIcon = (type: string): typeof Table =>
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
  const groupLabel = (bundled: GraphNodePresentation['members'] = []) => {
    const predicate = normalizeRelationKey(presentation?.predicate ?? '');
    // `follows` is the same relation read from the other end; whichever
    // direction formed the bundle, the card names the people following.
    if (['hasfollower', 'followedby', 'follows'].includes(predicate)) {
      return t('label.follower-plural');
    }
    const key = getGroupMemberLabelKey(bundled, type);

    return key ? t(key) : getPluralizeEntityName(getSharedMemberType(bundled));
  };
  const label = members ? groupLabel(members) : rawLabel;
  // Design: the subject card carries a soft brand halo so it reads as the
  // centre of the graph at any zoom; a highlighted path drops it for emphasis.
  const getNodeShadow = () => {
    if (data.highlighted) {
      return 'tw:shadow-md';
    }
    if (isRoot) {
      return 'tw:shadow-md tw:outline-4 tw:outline-utility-brand-100';
    }

    return members ? 'tw:shadow-sm' : 'tw:shadow-xs';
  };

  return (
    <div
      className={classNames(
        'knowledge-graph-custom-node tw:flex tw:flex-col',
        getNodeShadow(),
        {
          highlighted: data.highlighted,
          dimmed: data.dimmed,
          'kg-node-root': isRoot,
          'kg-node-group': members,
          'kg-node-gap': presentation?.coverage === 'unmapped',
        }
      )}>
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
            className={classNames(
              'tw:shrink-0 tw:rounded-md tw:text-tertiary',
              isRoot ? 'tw:size-8' : 'tw:size-7'
            )}
            justify="center"
            style={{
              color,
              backgroundColor: data.colorLight as string | undefined,
            }}>
            <Icon aria-hidden="true" size={isRoot ? 18 : 16} />
          </Box>
          <Box
            className="tw:min-w-0 tw:flex-1 tw:text-left"
            direction="col"
            gap={0}>
            <Typography
              ellipsis
              as="span"
              className="tw:text-primary"
              data-testid="label"
              size={isRoot ? 'text-md' : 'text-sm'}
              weight="medium">
              {label}
            </Typography>
            <Typography
              as="span"
              className="tw:block"
              color="secondary"
              data-testid="type-tag"
              size="text-xs"
              weight="regular">
              {typeLabel}
            </Typography>
          </Box>
          {members && (
            <Avatar
              className="tw:shrink-0"
              colorVariant="neutral"
              data-testid="kg-node-member-count"
              initials={String(members.length)}
              size="xs"
            />
          )}
        </Box>
      </Button>
      {mapped && (
        <Box
          align="center"
          className="tw:px-3 tw:pb-2 tw:text-success-primary"
          gap={1}>
          <CheckCircle aria-hidden="true" size={12} />
          <Typography color="success" size="text-xs" weight="semibold">
            {t('label.kg-mapped-to-ontology')}
          </Typography>
        </Box>
      )}
      {members && (
        <Box
          className="tw:mx-3 tw:min-h-0 tw:border-t tw:border-secondary tw:pt-1"
          direction="col"
          gap={0}>
          {members.slice(0, 3).map((member) => {
            const MemberIcon = getNodeIcon(member.type);

            return (
              <Box
                align="center"
                className="tw:min-w-0"
                gap={2}
                key={member.id}>
                <MemberVisual
                  icon={
                    <MemberIcon
                      aria-hidden="true"
                      className="tw:shrink-0 tw:text-fg-quaternary"
                      size={12}
                    />
                  }
                  member={member}
                />
                <Typography
                  className="tw:min-w-0 tw:truncate tw:text-secondary"
                  size="text-xs">
                  {getGraphNodeLabel(member)}
                </Typography>
              </Box>
            );
          })}
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
              <Typography
                className="tw:text-quaternary"
                size="text-xs"
                weight="medium">
                {t('label.kg-more-count', { count: members.length - 3 })}
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </div>
  );
}

export default React.memo(
  CustomNode,
  (prev, next) => prev.nodeRenderKey === next.nodeRenderKey
);
