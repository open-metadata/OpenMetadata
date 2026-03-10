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
import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip, TooltipTrigger } from "../components/base/tooltip/tooltip";
import { Button } from "../components/base/buttons/button";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tooltip title="This is a tooltip">
      <TooltipTrigger>
        <Button color="secondary">Hover me</Button>
      </TooltipTrigger>
    </Tooltip>
  ),
};

export const WithDescription: StoryObj = {
  render: () => (
    <Tooltip
      title="Tooltip title"
      description="This is a longer description that provides more context."
    >
      <TooltipTrigger>
        <Button color="secondary">With description</Button>
      </TooltipTrigger>
    </Tooltip>
  ),
};

export const WithArrow: StoryObj = {
  render: () => (
    <Tooltip title="Tooltip with arrow" arrow>
      <TooltipTrigger>
        <Button color="secondary">With arrow</Button>
      </TooltipTrigger>
    </Tooltip>
  ),
};

export const Placements: StoryObj = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24, padding: 80 }}>
      <Tooltip title="Top tooltip" placement="top">
        <TooltipTrigger>
          <Button color="secondary" size="sm">Top</Button>
        </TooltipTrigger>
      </Tooltip>
      <Tooltip title="Bottom tooltip" placement="bottom">
        <TooltipTrigger>
          <Button color="secondary" size="sm">Bottom</Button>
        </TooltipTrigger>
      </Tooltip>
      <Tooltip title="Left tooltip" placement="left">
        <TooltipTrigger>
          <Button color="secondary" size="sm">Left</Button>
        </TooltipTrigger>
      </Tooltip>
      <Tooltip title="Right tooltip" placement="right">
        <TooltipTrigger>
          <Button color="secondary" size="sm">Right</Button>
        </TooltipTrigger>
      </Tooltip>
    </div>
  ),
};

export const AlwaysVisible: StoryObj = {
  render: () => (
    <Tooltip title="Always visible tooltip" isOpen>
      <TooltipTrigger>
        <Button color="secondary">Always visible</Button>
      </TooltipTrigger>
    </Tooltip>
  ),
};
