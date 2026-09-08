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
import { Database01, HomeLine } from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { PageLayout } from '../components/application/page-layout/page-layout';

const meta = {
  title: 'Application/PageLayout',
  component: PageLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    scroll: {
      control: 'inline-radio',
      options: ['content', 'page'],
    },
    pageTitle: { control: 'text' },
    fullHeight: { control: 'boolean' },
  },
} satisfies Meta<typeof PageLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

const Panel = ({ label }: { label: string }) => (
  <div className="tw:p-4 tw:text-sm tw:text-secondary">{label}</div>
);

const Body = () => (
  <div className="tw:py-4">
    <h1 className="tw:text-lg tw:font-semibold tw:text-primary">Page title</h1>
    <p className="tw:mt-2 tw:text-sm tw:text-secondary">
      The content region is a <code>&lt;main&gt;</code> landmark and scrolls
      independently of the side panels.
    </p>
  </div>
);

// A fixed viewport frame so the full-height grid has something to fill.
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="tw:h-[480px] tw:border tw:border-secondary tw:bg-primary">
    {children}
  </div>
);

export const ContentOnly: Story = {
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.Content>
          <Body />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};

export const WithLeftPanel: Story = {
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.LeftPanel aria-label="Navigation">
          <Panel label="Left panel" />
        </PageLayout.LeftPanel>
        <PageLayout.Content>
          <Body />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};

export const WithBothPanels: Story = {
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.LeftPanel aria-label="Navigation">
          <Panel label="Left panel" />
        </PageLayout.LeftPanel>
        <PageLayout.Content>
          <Body />
        </PageLayout.Content>
        <PageLayout.RightPanel aria-label="Details">
          <Panel label="Right panel" />
        </PageLayout.RightPanel>
      </PageLayout>
    </Frame>
  ),
};

export const WithHeader: Story = {
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.Header>
          <div className="tw:border-b tw:border-secondary tw:px-4 tw:py-3 tw:text-sm tw:font-semibold tw:text-primary">
            Header / toolbar
          </div>
        </PageLayout.Header>
        <PageLayout.LeftPanel aria-label="Navigation">
          <Panel label="Left panel" />
        </PageLayout.LeftPanel>
        <PageLayout.Content>
          <Body />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};

export const CenteredContent: Story = {
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.Content center maxWidth={640}>
          <Body />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};

// Enough rows to overflow the 480px frame so the scroll behaviour is visible.
const TallBody = () => (
  <div className="tw:py-4">
    {Array.from({ length: 30 }, (_, i) => (
      <p className="tw:py-2 tw:text-sm tw:text-secondary" key={i}>
        Row {i + 1} — scroll to see how the header behaves.
      </p>
    ))}
  </div>
);

const StickyHeader = () => (
  <div className="tw:border-b tw:border-secondary tw:bg-primary tw:px-4 tw:py-3 tw:text-sm tw:font-semibold tw:text-primary">
    Header / toolbar
  </div>
);

// `scroll="content"` (default): the header stays fixed while the content scrolls.
export const FixedHeaderScrollContent: Story = {
  args: { scroll: 'content' },
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.Header>
          <StickyHeader />
        </PageLayout.Header>
        <PageLayout.Content>
          <TallBody />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};

// `scroll="page"`: header and content scroll together as one document.
export const PageScroll: Story = {
  args: { scroll: 'page' },
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.Header>
          <StickyHeader />
        </PageLayout.Header>
        <PageLayout.Content>
          <TallBody />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};

// `PageLayout.PageHeader` drops a rich PageHeader into the header grid-area.
export const WithPageHeader: Story = {
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.PageHeader
          breadcrumb={[
            { id: 'home', label: 'Home', href: '#', icon: HomeLine },
            { id: 'services', label: 'Services', href: '#' },
            { id: 'snowflake', label: 'Snowflake' },
          ]}
          icon={Database01}
          search={{ placeholder: 'Search...', 'aria-label': 'Search' }}
          subtitle="Production data warehouse service"
          title="Snowflake"
          variant="gradient"
        />
        <PageLayout.Content>
          <Body />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};

// `pageTitle` sets the browser tab title through `DocumentTitle`.
export const WithPageTitle: Story = {
  args: { pageTitle: 'Explore' },
  render: (args) => (
    <Frame>
      <PageLayout {...args}>
        <PageLayout.Header>
          <StickyHeader />
        </PageLayout.Header>
        <PageLayout.Content>
          <Body />
        </PageLayout.Content>
      </PageLayout>
    </Frame>
  ),
};
