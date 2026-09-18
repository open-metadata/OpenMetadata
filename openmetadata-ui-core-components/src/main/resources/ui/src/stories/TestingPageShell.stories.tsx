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
  BarChartSquare02,
  Database01,
  Gift01,
  LayersThree01,
  SearchLg,
  Settings01,
  Shield01,
  Table,
} from '@untitledui/icons';
import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { PageShell } from '../components/application/page-shell/page-shell';
import type { PageShellLabels } from '../components/application/page-shell/page-shell.types';

const LABELS: PageShellLabels = {
  collapseMainNav: 'Collapse main navigation',
  expandMainNav: 'Expand main navigation',
  collapseSubNav: 'Collapse sub navigation',
  expandSubNav: 'Expand sub navigation',
  hideSubNav: 'Hide sub navigation',
  showSubNav: 'Show sub navigation',
};

const PRIMARY_NAV = [
  { label: 'Explore', icon: SearchLg },
  { label: 'Observability', icon: BarChartSquare02 },
  { label: 'Data Quality', icon: Shield01 },
  { label: 'Governance', icon: Gift01 },
  { label: 'Insights', icon: LayersThree01 },
  { label: 'Settings', icon: Settings01 },
];

const SECONDARY_NAV = [
  { label: 'Databases', icon: Database01 },
  { label: 'Schemas', icon: LayersThree01 },
  { label: 'Tables', icon: Table },
  { label: 'Topics', icon: BarChartSquare02 },
  { label: 'Pipelines', icon: Settings01 },
];

/**
 * Items carry an icon as well as a label; `PageShell.NavItem` drops the label
 * on its own once its column collapses, so the list needs no collapse logic.
 */
const NavList = ({
  items,
  activeIndex = 0,
}: {
  items: { label: string; icon: typeof SearchLg }[];
  activeIndex?: number;
}) => (
  <nav className="tw:flex tw:flex-col tw:gap-0.5 tw:p-1.5">
    {items.map((item, index) => (
      <PageShell.NavItem
        icon={item.icon}
        isActive={index === activeIndex}
        key={item.label}
        label={item.label}
      />
    ))}
  </nav>
);

const meta = {
  title: 'Testing/PageShell',
  component: PageShell,
  parameters: {
    layout: 'fullscreen',
    // The shell owns its own outer padding and must reach the canvas edge.
    fullBleed: true,
  },
  tags: ['autodocs'],
  argTypes: {
    defaultMainNavCollapsed: { control: 'boolean' },
    defaultSubNav: {
      control: 'inline-radio',
      options: ['expanded', 'collapsed', 'hidden'],
    },
    navWidth: { control: { type: 'range', min: 120, max: 320, step: 10 } },
    railWidth: { control: { type: 'range', min: 36, max: 72, step: 4 } },
  },
  args: {
    labels: LABELS,
    defaultMainNavCollapsed: false,
    defaultSubNav: 'expanded',
    navWidth: 180,
    railWidth: 44,
  },
} satisfies Meta<typeof PageShell>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The shell with both nav columns and a page in the canvas. Switch the Theme
 * toolbar to **Side-by-side** to check both palettes at once — every region
 * takes its surface from a `shell-*` token, so neither theme needs its own
 * markup. The chevrons collapse each column to a rail; the panel button at the
 * foot of the main nav hides the sub nav and brings it back at the width it
 * had.
 */
export const Default: Story = {
  render: (args) => (
    <PageShell {...args} pageTitle="Explore">
      <PageShell.Nav aria-label="Primary navigation">
        <PageShell.MainNav>
          <NavList items={PRIMARY_NAV} />
        </PageShell.MainNav>
        <PageShell.SubNav>
          <NavList activeIndex={2} items={SECONDARY_NAV} />
        </PageShell.SubNav>
      </PageShell.Nav>
      <PageShell.Canvas>
        <PageShell.CanvasHeader>
          <div className="tw:flex tw:min-w-0 tw:flex-col">
            <h1 className="tw:truncate tw:text-md tw:font-semibold tw:text-primary">
              Tables
            </h1>
            <p className="tw:truncate tw:text-sm tw:text-tertiary">
              1,284 tables across 36 schemas
            </p>
          </div>
        </PageShell.CanvasHeader>
        <PageShell.CanvasBody>
          <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:p-6">
            <p className="tw:text-sm tw:text-tertiary">
              Page content renders here.
            </p>
          </div>
        </PageShell.CanvasBody>
      </PageShell.Canvas>
    </PageShell>
  ),
};

/**
 * A page with no second navigation level. `hidden` keeps the column mounted at
 * zero width, so revealing it animates in rather than snapping the row.
 */
export const WithoutSubNav: Story = {
  args: { defaultSubNav: 'hidden' },
  render: Default.render,
};

/**
 * Both columns as rails. The canvas takes the width they give up, and each
 * column's chevron flips to point the way it will expand.
 */
export const Collapsed: Story = {
  args: { defaultMainNavCollapsed: true, defaultSubNav: 'collapsed' },
  render: Default.render,
};
