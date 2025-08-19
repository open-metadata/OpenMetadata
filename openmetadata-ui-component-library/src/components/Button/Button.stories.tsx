import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { ThemeProvider } from "../../theme";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "A versatile Button component built on top of Untitled UI with enhanced props and functionality.",
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "outline", "ghost", "link"],
    },
    size: {
      control: { type: "select" },
      options: ["sm", "md", "lg"],
    },
    disabled: {
      control: "boolean",
    },
    loading: {
      control: "boolean",
    },
    danger: {
      control: "boolean",
    },
    htmlType: {
      control: { type: "select" },
      options: ["button", "submit", "reset"],
    },
  },
  args: {
    onClick: () => console.log('Button clicked'),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary Button",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary Button",
  },
};

export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Outline Button",
  },
};

export const Ghost: Story = {
  args: {
    variant: "ghost",
    children: "Ghost Button",
  },
};

export const Link: Story = {
  args: {
    variant: "link",
    children: "Link Button",
  },
};

export const Large: Story = {
  args: {
    size: "lg",
    children: "Large Button",
  },
};

export const Medium: Story = {
  args: {
    size: "md",
    children: "Medium Button",
  },
};

export const Small: Story = {
  args: {
    size: "sm",
    children: "Small Button",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: "Disabled Button",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: "Click me",
  },
};

export const Danger: Story = {
  args: {
    danger: true,
    children: "Danger Button",
  },
};

export const DangerOutline: Story = {
  args: {
    danger: true,
    variant: "outline",
    children: "Danger Outline",
  },
};

export const Submit: Story = {
  args: {
    htmlType: "submit",
    children: "Submit Form",
  },
};
