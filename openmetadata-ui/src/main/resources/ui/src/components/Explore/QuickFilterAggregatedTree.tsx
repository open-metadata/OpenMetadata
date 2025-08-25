/*
 *  Copyright 2025 Collate.
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
/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
import { Button, Card, Dropdown, Space, Tree, Typography } from 'antd';
import { Key, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDown } from '../../assets/svg/drop-down.svg';
import { Bucket } from '../../interface/search.interface';
import { SearchDropdownOption } from '../SearchDropdown/SearchDropdown.interface';

type TreeNode = {
  title: string;
  key: string; // use FQN as key
  children?: TreeNode[];
  count?: number;
};

type Props = {
  label: string;
  buckets?: Bucket[]; // aggregated buckets for tags.tagFQN
  selected: SearchDropdownOption[];
  onChange: (values: SearchDropdownOption[]) => void;
  triggerButtonSize?: 'large' | 'middle' | 'small';
  onOpen?: () => void;
};

const fqnSegments = (fqn: string) => fqn.split('.').filter(Boolean);

const buildTreeFromBuckets = (buckets: Bucket[]): TreeNode[] => {
  const root: Record<string, TreeNode> = {};
  for (const b of buckets) {
    const rawKey = String(b.key);
    const segs = fqnSegments(rawKey);
    if (segs.length === 0) {
      continue;
    }
    let currentLevel = root;
    let path = '';
    for (let i = 0; i < segs.length; i++) {
      const normSeg = segs[i].toLowerCase();
      path = path ? `${path}.${normSeg}` : normSeg;
      if (!currentLevel[path]) {
        currentLevel[path] = {
          title: segs[i],
          key: path,
          children: {} as any,
        } as any;
      } else {
        // prefer an all-caps display if encountered (e.g., PII)
        const existing = currentLevel[path] as any;
        const isAllCaps = /^[A-Z0-9_]+$/.test(segs[i]);
        if (isAllCaps) {
          existing.title = segs[i];
        }
      }
      if (i === segs.length - 1) {
        // leaf count
        (currentLevel[path] as any).count = b.doc_count ?? 0;
      }
      // dive deeper
      currentLevel = (currentLevel[path] as any).children as Record<
        string,
        TreeNode
      >;
    }
  }

  const toArray = (level: Record<string, TreeNode>): TreeNode[] => {
    const arr = Object.values(level).map((node) => {
      const childrenObj = (node as any).children as
        | Record<string, TreeNode>
        | undefined;
      const children = childrenObj ? toArray(childrenObj) : undefined;
      const total =
        (node.count ?? 0) +
        (children?.reduce((acc, c) => acc + (c as any)._total, 0) ?? 0);
      const res: TreeNode & { _total: number } = {
        title: node.title,
        key: node.key,
        children,
        count: node.count,
        _total: total,
      };
      res.title = `${node.title}${
        typeof total === 'number' ? ` (${total})` : ''
      }`;

      return res as unknown as TreeNode;
    });
    // Sort alphabetically on raw title (before count)
    const sortKey = (t: string) => t.toLowerCase().replace(/\s*\(\d+\)$/, '');

    return arr.sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)));
  };

  return toArray(root);
};

const collectLeafKeys = (nodes: TreeNode[]): string[] => {
  const out: string[] = [];
  const walk = (n: TreeNode) => {
    if (!n.children || n.children.length === 0) {
      out.push(n.key);
    } else {
      n.children.forEach(walk);
    }
  };
  nodes.forEach(walk);

  return out;
};

const getDescendantLeafKeys = (
  nodesIndex: Map<string, TreeNode>,
  nodeKey: string
): string[] => {
  const node = nodesIndex.get(nodeKey);
  if (!node) {
    return [];
  }

  return collectLeafKeys([node]);
};

const indexNodes = (nodes: TreeNode[]): Map<string, TreeNode> => {
  const map = new Map<string, TreeNode>();
  const walk = (n: TreeNode) => {
    map.set(n.key, n);
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);

  return map;
};

const QuickFilterAggregatedTree = ({
  label,
  buckets,
  selected,
  onChange,
  triggerButtonSize = 'small',
  onOpen,
}: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const treeData = useMemo(
    () => buildTreeFromBuckets(buckets ?? []),
    [buckets]
  );
  const nodesIndex = useMemo(() => indexNodes(treeData), [treeData]);
  const [checkedKeys, setCheckedKeys] = useState<Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);

  useEffect(() => {
    setCheckedKeys((selected ?? []).map((s) => s.key));
  }, [selected]);

  const handleSave = () => {
    // Map any parent selections to their descendant leaf keys
    const resolvedLeafKeys = new Set<string>();
    (checkedKeys as string[]).forEach((k) => {
      const leaves = getDescendantLeafKeys(nodesIndex, k);
      if (leaves.length) {
        leaves.forEach((l) => resolvedLeafKeys.add(l));
      } else {
        resolvedLeafKeys.add(k);
      }
    });
    const values: SearchDropdownOption[] = Array.from(resolvedLeafKeys).map(
      (k) => ({
        key: k,
        label: k.split('.').join(' > '),
      })
    );
    onChange(values);
    setOpen(false);
  };

  // Expand parents of selected keys to make them visible
  useEffect(() => {
    if (!selected || selected.length === 0) {
      setExpandedKeys([]);

      return;
    }
    const keys = new Set<string>();
    (selected ?? []).forEach((s) => {
      const segs = fqnSegments(s.key);
      let prefix = '';
      for (let i = 0; i < segs.length - 1; i++) {
        prefix = prefix ? `${prefix}.${segs[i]}` : segs[i];
        keys.add(prefix);
      }
    });
    setExpandedKeys(Array.from(keys));
  }, [selected, treeData]);

  const dropdownCard = (
    <Card
      bodyStyle={{ padding: 0 }}
      className="custom-dropdown-render"
      data-testid="drop-down-menu">
      <div style={{ maxHeight: 360, overflow: 'auto', padding: 8 }}>
        <Tree
          checkable
          checkedKeys={checkedKeys as any}
          expandedKeys={expandedKeys as any}
          selectable={false}
          treeData={treeData}
          onCheck={(k) => setCheckedKeys((k as any).checked || (k as any))}
          onExpand={(k) => setExpandedKeys(k as Key[])}
        />
      </div>
      <Space className="p-sm p-t-xss">
        <Button
          data-testid="clear-button"
          size="small"
          type="link"
          onClick={() => {
            setCheckedKeys([]);
            onChange([]);
          }}>
          {t('label.clear-entity', { entity: t('label.all') })}
        </Button>
        <Button
          className="update-btn"
          data-testid="update-btn"
          size="small"
          onClick={handleSave}>
          {t('label.update')}
        </Button>
        <Button
          data-testid="close-btn"
          size="small"
          type="link"
          onClick={() => setOpen(false)}>
          {t('label.close')}
        </Button>
      </Space>
    </Card>
  );

  const selectedSummary = useMemo(() => {
    const arr = selected ?? [];
    if (arr.length === 0) {
      return '';
    }
    if (arr.length === 1) {
      return arr[0].label;
    }
    if (arr.length === 2) {
      return `${arr[0].label}, ${arr[1].label}`;
    }

    return `${arr[0].label}, +${arr.length - 1}`;
  }, [selected]);

  return (
    <Dropdown
      destroyPopupOnHide
      dropdownRender={() => dropdownCard}
      open={open}
      trigger={['click']}
      onOpenChange={(v) => {
        if (v && onOpen) {
          onOpen();
        }
        setOpen(v);
      }}>
      <Button
        className="quick-filter-dropdown-trigger-btn"
        size={triggerButtonSize}>
        <Space size={4}>
          <Space size={0}>
            <Typography.Text className="filters-label font-medium">
              {label}
            </Typography.Text>
            {selected?.length ? (
              <span>
                {': '}
                <Typography.Text className="text-primary font-medium">
                  {selectedSummary.length > 30
                    ? `${selectedSummary.slice(0, 27)}...`
                    : selectedSummary}
                </Typography.Text>
              </span>
            ) : null}
          </Space>
          <DropDown className="flex self-center" height={12} width={12} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default QuickFilterAggregatedTree;
