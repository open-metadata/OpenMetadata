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
import { Grid } from '../components/base/grid/grid';

const meta = {
  title: 'Components/Grid',
  component: Grid,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Grid>;

export default meta;
type Story = StoryObj<typeof meta>;

const Tile = ({ children }: { children: React.ReactNode }) => (
  <div className="tw:rounded tw:bg-blue-100 tw:p-4 tw:text-center tw:text-sm tw:font-medium tw:text-blue-700">
    {children}
  </div>
);

export const FullWidth: Story = {
  render: () => (
    <div style={{ width: 800 }}>
      <Grid gap="4">
        <Grid.Item span={24}>
          <Tile>span 24 (full width)</Tile>
        </Grid.Item>
      </Grid>
    </div>
  ),
};

export const HalfHalf: StoryObj = {
  render: () => (
    <div style={{ width: 800 }}>
      <Grid gap="4">
        <Grid.Item span={12}>
          <Tile>span 12</Tile>
        </Grid.Item>
        <Grid.Item span={12}>
          <Tile>span 12</Tile>
        </Grid.Item>
      </Grid>
    </div>
  ),
};

export const ThreeColumns: StoryObj = {
  render: () => (
    <div style={{ width: 800 }}>
      <Grid gap="4">
        <Grid.Item span={8}>
          <Tile>span 8</Tile>
        </Grid.Item>
        <Grid.Item span={8}>
          <Tile>span 8</Tile>
        </Grid.Item>
        <Grid.Item span={8}>
          <Tile>span 8</Tile>
        </Grid.Item>
      </Grid>
    </div>
  ),
};

export const WithStart: StoryObj = {
  render: () => (
    <div style={{ width: 800 }}>
      <Grid gap="4">
        <Grid.Item span={6} start={7}>
          <Tile>span 6, start 7</Tile>
        </Grid.Item>
      </Grid>
    </div>
  ),
};

export const MixedSpans: StoryObj = {
  render: () => (
    <div style={{ width: 800 }}>
      <Grid gap="4">
        <Grid.Item span={24}>
          <Tile>span 24</Tile>
        </Grid.Item>
        <Grid.Item span={12}>
          <Tile>span 12</Tile>
        </Grid.Item>
        <Grid.Item span={12}>
          <Tile>span 12</Tile>
        </Grid.Item>
        <Grid.Item span={8}>
          <Tile>span 8</Tile>
        </Grid.Item>
        <Grid.Item span={8}>
          <Tile>span 8</Tile>
        </Grid.Item>
        <Grid.Item span={8}>
          <Tile>span 8</Tile>
        </Grid.Item>
        <Grid.Item span={6} start={7}>
          <Tile>span 6, start 7</Tile>
        </Grid.Item>
      </Grid>
    </div>
  ),
};
