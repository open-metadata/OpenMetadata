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
  Card,
  Dot,
  FeaturedIcon,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronRight,
  Link01,
  Share07,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, useMemo, useState } from 'react';
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useIsAiMode } from '../../hooks/useAppMode';
import { OntologyNode } from './OntologyExplorer.interface';
import {
  nestTreeRows,
  OntologyTreeGroup,
  OntologyTreeItem,
  OntologyTreeMetric,
} from './OntologyStudio.utils';

interface OntologyTreeViewProps {
  readonly density?: 'default' | 'compact';
  readonly emptyMessage?: string;
  readonly selectedNodeId?: string;
  readonly groups: OntologyTreeGroup[];
  readonly metrics: OntologyTreeMetric[];
  readonly onConnect?: (node: OntologyNode) => void;
  readonly onSelect: (node: OntologyNode) => void;
}

// The tree never indents past this level, however deep the hierarchy.
const MAX_INDENT_LEVEL = 16;
const TREE_CLASS = 'tw:gap-0 tw:divide-y tw:divide-secondary';
const AI_ROW_CONTENT_CLASS =
  'tw:min-h-14 tw:py-2 tw:pr-4 tw:hover:bg-transparent';
const ROW_CLASS = 'tw:rounded-none tw:pl-3 tw:hover:bg-primary_hover';
const ROW_CONTENT_CLASS = 'tw:py-3 tw:pr-4 tw:hover:bg-transparent';

const collectParentIds = (items: OntologyTreeItem[]): string[] =>
  items.flatMap((item) =>
    item.children.length > 0
      ? [item.node.id, ...collectParentIds(item.children)]
      : []
  );

interface TreeSectionHeaderProps {
  readonly actions?: ReactNode;
  readonly count: number;
  readonly countColor?: 'gray' | 'warning';
  readonly title: string;
}

const TreeSectionHeader = ({
  actions,
  count,
  countColor = 'gray',
  title,
}: TreeSectionHeaderProps) => (
  <Box align="center" gap={2} justify="between">
    <Box align="center" gap={2}>
      <Typography
        aria-level={3}
        className="tw:text-primary"
        role="heading"
        size="text-md"
        weight="semibold">
        {title}
      </Typography>
      <Badge color={countColor} size="sm" type="pill-color">
        {count}
      </Badge>
    </Box>
    {actions}
  </Box>
);

interface ConceptsSectionHeaderProps {
  readonly count: number;
  readonly groups: OntologyTreeGroup[];
  readonly onCollapseAll: () => void;
  readonly onExpandAll: () => void;
}

const ConceptsSectionHeader = ({
  count,
  groups,
  onCollapseAll,
  onExpandAll,
}: ConceptsSectionHeaderProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const buttonProps = isAiMode
    ? ({ color: 'tertiary', size: 'xs' } as const)
    : ({ color: 'link-gray', size: 'sm' } as const);
  const actions = (
    <Box gap={isAiMode ? 1 : 4}>
      <Button
        {...buttonProps}
        data-testid="ontology-tree-expand-all"
        onPress={onExpandAll}>
        {t('label.expand-all')}
      </Button>
      <Button
        {...buttonProps}
        data-testid="ontology-tree-collapse-all"
        onPress={onCollapseAll}>
        {t('label.collapse-all')}
      </Button>
    </Box>
  );

  if (!isAiMode) {
    return (
      <TreeSectionHeader
        actions={actions}
        count={count}
        title={t('label.concept-plural')}
      />
    );
  }

  return (
    <Box align="center" gap={3}>
      <FeaturedIcon color="brand" icon={Share07} size="md" theme="light" />
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Typography
          ellipsis
          aria-level={3}
          className="tw:text-primary"
          role="heading"
          size="text-sm"
          weight="medium">
          {groups.length === 1
            ? groups[0].glossaryName
            : t('label.concept-plural')}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-xs">
          {`${count} ${t('label.concept-plural').toLocaleLowerCase()}`}
        </Typography>
      </Box>
      {actions}
    </Box>
  );
};

interface TreeRowTextProps {
  readonly compact?: boolean;
  readonly meta?: ReactNode;
  readonly node: OntologyNode;
}

const TreeRowText = ({ compact, meta, node }: TreeRowTextProps) => (
  <Box className="tw:min-w-0 tw:flex-1" direction="col">
    <Box align="center" gap={2}>
      <Typography
        className="tw:text-primary"
        size={compact ? 'text-sm' : 'text-md'}
        weight="medium">
        {node.label}
      </Typography>
      {meta}
    </Box>
    {!compact && node.fullyQualifiedName ? (
      <Typography ellipsis className="tw:text-tertiary" size="text-sm">
        {node.fullyQualifiedName}
      </Typography>
    ) : null}
  </Box>
);

const TreeRowRelations = ({ count }: { readonly count: number }) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();

  return (
    <Box align="center" className="tw:shrink-0" gap={3}>
      {isAiMode ? (
        <Badge color="gray" size="sm" type="pill-color">
          {t('label.x-relations', { count })}
        </Badge>
      ) : (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('label.x-relations', { count })}
        </Typography>
      )}
      <ChevronRight
        aria-hidden="true"
        className="tw:size-4 tw:text-fg-quaternary"
      />
    </Box>
  );
};

const ConceptTreeItem = ({
  item,
  compact,
}: {
  readonly item: OntologyTreeItem;
  readonly compact: boolean;
}) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const childCount = item.children.length;
  const contentClass = compact
    ? 'tw:py-1.5 tw:pr-4 tw:hover:bg-transparent'
    : ROW_CONTENT_CLASS;

  return (
    <Tree.Item
      className={ROW_CLASS}
      data-testid={`ontology-tree-term-${item.node.id}`}
      id={item.node.id}
      textValue={item.node.label}>
      <Tree.ItemContent
        className={isAiMode ? AI_ROW_CONTENT_CLASS : contentClass}
        indentPerLevel={compact ? 24 : 42}
        maxIndentLevel={MAX_INDENT_LEVEL}>
        <Dot className="tw:shrink-0 tw:text-utility-brand-400" size="sm" />
        <TreeRowText
          compact={compact}
          meta={
            <>
              {childCount > 0 ? (
                <Typography className="tw:text-quaternary" size="text-sm">
                  {t('label.x-children', { count: childCount })}
                </Typography>
              ) : null}
              {item.parentCount > 1 ? (
                <Badge color="purple" size="sm" type="pill-color">
                  {t('label.polyhierarchy')}
                </Badge>
              ) : null}
            </>
          }
          node={item.node}
        />
        <TreeRowRelations count={item.relationCount} />
      </Tree.ItemContent>
      {item.children.map((child) => (
        <ConceptTreeItem compact={compact} item={child} key={child.node.id} />
      ))}
    </Tree.Item>
  );
};

const OntologyTreeView = ({
  density = 'default',
  emptyMessage,
  selectedNodeId,
  groups,
  metrics,
  onConnect,
  onSelect,
}: OntologyTreeViewProps) => {
  const { t } = useTranslation();
  const compact = density === 'compact';
  const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const concepts = useMemo(
    () => nestTreeRows(rows.filter((row) => !row.isIsolated)),
    [rows]
  );
  const unconnected = rows.filter((row) => row.isIsolated);
  const parentIds = useMemo(() => collectParentIds(concepts), [concepts]);
  const [collapsedIds, setCollapsedIds] = useState<Set<Key>>(new Set());
  const expandedKeys = parentIds.filter((id) => !collapsedIds.has(id));
  const nodeById = useMemo(
    () =>
      new Map(
        [...rows.map((row) => row.node), ...metrics.map((m) => m.node)].map(
          (node) => [node.id, node]
        )
      ),
    [rows, metrics]
  );
  const handleAction = (key: Key) => {
    const node = nodeById.get(String(key));
    if (node) {
      onSelect(node);
    }
  };

  if (rows.length === 0 && metrics.length === 0) {
    return (
      <Box
        className="tw:flex-1 tw:p-10"
        data-testid="ontology-tree-view"
        justify="center">
        <Typography className="tw:text-quaternary" size="text-sm">
          {emptyMessage ?? t('message.no-glossary-terms-found')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className="tw:h-full tw:flex-1 tw:overflow-auto tw:px-6 tw:py-5"
      data-testid="ontology-tree-view"
      direction="col"
      gap={8}>
      {concepts.length > 0 ? (
        <Box data-testid="ontology-tree-concepts" direction="col" gap={3}>
          <ConceptsSectionHeader
            count={rows.length - unconnected.length}
            groups={groups}
            onCollapseAll={() => setCollapsedIds(new Set(parentIds))}
            onExpandAll={() => setCollapsedIds(new Set())}
          />
          <Card>
            <Tree
              aria-label={t('label.concept-plural')}
              className={TREE_CLASS}
              expandedKeys={expandedKeys}
              selectedKeys={selectedNodeId ? [selectedNodeId] : []}
              selectionMode="single"
              onAction={handleAction}
              onExpandedChange={(keys) =>
                setCollapsedIds(
                  new Set(parentIds.filter((id) => !keys.has(id)))
                )
              }>
              {concepts.map((item) => (
                <ConceptTreeItem
                  compact={compact}
                  item={item}
                  key={item.node.id}
                />
              ))}
            </Tree>
          </Card>
        </Box>
      ) : null}

      {metrics.length > 0 ? (
        <Box data-testid="ontology-tree-metrics" direction="col" gap={3}>
          <TreeSectionHeader
            count={metrics.length}
            title={t('label.metric-plural')}
          />
          <Card>
            <Tree
              aria-label={t('label.metric-plural')}
              className={TREE_CLASS}
              selectedKeys={selectedNodeId ? [selectedNodeId] : []}
              selectionMode="single"
              onAction={handleAction}>
              {metrics.map(({ measures, node }) => (
                <Tree.Item
                  className={ROW_CLASS}
                  data-testid={`ontology-tree-metric-${node.id}`}
                  id={node.id}
                  key={node.id}
                  textValue={node.label}>
                  <Tree.ItemContent className={ROW_CONTENT_CLASS}>
                    <Dot
                      className="tw:shrink-0 tw:text-utility-blue-dark-600"
                      size="sm"
                    />
                    <TreeRowText compact={compact} node={node} />
                    <Box align="center" className="tw:shrink-0" gap={2}>
                      <Typography className="tw:text-tertiary" size="text-sm">
                        {t('label.measure-plural')}
                      </Typography>
                      {measures.map((term) => (
                        <Badge
                          color="brand"
                          key={term.id}
                          size="sm"
                          type="pill-color">
                          {term.label}
                        </Badge>
                      ))}
                    </Box>
                    <TreeRowRelations count={measures.length} />
                  </Tree.ItemContent>
                </Tree.Item>
              ))}
            </Tree>
          </Card>
        </Box>
      ) : null}

      {unconnected.length > 0 ? (
        <Box data-testid="ontology-tree-unconnected" direction="col" gap={3}>
          <Box direction="col" gap={1}>
            <TreeSectionHeader
              count={unconnected.length}
              countColor="warning"
              title={t('label.not-connected')}
            />
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.ontology-not-connected-description')}
            </Typography>
          </Box>
          <Card>
            <Tree
              aria-label={t('label.not-connected')}
              className={TREE_CLASS}
              selectedKeys={selectedNodeId ? [selectedNodeId] : []}
              selectionMode="single"
              onAction={handleAction}>
              {unconnected.map(({ node }) => (
                <Tree.Item
                  className={ROW_CLASS}
                  data-testid={`ontology-tree-term-${node.id}`}
                  id={node.id}
                  key={node.id}
                  textValue={node.label}>
                  <Tree.ItemContent className={ROW_CONTENT_CLASS}>
                    <Dot
                      className="tw:shrink-0 tw:text-utility-warning-500"
                      size="sm"
                    />
                    <TreeRowText compact={compact} node={node} />
                    {onConnect ? (
                      <Button
                        color="secondary"
                        data-testid={`ontology-tree-connect-${node.id}`}
                        iconLeading={Link01}
                        size="sm"
                        onPress={() => onConnect?.(node)}>
                        {t('label.connect')}
                      </Button>
                    ) : null}
                  </Tree.ItemContent>
                </Tree.Item>
              ))}
            </Tree>
          </Card>
        </Box>
      ) : null}
    </Box>
  );
};

export default OntologyTreeView;
