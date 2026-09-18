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
import { Edit, GlossaryTerm } from '../icons';
import { ButtonUtility } from '../components/base/buttons/button-utility';
import { Card } from '../components/base/card/card';
import { GlossaryTag } from '../components/application/tag/glossary-tag';
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

const childrenOf = (id: string) => GLOSSARY_TERMS[id] ?? [];

// Keeps any node that matches, plus the ancestors needed to reach it.
const filterSubtree = (
  nodes: TreeSelectNode[],
  query: string
): TreeSelectNode[] =>
  nodes.reduce<TreeSelectNode[]>((matches, node) => {
    const children = filterSubtree(childrenOf(node.id), query);
    const selfMatches = node.label.toLowerCase().includes(query);

    if (selfMatches || children.length > 0) {
      matches.push({
        ...node,
        children,
        isLeaf: children.length === 0,
        lazyLoad: false,
      });
    }

    return matches;
  }, []);

const fetchGlossaryTerms = async ({
  parentId,
  searchTerm,
}: {
  parentId?: string;
  searchTerm?: string;
}): Promise<TreeSelectDataResponse> => {
  await wait(300);

  // Mirrors the server: a search returns each glossary with its terms nested.
  if (searchTerm) {
    const query = searchTerm.toLowerCase();

    return {
      nodes: GLOSSARY_ROOTS.reduce<TreeSelectNode[]>((roots, name) => {
        const children = filterSubtree(childrenOf(name), query);

        if (children.length > 0) {
          roots.push({
            id: name,
            label: name,
            value: name,
            allowSelection: false,
            children,
            icon: <GlossaryIcon />,
            isLeaf: false,
            lazyLoad: false,
          });
        }

        return roots;
      }, []),
    };
  }

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

// The entity-widget shape: edit icon as trigger, terms visible, one PATCH on Apply.
export const WidgetEditPopover: StoryObj = {
  render: () => {
    const [terms, setTerms] = useState<TreeSelectNode[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div style={{ width: 400 }}>
        <Card size="sm">
          <Card.Header
            className="tw:border-0 tw:p-4"
            extra={
              <FilterSelect.Tree
                multiple
                searchable
                showSelectAll
                commitMode="staged"
                fetchData={fetchGlossaryTerms}
                isOpen={isOpen}
                label="Glossary Term"
                renderTrigger={({ toggle }) => (
                  <ButtonUtility
                    color="tertiary"
                    icon={Edit}
                    size="xs"
                    tooltip="Edit Glossary Terms"
                    onClick={toggle}
                  />
                )}
                value={terms}
                onChange={(next) => setTerms(Array.isArray(next) ? next : [])}
                onOpenChange={setIsOpen}
              />
            }
            title="Glossary Term"
          />
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              padding: '0 16px 16px',
            }}>
            {terms.length > 0 ? (
              terms.map((term) => (
                <GlossaryTag key={term.id} label={term.label} size="sm" />
              ))
            ) : (
              <span style={{ color: '#667085', fontSize: 13 }}>
                No Glossary Terms
              </span>
            )}
          </div>
        </Card>
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

// Inline "create" row: an entity picker that also lets the user launch a
// create form for a new entity, prefilled with the current search term. The
// consumer owns the label (translated) and the create flow (e.g. a modal).
export const WithCreate: StoryObj = {
  render: () => {
    const [value, setValue] = useState<TreeSelectNode[]>([]);
    const [lastCreate, setLastCreate] = useState<string | null>(null);

    return (
      <div style={{ width: 360 }}>
        <FilterSelect.Tree
          bordered
          lazyLoad
          multiple
          searchable
          createLabel="Add new domain"
          fetchData={fetchGlossaryTerms}
          label="Domain"
          triggerVariant="button"
          value={value}
          onChange={(next) => setValue(Array.isArray(next) ? next : [])}
          onCreate={(searchTerm) => setLastCreate(searchTerm)}
        />
        <p style={{ fontSize: 12, marginTop: 12, color: '#667085' }}>
          {lastCreate === null
            ? 'Open the dropdown and click “Add new domain”.'
            : `Create requested with search term: "${lastCreate}"`}
        </p>
      </div>
    );
  },
};
