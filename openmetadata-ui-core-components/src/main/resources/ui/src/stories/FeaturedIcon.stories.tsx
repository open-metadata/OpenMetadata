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
import { InfoCircle } from "@untitledui/icons";
import { FeaturedIcon } from "../components/foundations/featured-icon/featured-icon";

const meta = {
  title: "Foundations/FeaturedIcon",
  component: FeaturedIcon,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    color: {
      control: "select",
      options: ["brand", "gray", "success", "warning", "error"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl"],
    },
    theme: {
      control: "select",
      options: ["light", "gradient", "dark", "outline", "modern", "modern-neue"],
    },
  },
} satisfies Meta<typeof FeaturedIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: InfoCircle,
    color: "brand",
    size: "md",
    theme: "light",
  },
};

export const Sizes: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <FeaturedIcon icon={InfoCircle} color="brand" size="sm" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="md" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="xl" theme="light" />
    </div>
  ),
};

export const Themes: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", maxWidth: 720 }}>
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="gradient" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="dark" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="outline" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="modern" />
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="modern-neue" />
    </div>
  ),
};

export const Colors: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", maxWidth: 720 }}>
      <FeaturedIcon icon={InfoCircle} color="brand" size="lg" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="gray" size="lg" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="success" size="lg" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="warning" size="lg" theme="light" />
      <FeaturedIcon icon={InfoCircle} color="error" size="lg" theme="light" />
    </div>
  ),
};
