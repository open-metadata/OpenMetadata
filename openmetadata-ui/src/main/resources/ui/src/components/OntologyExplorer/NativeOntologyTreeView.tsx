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
  ListLayout,
  Tree,
  Typography,
  Virtualizer,
} from '@openmetadata/ui-core-components';
import { ChevronRight, Share07 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import {
  MutableRefObject,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
  TREE_INDENT_PER_LEVEL,
  TREE_MAX_INDENT_LEVEL,
  TREE_ROW_HEIGHT,
  TREE_VIRTUALIZATION_THRESHOLD,
} from './NativeOntologyTreeView.constants';
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
  /** Shown inside the card above the rows, divided from them. */
  readonly notice?: ReactNode;
  /** Readable conflict messages by concept id; those rows get a red dot and the messages. */
  readonly conflicts?: ReadonlyMap<string, readonly string[]>;
}

const getTreeHeading = (title: string | undefined, t: TFunction) =>
  title ?? t('label.concept-plural');

const NativeTreeRowContent = ({
  row,
  childCount,
  conflictMessages = [],
  showGroup,
  onConnect,
}: {
  row: NativeTreePlacement;
  childCount: number;
  conflictMessages?: readonly string[];
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
        className={`tw:size-2 tw:shrink-0 tw:rounded-full ${
          conflictMessages.length
            ? 'tw:bg-fg-error-primary'
            : 'tw:bg-fg-brand-secondary'
        }`}
        data-testid={
          conflictMessages.length ? 'ontology-tree-conflict-dot' : undefined
        }
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
        {conflictMessages.map((message) => (
          <Typography
            color="danger"
            data-testid="ontology-tree-conflict"
            key={message}
            size="text-xs">
            {message}
          </Typography>
        ))}
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
    path.every(
      (conceptId, depth) => anchor.frames[depth]?.conceptId === conceptId
    );

  return hidesAnchor ? nativeTreeCursorForPath(index, path) : anchor;
};

/** Content above the rows, inside the card and divided from them. */
const TreeNotice = ({ children }: { children?: ReactNode }) =>
  children ? (
    <div className="tw:border-b tw:border-secondary">{children}</div>
  ) : null;

const VIRTUAL_LAYOUT_OPTIONS = { estimatedRowHeight: TREE_ROW_HEIGHT };

/** A virtual list scrolls inside its card; a short one grows the card and the page scrolls. */
const TREE_LAYOUT = {
  virtual: {
    host: 'tw:overflow-hidden',
    card: 'tw:flex tw:min-h-0 tw:flex-1 tw:flex-col',
    tree: 'tw:min-h-0 tw:flex-1 tw:gap-0 tw:overflow-auto',
    // Positioned rows have no siblings for divide-y to draw between.
    item: 'tw:border-b tw:border-secondary',
  },
  flat: {
    host: 'tw:overflow-auto',
    card: 'tw:shrink-0',
    tree: 'tw:gap-0 tw:divide-y tw:divide-secondary',
    item: undefined,
  },
} as const;

const VirtualRows = ({
  isVirtual,
  children,
}: {
  isVirtual: boolean;
  children: ReactNode;
}) =>
  isVirtual ? (
    <Virtualizer layout={ListLayout} layoutOptions={VIRTUAL_LAYOUT_OPTIONS}>
      {children}
    </Virtualizer>
  ) : (
    <>{children}</>
  );

/** A stable stand-in for the host's latest connect callback, or none when it has none. */
const stableConnect = (
  ref: MutableRefObject<((node: OntologyNode) => void) | undefined>,
  enabled: boolean
) => (enabled ? (node: OntologyNode) => ref.current?.(node) : undefined);

const treeLayout = (rowCount: number) => {
  const isVirtual = rowCount > TREE_VIRTUALIZATION_THRESHOLD;

  return { isVirtual, layout: TREE_LAYOUT[isVirtual ? 'virtual' : 'flat'] };
};

/** A virtual list mounts only the rows on screen, so scroll the selected one in to mount it. */
const scrollToRow = (
  host: HTMLElement,
  rows: readonly NativeTreePlacement[],
  key: string | undefined
) => {
  const position = rows.findIndex((row) => row.key === key);
  const list = host.querySelector<HTMLElement>('[role="treegrid"]');
  if (list && position >= 0) {
    list.scrollTop = Math.max(0, (position - 2) * TREE_ROW_HEIGHT);
  }
};

const NativeOntologyTreeView = ({
  index,
  notice,
  conflicts,
  emptyMessage,
  selectedNodeId,
  onConnect,
  onSelect,
  title,
}: NativeOntologyTreeViewProps) => {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLDivElement>(null);
  // Hosts pass a fresh callback each render; reading it through a ref keeps the rows memoized,
  // since rebuilding a window of up to 2,048 rows on every selection took seconds on FIBO.
  const connectRef = useRef(onConnect);
  connectRef.current = onConnect;
  const canConnect = Boolean(onConnect);
  const connect = useMemo(
    () => stableConnect(connectRef, canConnect),
    [canConnect]
  );
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
  const { isVirtual, layout } = treeLayout(rows.length);
  // A paging button disables itself on the last page, which would drop focus to the page;
  // focus stays on it while it can still page, and moves to the other one once it cannot.
  const pagedDirection = useRef<'previous' | 'next'>();
  useEffect(() => {
    const direction = pagedDirection.current;
    if (!direction) {
      return;
    }
    pagedDirection.current = undefined;
    const other = direction === 'next' ? 'previous' : 'next';
    navigation.current
      ?.querySelector<HTMLButtonElement>(
        `[data-tree-direction="${page[direction] ? direction : other}"]`
      )
      ?.focus();
  }, [page]);
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
      scrollToRow(host.current, rows, state.selectedKey);
      const observer = new MutationObserver(() => {
        if (focusSelected()) {
          observer.disconnect();
        }
      });
      observer.observe(host.current, { childList: true, subtree: true });

      return () => observer.disconnect();
    }

    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per reveal, for the rows of that reveal
  }, [state.reveal]);
  const treeItems = useMemo(() => {
    const children = new Map<string, ReactNode[]>();
    const roots: ReactNode[] = [];
    for (let position = rows.length - 1; position >= 0; position--) {
      const row = rows[position];
      const element = (
        <Tree.Item
          className={layout.item}
          data-testid={`ontology-tree-term-${row.node.id}`}
          hasChildItems={row.hasChildren}
          id={row.key}
          key={row.key}
          textValue={row.node.label}>
          {/* The row indents its own content, not the item, so hover and selection fill the row. */}
          <Tree.ItemContent
            className="tw:min-h-14"
            hasChildItems={row.hasChildren}
            maxIndentLevel={1}
            showExpandIcon={false}>
            <div
              className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3"
              style={{
                paddingLeft: `${
                  Math.min(row.path.length - 1, TREE_MAX_INDENT_LEVEL) *
                  TREE_INDENT_PER_LEVEL
                }px`,
              }}>
              <Tree.ExpandButton
                className={classNames(
                  !row.hasChildren && 'tw:pointer-events-none tw:invisible'
                )}
              />
              <NativeTreeRowContent
                childCount={index.children.get(row.node.id)?.length ?? 0}
                conflictMessages={conflicts?.get(row.node.id)}
                row={row}
                showGroup={!title}
                onConnect={connect}
              />
            </div>
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
  }, [rows, index, conflicts, connect, title, layout]);
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
      className={classNames(
        'tw:h-full tw:w-full tw:px-6 tw:pt-5 tw:pb-20',
        layout.host
      )}
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
            color="secondary"
            data-testid="ontology-tree-previous"
            data-tree-direction="previous"
            isDisabled={!page.previous}
            size="sm"
            onPress={() => {
              pagedDirection.current = 'previous';
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
            color="secondary"
            data-testid="ontology-tree-next"
            data-tree-direction="next"
            isDisabled={!page.next}
            size="sm"
            onPress={() => {
              pagedDirection.current = 'next';
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
      <Card className={classNames('tw:overflow-hidden', layout.card)}>
        <TreeNotice>{notice}</TreeNotice>
        <VirtualRows isVirtual={isVirtual}>
          <Tree
            aria-label={t('label.concept-plural')}
            className={layout.tree}
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
                // A backward window ends at its anchor; re-anchor on its first row
                // so the toggled rows grow downward instead of off the top.
                const [first] = page.placements;
                const forwardAnchor =
                  state.direction === 'backward' && first
                    ? nativeTreeCursorForPath(index, first.path)
                    : state.anchor;
                setState({
                  ...state,
                  disclosure: { ...state.disclosure, overrides },
                  anchor: anchorAfterToggle(
                    index,
                    forwardAnchor,
                    changed.path,
                    keys.has(changed.key)
                  ),
                  direction: 'forward',
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
        </VirtualRows>
      </Card>
    </Box>
  );
};

export default NativeOntologyTreeView;
