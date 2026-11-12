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
  FeaturedIcon,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronRight, Share07 } from '@openmetadata/ui-core-components/icons';
import { TFunction } from 'i18next';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from './OntologyExplorer.interface';
import {
  getNativeTreePage,
  isNativeTreeExpanded,
  NativeTreeCursor,
  nativeTreeCursorForPath,
  NativeTreeIndex,
  NativeTreePlacement,
  nativeTreePlacementKey,
  NativeTreeState,
  revealNativeTreeSelection,
} from './OntologyStudio.utils';

interface NativeOntologyTreeViewProps {
  readonly index: NativeTreeIndex;
  /** Unused: every row is the handoff's 56px. Kept until the graph views stop passing it. */
  readonly density?: 'default' | 'compact';
  readonly emptyMessage?: string;
  readonly selectedNodeId?: string;
  readonly onConnect?: (node: OntologyNode) => void;
  readonly onSelect: (node: OntologyNode) => void;
  /** Names the tree: the ontology on one ontology, else "Concepts". */
  readonly title?: string;
}

const getTreeHeading = (title: string | undefined, t: TFunction) =>
  title ?? t('label.concept-plural');

const NativeTreeRowContent = ({
  row,
  childCount,
  showGroup,
  onConnect,
}: {
  row: NativeTreePlacement;
  childCount: number;
  /** All ontologies names each root's ontology; one ontology names it once in the heading. */
  showGroup: boolean;
  onConnect?: (node: OntologyNode) => void;
}) => {
  const { t } = useTranslation();
  const isRoot = row.path.length === 1;

  return (
    <>
      <span
        aria-hidden="true"
        className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-fg-brand-secondary"
      />
      <Box className="tw:min-w-0 tw:flex-1" direction="col">
        <Box align="center" className="tw:min-w-0" gap={2}>
          <Typography
            ellipsis
            size="text-sm"
            weight={isRoot ? 'semibold' : 'regular'}>
            {row.node.label}
          </Typography>
          {row.hasChildren ? (
            <Typography
              className="tw:shrink-0"
              color="secondary"
              size="text-xs">
              {t('label.n-children', { count: childCount })}
            </Typography>
          ) : null}
        </Box>
        {row.otherParents.length > 0 ? (
          <Typography color="secondary" size="text-xs">
            {t('label.ontology-also-under', {
              parents: row.otherParents.map(({ label }) => label).join(', '),
            })}
          </Typography>
        ) : null}
        {[isRoot, row.node.group, showGroup].every(Boolean) ? (
          <Typography color="secondary" size="text-xs">
            {row.node.group}
          </Typography>
        ) : null}
      </Box>
      {row.isIsolated && onConnect ? (
        <Button color="link-gray" size="sm" onPress={() => onConnect(row.node)}>
          {t('label.connect')}
        </Button>
      ) : (
        <Badge color="gray" size="sm" type="pill-color">
          {t('label.x-relations', { count: row.relationCount })}
        </Badge>
      )}
      <ChevronRight
        aria-hidden="true"
        className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
      />
    </>
  );
};

/**
 * Expanding or collapsing a row keeps the current window, so the rows above it
 * stay in view. Only collapsing the parent of the window's first row hides
 * that row, and then the window starts at the collapsed row instead.
 */
const anchorAfterToggle = (
  index: NativeTreeIndex,
  anchor: NativeTreeCursor | undefined,
  path: readonly string[],
  isExpanded: boolean
) => {
  const hidesAnchor =
    !isExpanded &&
    anchor !== undefined &&
    anchor.frames.length > path.length &&
    path.every((conceptId, depth) => anchor.frames[depth]?.conceptId === conceptId);

  return hidesAnchor ? nativeTreeCursorForPath(index, path) : anchor;
};

const NativeOntologyTreeView = ({
  index,
  emptyMessage,
  selectedNodeId,
  onConnect,
  onSelect,
  title,
}: NativeOntologyTreeViewProps) => {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<NativeTreeState>(() =>
    revealNativeTreeSelection(index, selectedNodeId)
  );
  const [syncedId, setSyncedId] = useState(selectedNodeId);
  if (state.index !== index) {
    setSyncedId(selectedNodeId);
    setState(revealNativeTreeSelection(index, selectedNodeId, state));
  } else if (syncedId !== selectedNodeId) {
    setSyncedId(selectedNodeId);
    if (selectedNodeId !== state.selectedId) {
      setState(revealNativeTreeSelection(index, selectedNodeId, state));
    }
  }
  const page = useMemo(
    () =>
      getNativeTreePage(index, state.disclosure, state.anchor, state.direction),
    [index, state.disclosure, state.anchor, state.direction]
  );
  const rows = useMemo(() => [...page.context, ...page.placements], [page]);
  const byKey = useMemo(
    () => new Map(rows.map((row) => [row.key, row])),
    [rows]
  );
  const expandedKeys = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.hasChildren && isNativeTreeExpanded(state.disclosure, row.key)
        )
        .map(({ key }) => key),
    [rows, state.disclosure]
  );
  useEffect(() => {
    if (state.reveal) {
      const focusSelected = () => {
        const selected = host.current?.querySelector<HTMLElement>(
          '[aria-selected="true"]'
        );
        selected?.focus();

        return Boolean(selected);
      };
      if (focusSelected() || !host.current) {
        return;
      }
      const observer = new MutationObserver(() => {
        if (focusSelected()) {
          observer.disconnect();
        }
      });
      observer.observe(host.current, { childList: true, subtree: true });

      return () => observer.disconnect();
    }

    return undefined;
  }, [state.reveal]);
  const treeItems = useMemo(() => {
    const children = new Map<string, ReactNode[]>();
    const roots: ReactNode[] = [];
    for (let position = rows.length - 1; position >= 0; position--) {
      const row = rows[position];
      const element = (
        <Tree.Item
          data-testid={`ontology-tree-term-${row.node.id}`}
          hasChildItems={row.hasChildren}
          id={row.key}
          key={row.key}
          textValue={row.node.label}>
          <Tree.ItemContent
            className="tw:min-h-14"
            hasChildItems={row.hasChildren}
            maxIndentLevel={16}>
            <NativeTreeRowContent
              childCount={index.children.get(row.node.id)?.length ?? 0}
              row={row}
              showGroup={!title}
              onConnect={onConnect}
            />
          </Tree.ItemContent>
          {children.get(row.key)}
        </Tree.Item>
      );
      if (row.path.length > 1) {
        const parentKey = nativeTreePlacementKey(index, row.path.slice(0, -1));
        const siblings = children.get(parentKey) ?? [];
        siblings.unshift(element);
        children.set(parentKey, siblings);
      } else {
        roots.unshift(element);
      }
    }

    return roots;
  }, [rows, index, onConnect, title]);
  // With a row selected, React Aria drops Enter and clicks on other rows in the
  // default toggle behaviour; replace behaviour reports clicks as selection changes.
  const openRow = (key: Key) => {
    const row = byKey.get(String(key));
    if (row) {
      setState({
        ...state,
        selectedId: row.node.id,
        selectedKey: row.key,
        reveal: undefined,
      });
      onSelect(row.node);
    }
  };
  if (!index.nodes.size) {
    return (
      <Box data-testid="ontology-tree-view">
        <Typography>
          {emptyMessage ??
            t('label.no-entity-found', { entity: t('label.concept-plural') })}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      className="tw:mx-auto tw:h-full tw:w-full tw:max-w-250 tw:overflow-auto tw:px-6 tw:pt-5 tw:pb-20"
      data-testid="ontology-tree-view"
      direction="col"
      gap={3}
      ref={host}>
      <Box align="center" gap={3} justify="between">
        <Box align="center" className="tw:min-w-0" gap={3}>
          <FeaturedIcon color="brand" icon={Share07} size="md" theme="light" />
          <Box className="tw:min-w-0" direction="col">
            <Typography ellipsis weight="semibold">
              {getTreeHeading(title, t)}
            </Typography>
            <Typography
              color="secondary"
              data-testid="ontology-tree-counts"
              size="text-xs">
              {t('message.ontology-tree-counts', {
                concepts: index.nodes.size,
                roots: index.roots.length,
              })}
            </Typography>
          </Box>
        </Box>
        <Box gap={2}>
          <Button
            color="link-gray"
            data-testid="ontology-tree-expand-all"
            size="sm"
            onPress={() =>
              setState({
                ...state,
                disclosure: { expanded: true, overrides: new Map() },
                anchor: undefined,
                direction: 'forward',
                reveal: undefined,
              })
            }>
            {t('label.expand-all-lowercase')}
          </Button>
          <Button
            color="link-gray"
            data-testid="ontology-tree-collapse-all"
            size="sm"
            onPress={() =>
              setState({
                ...state,
                disclosure: { expanded: false, overrides: new Map() },
                anchor: undefined,
                direction: 'forward',
                reveal: undefined,
              })
            }>
            {t('label.collapse-all-lowercase')}
          </Button>
        </Box>
      </Box>
      {page.previous || page.next ? (
        <Box gap={2} ref={navigation}>
          <Button
            aria-disabled={!page.previous}
            color="secondary"
            data-testid="ontology-tree-previous"
            data-tree-direction="previous"
            size="sm"
            onPress={() => {
              if (!page.previous) {
                return;
              }
              navigation.current
                ?.querySelector<HTMLButtonElement>(
                  '[data-tree-direction="previous"]'
                )
                ?.focus();
              setState({
                ...state,
                anchor: page.previous,
                direction: 'backward',
                reveal: undefined,
              });
            }}>
            {t('label.previous')}
          </Button>
          <Button
            aria-disabled={!page.next}
            color="secondary"
            data-testid="ontology-tree-next"
            data-tree-direction="next"
            size="sm"
            onPress={() => {
              if (!page.next) {
                return;
              }
              navigation.current
                ?.querySelector<HTMLButtonElement>(
                  '[data-tree-direction="next"]'
                )
                ?.focus();
              setState({
                ...state,
                anchor: page.next,
                direction: 'forward',
                reveal: undefined,
              });
            }}>
            {t('label.next')}
          </Button>
        </Box>
      ) : null}
      {/* The card keeps its full height so the list scrolls instead of clipping rows. */}
      <Card className="tw:shrink-0 tw:overflow-hidden">
        <Tree
          aria-label={t('label.concept-plural')}
          className="tw:gap-0 tw:divide-y tw:divide-secondary"
          expandedKeys={expandedKeys}
          selectedKeys={
            state.selectedKey && byKey.has(state.selectedKey)
              ? [state.selectedKey]
              : []
          }
          selectionBehavior="replace"
          selectionMode="single"
          onAction={openRow}
          onExpandedChange={(keys) => {
            const changed = rows.find(
              (row) =>
                row.hasChildren &&
                keys.has(row.key) !==
                  isNativeTreeExpanded(state.disclosure, row.key)
            );
            if (changed) {
              const overrides = new Map(state.disclosure.overrides);
              overrides.set(changed.key, keys.has(changed.key));
              setState({
                ...state,
                disclosure: { ...state.disclosure, overrides },
                anchor: anchorAfterToggle(
                  index,
                  state.anchor,
                  changed.path,
                  keys.has(changed.key)
                ),
                reveal: undefined,
              });
            }
          }}
          onSelectionChange={(keys) => {
            const [key] = keys === 'all' ? [] : keys;
            if (key !== undefined) {
              openRow(key);
            }
          }}>
          {treeItems}
        </Tree>
      </Card>
    </Box>
  );
};

export default NativeOntologyTreeView;
