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
import { FilterSelect } from '../components/application/filter-select/filter-select';
import type {
  TreeSelectDataResponse,
  TreeSelectNode,
} from '../components/application/tree-select/tree-select.types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const GlossaryIcon = () => <GlossaryTerm size={16} />;

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

const meta = {
  title: 'Components/FilterSelect',
  component: FilterSelect.Tree,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof FilterSelect.Tree>;

export default meta;

type StoryObj = import('@storybook/react').StoryObj<typeof meta>;

export const GlossaryTermFilter: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <FilterSelect.Tree
          bordered
          cascadeSelection
          lazyLoad
          multiple
          searchable
          showSelectAll
          fetchData={fetchGlossaryTerms}
          label="Glossary Term"
          triggerVariant="button"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
      </div>
    );
  },
};

export const MutuallyExclusive: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);

    return (
      <div style={{ width: 360 }}>
        <FilterSelect.Tree
          bordered
          lazyLoad
          multiple
          searchable
          showSelectAll
          fetchData={fetchGlossaryTerms}
          label="Glossary Term"
          triggerVariant="button"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
        />
        <p style={{ fontSize: 12, marginTop: 12, color: '#667085' }}>
          Finance &amp; Customer use checkboxes (multi-select). PII uses radio
          buttons (mutually exclusive — only one term can be selected).
        </p>
      </div>
    );
  },
};
