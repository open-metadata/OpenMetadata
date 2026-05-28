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
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import type { Key, Selection } from 'react-aria-components';
import { Tree } from '../components/application/tree/tree';

const meta = {
  title: 'Components/Tree',
  component: Tree,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div style={{ width: 300 }}>
      <Tree aria-label="File explorer">
        <Tree.Item id="src" textValue="src">
          <Tree.ItemContent>src/</Tree.ItemContent>
          <Tree.Item id="components" textValue="components">
            <Tree.ItemContent>components/</Tree.ItemContent>
            <Tree.Item id="button" textValue="Button.tsx">
              <Tree.ItemContent showExpandIcon={false}>
                Button.tsx
              </Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="input" textValue="Input.tsx">
              <Tree.ItemContent showExpandIcon={false}>
                Input.tsx
              </Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
          <Tree.Item id="utils" textValue="utils">
            <Tree.ItemContent>utils/</Tree.ItemContent>
            <Tree.Item id="cx" textValue="cx.ts">
              <Tree.ItemContent showExpandIcon={false}>cx.ts</Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
        </Tree.Item>
        <Tree.Item id="public" textValue="public">
          <Tree.ItemContent>public/</Tree.ItemContent>
          <Tree.Item id="index-html" textValue="index.html">
            <Tree.ItemContent showExpandIcon={false}>
              index.html
            </Tree.ItemContent>
          </Tree.Item>
        </Tree.Item>
      </Tree>
    </div>
  ),
};

export const DefaultExpanded: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Tree
        aria-label="Schema explorer"
        defaultExpandedKeys={['schema', 'tables']}>
        <Tree.Item id="schema" textValue="public">
          <Tree.ItemContent>public</Tree.ItemContent>
          <Tree.Item id="tables" textValue="Tables">
            <Tree.ItemContent>Tables</Tree.ItemContent>
            <Tree.Item id="orders" textValue="orders">
              <Tree.ItemContent showExpandIcon={false}>orders</Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="customers" textValue="customers">
              <Tree.ItemContent showExpandIcon={false}>
                customers
              </Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
          <Tree.Item id="views" textValue="Views">
            <Tree.ItemContent>Views</Tree.ItemContent>
            <Tree.Item id="v-summary" textValue="order_summary">
              <Tree.ItemContent showExpandIcon={false}>
                order_summary
              </Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
        </Tree.Item>
      </Tree>
    </div>
  ),
};

export const SingleSelection: StoryObj = {
  render: () => {
    const [selected, setSelected] = useState<Selection>(new Set(['orders']));

    return (
      <div style={{ width: 300 }}>
        <p style={{ fontSize: 13, marginBottom: 8, color: '#667085' }}>
          Selected:{' '}
          {selected === 'all'
            ? 'all'
            : [...(selected as Set<Key>)].join(', ') || 'none'}
        </p>
        <Tree
          aria-label="Single selection tree"
          defaultExpandedKeys={['tables']}
          selectedKeys={selected}
          selectionMode="single"
          onSelectionChange={setSelected}>
          <Tree.Item id="tables" textValue="Tables">
            <Tree.ItemContent>Tables</Tree.ItemContent>
            <Tree.Item id="orders" textValue="orders">
              <Tree.ItemContent showExpandIcon={false}>orders</Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="customers" textValue="customers">
              <Tree.ItemContent showExpandIcon={false}>
                customers
              </Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="products" textValue="products">
              <Tree.ItemContent showExpandIcon={false}>
                products
              </Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
          <Tree.Item id="views" textValue="Views">
            <Tree.ItemContent>Views</Tree.ItemContent>
            <Tree.Item id="v-summary" textValue="order_summary">
              <Tree.ItemContent showExpandIcon={false}>
                order_summary
              </Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
        </Tree>
      </div>
    );
  },
};

export const MultipleSelection: StoryObj = {
  render: () => {
    const [selected, setSelected] = useState<Selection>(
      new Set(['orders', 'customers'])
    );

    return (
      <div style={{ width: 300 }}>
        <p style={{ fontSize: 13, marginBottom: 8, color: '#667085' }}>
          Selected:{' '}
          {selected === 'all'
            ? 'all'
            : [...(selected as Set<Key>)].join(', ') || 'none'}
        </p>
        <Tree
          aria-label="Multi-select tree"
          defaultExpandedKeys={['databases']}
          selectedKeys={selected}
          selectionMode="multiple"
          onSelectionChange={setSelected}>
          <Tree.Item id="databases" textValue="Databases">
            <Tree.ItemContent>Databases</Tree.ItemContent>
            <Tree.Item id="orders" textValue="orders">
              <Tree.ItemContent showExpandIcon={false}>orders</Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="customers" textValue="customers">
              <Tree.ItemContent showExpandIcon={false}>
                customers
              </Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="products" textValue="products">
              <Tree.ItemContent showExpandIcon={false}>
                products
              </Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
        </Tree>
      </div>
    );
  },
};

export const WithDisabledItems: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Tree
        aria-label="Tree with disabled items"
        defaultExpandedKeys={['tables']}
        disabledKeys={['customers']}
        selectionMode="single">
        <Tree.Item id="tables" textValue="Tables">
          <Tree.ItemContent>Tables</Tree.ItemContent>
          <Tree.Item id="orders" textValue="orders">
            <Tree.ItemContent showExpandIcon={false}>orders</Tree.ItemContent>
          </Tree.Item>
          <Tree.Item id="customers" textValue="customers (disabled)">
            <Tree.ItemContent showExpandIcon={false}>
              customers (disabled)
            </Tree.ItemContent>
          </Tree.Item>
          <Tree.Item id="products" textValue="products">
            <Tree.ItemContent showExpandIcon={false}>products</Tree.ItemContent>
          </Tree.Item>
        </Tree.Item>
      </Tree>
    </div>
  ),
};

export const WithAction: StoryObj = {
  render: () => {
    const [lastAction, setLastAction] = useState<string>('');

    return (
      <div style={{ width: 300 }}>
        <p style={{ fontSize: 13, marginBottom: 8, color: '#667085' }}>
          Last action: {lastAction || 'none'}
        </p>
        <Tree
          aria-label="Actionable tree"
          defaultExpandedKeys={['pipeline']}
          onAction={(key) => setLastAction(String(key))}>
          <Tree.Item id="pipeline" textValue="Pipeline">
            <Tree.ItemContent>Pipeline</Tree.ItemContent>
            <Tree.Item id="extract" textValue="extract">
              <Tree.ItemContent showExpandIcon={false}>
                extract
              </Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="transform" textValue="transform">
              <Tree.ItemContent showExpandIcon={false}>
                transform
              </Tree.ItemContent>
            </Tree.Item>
            <Tree.Item id="load" textValue="load">
              <Tree.ItemContent showExpandIcon={false}>load</Tree.ItemContent>
            </Tree.Item>
          </Tree.Item>
        </Tree>
      </div>
    );
  },
};

export const EmptyState: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Tree
        aria-label="Empty tree"
        renderEmptyState={() => (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              color: '#667085',
              fontSize: 14,
            }}>
            No items found
          </div>
        )}>
        {[]}
      </Tree>
    </div>
  ),
};

export const WithLoadMore: StoryObj = {
  render: () => {
    const [isLoading, setIsLoading] = useState(false);
    const [items, setItems] = useState(['orders', 'customers', 'products']);

    const handleLoadMore = () => {
      setIsLoading(true);
      setTimeout(() => {
        setItems((prev) => [...prev, 'invoices', 'shipments']);
        setIsLoading(false);
      }, 1500);
    };

    return (
      <div style={{ width: 300 }}>
        <Tree aria-label="Tree with load more" defaultExpandedKeys={['tables']}>
          <Tree.Item id="tables" textValue="Tables">
            <Tree.ItemContent>Tables</Tree.ItemContent>
            {items.map((item) => (
              <Tree.Item id={item} key={item} textValue={item}>
                <Tree.ItemContent showExpandIcon={false}>
                  {item}
                </Tree.ItemContent>
              </Tree.Item>
            ))}
            <Tree.LoadMoreItem isLoading={isLoading} onPress={handleLoadMore} />
          </Tree.Item>
        </Tree>
      </div>
    );
  },
};

export const DeeplyNested: StoryObj = {
  render: () => (
    <div style={{ width: 300 }}>
      <Tree
        aria-label="Deeply nested tree"
        defaultExpandedKeys={['org', 'team', 'project']}>
        <Tree.Item id="org" textValue="Collate">
          <Tree.ItemContent>Collate</Tree.ItemContent>
          <Tree.Item id="team" textValue="Data Engineering">
            <Tree.ItemContent>Data Engineering</Tree.ItemContent>
            <Tree.Item id="project" textValue="Pipelines">
              <Tree.ItemContent>Pipelines</Tree.ItemContent>
              <Tree.Item id="etl" textValue="ETL">
                <Tree.ItemContent>ETL</Tree.ItemContent>
                <Tree.Item id="job-1" textValue="daily_orders">
                  <Tree.ItemContent showExpandIcon={false}>
                    daily_orders
                  </Tree.ItemContent>
                </Tree.Item>
                <Tree.Item id="job-2" textValue="hourly_events">
                  <Tree.ItemContent showExpandIcon={false}>
                    hourly_events
                  </Tree.ItemContent>
                </Tree.Item>
              </Tree.Item>
            </Tree.Item>
          </Tree.Item>
        </Tree.Item>
      </Tree>
    </div>
  ),
};

export const ControlledExpansion: StoryObj = {
  render: () => {
    const [expanded, setExpanded] = useState<Set<Key>>(new Set(['root']));

    return (
      <div style={{ width: 300 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #D0D5DD',
              cursor: 'pointer',
            }}
            onClick={() =>
              setExpanded(new Set(['root', 'group-a', 'group-b']))
            }>
            Expand all
          </button>
          <button
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid #D0D5DD',
              cursor: 'pointer',
            }}
            onClick={() => setExpanded(new Set())}>
            Collapse all
          </button>
        </div>
        <Tree
          aria-label="Controlled expansion tree"
          expandedKeys={expanded}
          onExpandedChange={setExpanded}>
          <Tree.Item id="root" textValue="Root">
            <Tree.ItemContent>Root</Tree.ItemContent>
            <Tree.Item id="group-a" textValue="Group A">
              <Tree.ItemContent>Group A</Tree.ItemContent>
              <Tree.Item id="a1" textValue="Item A1">
                <Tree.ItemContent showExpandIcon={false}>
                  Item A1
                </Tree.ItemContent>
              </Tree.Item>
              <Tree.Item id="a2" textValue="Item A2">
                <Tree.ItemContent showExpandIcon={false}>
                  Item A2
                </Tree.ItemContent>
              </Tree.Item>
            </Tree.Item>
            <Tree.Item id="group-b" textValue="Group B">
              <Tree.ItemContent>Group B</Tree.ItemContent>
              <Tree.Item id="b1" textValue="Item B1">
                <Tree.ItemContent showExpandIcon={false}>
                  Item B1
                </Tree.ItemContent>
              </Tree.Item>
            </Tree.Item>
          </Tree.Item>
        </Tree>
      </div>
    );
  },
};
