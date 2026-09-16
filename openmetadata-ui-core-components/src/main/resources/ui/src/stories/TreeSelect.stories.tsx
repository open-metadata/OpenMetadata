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
import { TreeSelect } from '../components/application/tree-select/tree-select';
import type {
  TreeSelectDataResponse,
  TreeSelectNode,
} from '../components/application/tree-select/tree-select.types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

const GLOSSARIES = ['PII', 'Business Glossary'];
const TERMS: Record<string, TreeSelectNode[]> = {
  PII: [
    {
      id: 'pii-email',
      label: 'Email',
      value: 'PII.Email',
      allowSelection: true,
      isParentMutuallyExclusive: true,
    },
    {
      id: 'pii-ssn',
      label: 'SSN',
      value: 'PII.SSN',
      allowSelection: true,
      isParentMutuallyExclusive: true,
    },
  ],
  'Business Glossary': [
    {
      id: 'bg-revenue',
      label: 'Revenue',
      value: 'Business Glossary.Revenue',
      allowSelection: true,
    },
    {
      id: 'bg-churn',
      label: 'Churn',
      value: 'Business Glossary.Churn',
      allowSelection: true,
    },
  ],
};

const fetchGlossaryTerms = async ({
  parentId,
}: {
  parentId?: string;
}): Promise<TreeSelectDataResponse> => {
  await wait(300);

  if (parentId) {
    return { nodes: TERMS[parentId] ?? [] };
  }

  return {
    nodes: GLOSSARIES.map((name) => ({
      id: name,
      label: name,
      value: name,
      allowSelection: false,
      lazyLoad: true,
      isLeaf: false,
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

export const LazyLoadWithMutuallyExclusive: StoryObj = {
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
          loadingMessage="Loading glossaries..."
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
