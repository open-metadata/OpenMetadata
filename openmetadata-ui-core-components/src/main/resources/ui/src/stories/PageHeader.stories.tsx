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
import { Database01, HomeLine, Plus } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Avatar } from '../components/base/avatar/avatar';
import { Badge } from '../components/base/badges/badges';
import { Button } from '../components/base/buttons/button';
import type { BreadcrumbItemType } from '../components/application/breadcrumbs/breadcrumbs';
import { Breadcrumbs } from '../components/application/breadcrumbs/breadcrumbs';
import { PageHeader } from '../components/application/page-header/page-header';

const meta = {
  title: 'Application/PageHeader',
  component: PageHeader,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['flat', 'gradient'],
    },
  },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

const crumbs: BreadcrumbItemType[] = [
  { id: 'home', label: 'Home', href: '#', icon: HomeLine },
  { id: 'services', label: 'Services', href: '#' },
  { id: 'snowflake', label: 'Snowflake' },
];

// A wrapper so the header has a surface to sit on in the story canvas.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="tw:bg-secondary tw:p-4">{children}</div>
);

export const Basic: Story = {
  args: {
    title: 'Snowflake',
    subtitle: 'Production data warehouse service',
  },
  render: (args) => (
    <Frame>
      <PageHeader {...args} />
    </Frame>
  ),
};

// Variation 1 — the standard header assembled from convenience props: an `icon`
// tile, an array `breadcrumb`, and library primitives in the actions slot.
export const WithBreadcrumbAndSearch: Story = {
  args: {
    title: 'Snowflake',
    subtitle: 'Production data warehouse service',
  },
  render: (args) => (
    <Frame>
      <PageHeader
        {...args}
        actions={
          <Button color="primary" iconLeading={Plus} size="sm">
            Add
          </Button>
        }
        badge={<Badge color="brand">BETA</Badge>}
        breadcrumb={crumbs}
        icon={Database01}
        search={{ placeholder: 'Search...', 'aria-label': 'Search' }}
      />
    </Frame>
  ),
};

// Variation 2 — a fully customized header: every slot takes a bespoke node
// instead of the convenience props (an Avatar for `leading`, a custom
// `Breadcrumbs` with a slash divider, a meta row, and a custom action cluster).
export const Customized: Story = {
  args: {
    title: 'Data Platform Team',
    subtitle: 'Owns 128 assets across 4 domains',
  },
  render: (args) => (
    <Frame>
      <PageHeader
        {...args}
        actions={
          <>
            <Button color="secondary" size="sm">
              Edit
            </Button>
            <Button color="primary" iconLeading={Plus} size="sm">
              New asset
            </Button>
          </>
        }
        breadcrumb={
          <Breadcrumbs
            divider="slash"
            items={crumbs}
            size="sm"
            type="button-gray"
          />
        }
        icon={<Avatar alt="Data Platform Team" size="lg" />}
        meta={
          <div className="tw:flex tw:gap-3 tw:text-sm tw:text-secondary">
            <span>Owner: Ava Chen</span>
            <span>·</span>
            <span>Domain: Analytics</span>
            <span>·</span>
            <span>Tier: Gold</span>
          </div>
        }
        variant="gradient"
      />
    </Frame>
  ),
};

export const Gradient: Story = {
  args: {
    title: 'Snowflake',
    subtitle: 'Production data warehouse service',
    variant: 'gradient',
  },
  render: (args) => (
    <Frame>
      <PageHeader
        {...args}
        breadcrumb={crumbs}
        search={{ placeholder: 'Search...', 'aria-label': 'Search' }}
      />
    </Frame>
  ),
};

export const WithFooterTabs: Story = {
  args: {
    title: 'Snowflake',
    variant: 'gradient',
  },
  render: (args) => (
    <Frame>
      <PageHeader
        {...args}
        breadcrumb={crumbs}
        footer={[
          { id: 'overview', label: 'Overview' },
          { id: 'schema', label: 'Schema', count: 128 },
          { id: 'lineage', label: 'Lineage' },
          { id: 'quality', label: 'Data Quality', count: 12 },
        ]}
        icon={Database01}
      />
    </Frame>
  ),
};
