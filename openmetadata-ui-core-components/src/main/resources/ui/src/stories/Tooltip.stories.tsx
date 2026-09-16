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
import { HelpCircle } from '@untitledui/icons';
import { Tooltip } from '../components/base/tooltip/tooltip';
import { Button } from '../components/base/buttons/button';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tooltip title="This is a tooltip">
      <Button color="secondary">Hover me</Button>
    </Tooltip>
  ),
};

export const WithDescription: StoryObj = {
  render: () => (
    <Tooltip
      description="This is a longer description that provides more context."
      title="Tooltip title">
      <Button color="secondary">With description</Button>
    </Tooltip>
  ),
};

export const WithArrow: StoryObj = {
  render: () => (
    <Tooltip arrow title="Tooltip with arrow">
      <Button color="secondary">With arrow</Button>
    </Tooltip>
  ),
};

export const OnSpan: StoryObj = {
  render: () => (
    <Tooltip title="Tooltip on a plain span">
      <span>Hover over this text</span>
    </Tooltip>
  ),
};

export const OnIcon: StoryObj = {
  render: () => (
    <Tooltip
      title="Help tooltip on an icon"
      triggerClassName="tw:flex tw:cursor-pointer tw:text-fg-quaternary tw:hover:text-fg-quaternary_hover">
      <HelpCircle className="tw:size-5" />
    </Tooltip>
  ),
};

export const ButtonWithTooltip: StoryObj = {
  render: () => (
    <Button color="secondary" tooltip="Built-in tooltip via the tooltip prop">
      Button with tooltip
    </Button>
  ),
};

export const Placements: StoryObj = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 24,
        padding: 80,
      }}>
      <Tooltip placement="top" title="Top tooltip">
        <Button color="secondary" size="sm">
          Top
        </Button>
      </Tooltip>
      <Tooltip placement="bottom" title="Bottom tooltip">
        <Button color="secondary" size="sm">
          Bottom
        </Button>
      </Tooltip>
      <Tooltip placement="left" title="Left tooltip">
        <Button color="secondary" size="sm">
          Left
        </Button>
      </Tooltip>
      <Tooltip placement="right" title="Right tooltip">
        <Button color="secondary" size="sm">
          Right
        </Button>
      </Tooltip>
    </div>
  ),
};

export const AlwaysVisible: StoryObj = {
  render: () => (
    <Tooltip isOpen title="Always visible tooltip">
      <Button color="secondary">Always visible</Button>
    </Tooltip>
  ),
};
