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
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from './OntologyExplorer.interface';
import {
  getNativeTreePage,
  isNativeTreeExpanded,
  nativeTreeCursorForPath,
  NativeTreeIndex,
  nativeTreePlacementKey,
  NativeTreeState,
  revealNativeTreeSelection,
} from './OntologyStudio.utils';

interface NativeOntologyTreeViewProps {
  readonly index: NativeTreeIndex;
  readonly density?: 'default' | 'compact';
  readonly emptyMessage?: string;
  readonly selectedNodeId?: string;
  readonly onConnect?: (node: OntologyNode) => void;
  readonly onSelect: (node: OntologyNode) => void;
}

const NativeOntologyTreeView = ({
  index,
  density,
  emptyMessage,
  selectedNodeId,
  onConnect,
  onSelect,
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
          <Tree.ItemContent hasChildItems={row.hasChildren} maxIndentLevel={16}>
            <Box className="tw:min-w-0 tw:flex-1" direction="col">
              <Typography
                size={density === 'compact' ? 'text-sm' : 'text-md'}
                weight="medium">
                {row.node.label}
              </Typography>
              {row.otherParents.length > 0 ? (
                <Typography color="secondary" size="text-xs">
                  {t('label.ontology-also-under', {
                    parents: row.otherParents
                      .map(({ label }) => label)
                      .join(', '),
                  })}
                </Typography>
              ) : null}
              {row.path.length === 1 && row.node.group ? (
                <Typography color="secondary" size="text-xs">
                  {row.node.group}
                </Typography>
              ) : null}
            </Box>
            {row.isIsolated && onConnect ? (
              <Button
                color="link-gray"
                size="sm"
                onPress={() => onConnect(row.node)}>
                {t('label.connect')}
              </Button>
            ) : (
              <Typography color="secondary" size="text-xs">
                {t('label.x-relations', { count: row.relationCount })}
              </Typography>
            )}
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
  }, [rows, index, density, onConnect, t]);
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
      className="tw:h-full tw:overflow-auto tw:px-6 tw:py-5"
      data-testid="ontology-tree-view"
      direction="col"
      gap={3}
      ref={host}>
      <Box align="center" gap={2} justify="between">
        <Box align="center" gap={2}>
          <Typography weight="semibold">{t('label.concept-plural')}</Typography>
          <Badge size="sm">{index.nodes.size}</Badge>
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
            {t('label.expand-all')}
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
            {t('label.collapse-all')}
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
      <Tree
        aria-label={t('label.concept-plural')}
        expandedKeys={expandedKeys}
        selectedKeys={
          state.selectedKey && byKey.has(state.selectedKey)
            ? [state.selectedKey]
            : []
        }
        selectionMode="single"
        onAction={(key) => {
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
        }}
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
              anchor: nativeTreeCursorForPath(index, changed.path),
              direction: 'forward',
              reveal: undefined,
            });
          }
        }}>
        {treeItems}
      </Tree>
    </Box>
  );
};

export default NativeOntologyTreeView;
