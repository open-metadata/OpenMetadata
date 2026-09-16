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
import React, { useState } from 'react';
import { GlossaryTerm } from '../icons';
import { TreeSelect } from '../components/application/tree-select/tree-select';
import type {
  TreeSelectDataResponse,
  TreeSelectNode,
} from '../components/application/tree-select/tree-select.types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GlossaryIcon = () => (
  <GlossaryTerm className="tw:text-fg-brand-primary" size={16} />
);

const DOMAIN_TREE: TreeSelectNode[] = [
  {
    id: 'eng',
    label: 'Engineering',
    value: 'Engineering',
    lazyLoad: false,
    children: [
      {
        id: 'eng-platform',
        label: 'Platform',
        value: 'Engineering.Platform',
        lazyLoad: false,
      },
      {
        id: 'eng-data',
        label: 'Data',
        value: 'Engineering.Data',
        lazyLoad: false,
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales',
    value: 'Sales',
    lazyLoad: false,
    children: [
      { id: 'sales-emea', label: 'EMEA', value: 'Sales.EMEA', lazyLoad: false },
      { id: 'sales-amer', label: 'AMER', value: 'Sales.AMER', lazyLoad: false },
    ],
  },
  { id: 'marketing', label: 'Marketing', value: 'Marketing', lazyLoad: false },
];

const findAll = (nodes: TreeSelectNode[]): TreeSelectNode[] =>
  nodes.flatMap((node) => [node, ...findAll(node.children ?? [])]);

const fetchDomains = async ({
  searchTerm,
}: {
  searchTerm?: string;
}): Promise<TreeSelectDataResponse> => {
  await wait(300);
  if (searchTerm) {
    const matches = findAll(DOMAIN_TREE).filter((node) =>
      node.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return { nodes: matches };
  }

  return { nodes: DOMAIN_TREE };
};

const GLOSSARY_TERMS: Record<string, TreeSelectNode[]> = {
  Finance: [
    {
      id: 'fin-mrr',
      label: 'Monthly Recurring Revenue',
      value: 'Finance.MRR',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'fin-arr',
      label: 'Annual Recurring Revenue',
      value: 'Finance.ARR',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'fin-nsr',
      label: 'Net Savings Rate',
      value: 'Finance.NetSavingsRate',
      allowSelection: true,
      isLeaf: false,
      lazyLoad: true,
      icon: <GlossaryIcon />,
    },
  ],
  'fin-nsr': [
    {
      id: 'fin-nsr-gross',
      label: 'Gross Savings',
      value: 'Finance.NetSavingsRate.GrossSavings',
      allowSelection: true,
      isLeaf: false,
      lazyLoad: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'fin-nsr-net',
      label: 'Net Savings',
      value: 'Finance.NetSavingsRate.NetSavings',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
  ],
  'fin-nsr-gross': [
    {
      id: 'fin-nsr-gross-q1',
      label: 'Q1 Savings',
      value: 'Finance.NetSavingsRate.GrossSavings.Q1',
      allowSelection: true,
      isLeaf: false,
      lazyLoad: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'fin-nsr-gross-q2',
      label: 'Q2 Savings',
      value: 'Finance.NetSavingsRate.GrossSavings.Q2',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
  ],
  'fin-nsr-gross-q1': [
    {
      id: 'fin-nsr-gross-q1-jan',
      label: 'January',
      value: 'Finance.NetSavingsRate.GrossSavings.Q1.Jan',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'fin-nsr-gross-q1-feb',
      label: 'February',
      value: 'Finance.NetSavingsRate.GrossSavings.Q1.Feb',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
  ],
  Customer: [
    {
      id: 'cust-ltv',
      label: 'Lifetime Value',
      value: 'Customer.LTV',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'cust-cac',
      label: 'Customer Acquisition Cost',
      value: 'Customer.CAC',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
  ],
  PII: [
    {
      id: 'pii-email',
      label: 'Email',
      value: 'PII.Email',
      allowSelection: true,
      isParentMutuallyExclusive: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'pii-ssn',
      label: 'SSN',
      value: 'PII.SSN',
      allowSelection: true,
      isParentMutuallyExclusive: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'pii-phone',
      label: 'Phone Number',
      value: 'PII.Phone',
      allowSelection: true,
      isParentMutuallyExclusive: true,
      icon: <GlossaryIcon />,
    },
  ],
};

const GLOSSARY_ROOTS = ['Finance', 'Customer', 'PII'];

const fetchGlossaryTerms = async ({
  parentId,
}: {
  parentId?: string;
}): Promise<TreeSelectDataResponse> => {
  await wait(300);

  if (parentId) {
    return { nodes: GLOSSARY_TERMS[parentId] ?? [] };
  }

  const counts: Record<string, number> = { Finance: 3, Customer: 2, PII: 3 };

  return {
    nodes: GLOSSARY_ROOTS.map((name) => ({
      id: name,
      label: name,
      value: name,
      allowSelection: true,
      lazyLoad: true,
      isLeaf: false,
      icon: <GlossaryIcon />,
      count: counts[name],
      hasExclusiveChildren: name === 'PII',
    })),
  };
};

const MIXED_GLOSSARY_TERMS: Record<string, TreeSelectNode[]> = {
  Sensitivity: [
    {
      id: 'sens-pii',
      label: 'PII',
      value: 'Sensitivity.PII',
      allowSelection: true,
      isParentMutuallyExclusive: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'sens-phi',
      label: 'PHI',
      value: 'Sensitivity.PHI',
      allowSelection: true,
      isParentMutuallyExclusive: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'sens-public',
      label: 'Public',
      value: 'Sensitivity.Public',
      allowSelection: true,
      isParentMutuallyExclusive: true,
      icon: <GlossaryIcon />,
    },
  ],
  Finance: [
    {
      id: 'mix-fin-mrr',
      label: 'Monthly Recurring Revenue',
      value: 'Finance.MRR',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'mix-fin-arr',
      label: 'Annual Recurring Revenue',
      value: 'Finance.ARR',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
    {
      id: 'mix-fin-churn',
      label: 'Churn Rate',
      value: 'Finance.Churn',
      allowSelection: true,
      icon: <GlossaryIcon />,
    },
  ],
};

const MIXED_ROOTS = ['Sensitivity', 'Finance'];

const fetchMixedGlossary = async ({
  parentId,
}: {
  parentId?: string;
}): Promise<TreeSelectDataResponse> => {
  await wait(300);

  if (parentId) {
    return { nodes: MIXED_GLOSSARY_TERMS[parentId] ?? [] };
  }

  return {
    nodes: MIXED_ROOTS.map((name) => ({
      id: name,
      label: name,
      value: name,
      allowSelection: true,
      lazyLoad: true,
      isLeaf: false,
      icon: <GlossaryIcon />,
      hasExclusiveChildren: name === 'Sensitivity',
    })),
  };
};

const meta = {
  title: 'Components/TreeSelect',
  component: TreeSelect,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TreeSelect>;

export default meta;

export const SingleSelect: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode | null>(null);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          searchable
          fetchData={fetchDomains}
          label="Domain"
          placeholder="Select domain"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? null : next)}
        />
      </div>
    );
  },
};

export const MultipleWithCascade: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          cascadeSelection
          multiple
          searchable
          fetchData={fetchDomains}
          label="Domains"
          placeholder="Select domains"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
      </div>
    );
  },
};

export const LazyLoadGlossary: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          lazyLoad
          multiple
          searchable
          fetchData={fetchGlossaryTerms}
          label="Glossary Terms"
          placeholder="Select glossary terms"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
      </div>
    );
  },
};

export const Disabled: StoryObj = {
  render: () => (
    <div style={{ width: 360 }}>
      <TreeSelect
        disabled
        fetchData={fetchDomains}
        label="Domain"
        placeholder="Select domain"
      />
    </div>
  ),
};

export const ButtonTrigger: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          multiple
          searchable
          fetchData={fetchDomains}
          label="Domain"
          triggerVariant="button"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
      </div>
    );
  },
};

export const ButtonTriggerBordered: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          bordered
          multiple
          searchable
          fetchData={fetchDomains}
          label="Domain"
          triggerVariant="button"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
      </div>
    );
  },
};

export const GlossaryFilterBordered: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            gap: '16px 32px',
          }}>
          <TreeSelect
            bordered
            cascadeSelection
            lazyLoad
            multiple
            searchable
            showConnectorLines
            showSelectAll
            fetchData={fetchGlossaryTerms}
            label="Glossary Term"
            triggerVariant="button"
            value={value}
            onChange={(next) => setValue(Array.isArray(next) ? next : [])}
          />
          <TreeSelect
            cascadeSelection
            lazyLoad
            multiple
            searchable
            showConnectorLines
            showSelectAll
            fetchData={fetchGlossaryTerms}
            label="Glossary Term"
            triggerVariant="button"
            value={value}
            onChange={(next) => setValue(Array.isArray(next) ? next : [])}
          />
        </div>
        <p style={{ fontSize: 13, color: '#667085', maxWidth: 500 }}>
          Finance &amp; Customer: checkboxes with cascade (selecting parent
          selects all children). PII: radio buttons (mutually exclusive — only
          one term can be selected).
        </p>
      </div>
    );
  },
};

export const CascadeSelection: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          bordered
          cascadeSelection
          lazyLoad
          multiple
          searchable
          showConnectorLines
          showSelectAll
          fetchData={fetchGlossaryTerms}
          label="Glossary Term"
          triggerVariant="button"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
        <p style={{ fontSize: 13, marginTop: 12, color: '#667085' }}>
          Selecting a parent auto-selects all its children.
        </p>
      </div>
    );
  },
};

export const MutuallyExclusive: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          bordered
          lazyLoad
          multiple
          searchable
          showConnectorLines
          showSelectAll
          fetchData={fetchMixedGlossary}
          label="Glossary Term"
          triggerVariant="button"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
        <p style={{ fontSize: 13, marginTop: 12, color: '#667085' }}>
          &ldquo;Sensitivity&rdquo; terms are mutually exclusive (radio
          buttons). &ldquo;Finance&rdquo; terms allow multiple selection
          (checkboxes).
        </p>
      </div>
    );
  },
};

export const ConnectorLines: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode | null>(null);

    return (
      <div style={{ width: 360 }}>
        <TreeSelect
          searchable
          showConnectorLines
          fetchData={fetchDomains}
          label="Domain"
          placeholder="Select domain"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? null : next)}
        />
      </div>
    );
  },
};
