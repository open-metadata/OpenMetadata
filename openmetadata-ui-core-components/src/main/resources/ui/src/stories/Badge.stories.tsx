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
import { HelpCircle } from "@untitledui/icons";
import type { Meta, StoryObj } from "@storybook/react";
import {
  Badge,
  BadgeIcon,
  BadgeWithButton,
  BadgeWithDot,
  BadgeWithIcon,
} from "../components/base/badges/badges";

const meta = {
  title: "Components/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Badge",
    type: "pill-color",
    size: "md",
    color: "gray",
  },
};

export const PillColors: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge type="pill-color" color="gray">Gray</Badge>
      <Badge type="pill-color" color="brand">Brand</Badge>
      <Badge type="pill-color" color="error">Error</Badge>
      <Badge type="pill-color" color="warning">Warning</Badge>
      <Badge type="pill-color" color="success">Success</Badge>
      <Badge type="pill-color" color="blue">Blue</Badge>
      <Badge type="pill-color" color="indigo">Indigo</Badge>
      <Badge type="pill-color" color="purple">Purple</Badge>
      <Badge type="pill-color" color="pink">Pink</Badge>
      <Badge type="pill-color" color="orange">Orange</Badge>
    </div>
  ),
};

export const BadgeColors: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge type="badge-color" color="gray">Gray</Badge>
      <Badge type="badge-color" color="brand">Brand</Badge>
      <Badge type="badge-color" color="error">Error</Badge>
      <Badge type="badge-color" color="warning">Warning</Badge>
      <Badge type="badge-color" color="success">Success</Badge>
      <Badge type="badge-color" color="blue">Blue</Badge>
      <Badge type="badge-color" color="indigo">Indigo</Badge>
    </div>
  ),
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <Badge type="pill-color" color="brand" size="sm">Small</Badge>
      <Badge type="pill-color" color="brand" size="md">Medium</Badge>
      <Badge type="pill-color" color="brand" size="lg">Large</Badge>
    </div>
  ),
};

export const WithDot: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <BadgeWithDot type="pill-color" color="gray">Gray</BadgeWithDot>
      <BadgeWithDot type="pill-color" color="brand">Brand</BadgeWithDot>
      <BadgeWithDot type="pill-color" color="error">Error</BadgeWithDot>
      <BadgeWithDot type="pill-color" color="success">Success</BadgeWithDot>
      <BadgeWithDot type="pill-color" color="warning">Warning</BadgeWithDot>
    </div>
  ),
};

export const WithIcon: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <BadgeWithIcon type="pill-color" color="gray" iconLeading={HelpCircle}>Gray Leading</BadgeWithIcon>
      <BadgeWithIcon type="pill-color" color="brand" iconTrailing={HelpCircle}>Brand Trailing</BadgeWithIcon>
      <BadgeWithIcon type="badge-color" color="success" iconLeading={HelpCircle}>Success</BadgeWithIcon>
    </div>
  ),
};

export const WithButton: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <BadgeWithButton type="pill-color" color="gray">Gray</BadgeWithButton>
      <BadgeWithButton type="pill-color" color="brand">Brand</BadgeWithButton>
      <BadgeWithButton type="pill-color" color="error">Error</BadgeWithButton>
      <BadgeWithButton type="pill-color" color="success">Success</BadgeWithButton>
    </div>
  ),
};

export const IconOnly: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <BadgeIcon type="pill-color" color="gray" icon={HelpCircle} />
      <BadgeIcon type="pill-color" color="brand" icon={HelpCircle} />
      <BadgeIcon type="pill-color" color="error" icon={HelpCircle} />
      <BadgeIcon type="badge-color" color="success" icon={HelpCircle} />
    </div>
  ),
};

export const ModernStyle: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge type="badge-modern" color="gray">Modern Badge</Badge>
      <BadgeWithDot type="badge-modern" color="gray">With Dot</BadgeWithDot>
    </div>
  ),
};
