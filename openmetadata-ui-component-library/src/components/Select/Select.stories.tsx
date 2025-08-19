import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./Select";
import type { SelectOption } from "./Select";

const sampleOptions: SelectOption[] = [
  { id: "1", name: "apple", label: "Apple", value: "apple" },
  { id: "2", name: "banana", label: "Banana", value: "banana" },
  { id: "3", name: "cherry", label: "Cherry", value: "cherry" },
  { id: "4", name: "date", label: "Date", value: "date", disabled: true },
  { id: "5", name: "elderberry", label: "Elderberry", value: "elderberry" },
];

const userOptions: SelectOption[] = [
  { id: "u1", name: "john_doe", label: "John Doe", value: "john_doe" },
  { id: "u2", name: "jane_smith", label: "Jane Smith", value: "jane_smith" },
  { id: "u3", name: "bob_johnson", label: "Bob Johnson", value: "bob_johnson" },
  { id: "u4", name: "alice_brown", label: "Alice Brown", value: "alice_brown" },
];

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "A flexible Select component built on top of Ant Design Select with enhanced functionality for OpenMetadata UI.",
      },
    },
  },
  argTypes: {
    size: {
      control: { type: "select" },
      options: ["small", "middle", "large"],
    },
    multiple: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
    loading: {
      control: "boolean",
    },
    allowClear: {
      control: "boolean",
    },
    showSearch: {
      control: "boolean",
    },
  },
  args: {
    onChange: (value: any, options: any) => console.log('Changed:', value, options),
    onSelectionChange: (value: any) => console.log('Selection changed:', value),
    onFocus: () => console.log('Focused'),
    onBlur: () => console.log('Blurred'),
    onClear: () => console.log('Cleared'),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    options: sampleOptions,
    placeholder: "Select a fruit",
  },
};

export const WithDefaultValue: Story = {
  args: {
    options: sampleOptions,
    defaultValue: "banana",
    placeholder: "Select a fruit",
  },
};

export const Multiple: Story = {
  args: {
    options: sampleOptions,
    multiple: true,
    placeholder: "Select multiple fruits",
    defaultValue: ["apple", "cherry"],
  },
};

export const Disabled: Story = {
  args: {
    options: sampleOptions,
    disabled: true,
    placeholder: "Disabled select",
    defaultValue: "apple",
  },
};

export const Loading: Story = {
  args: {
    options: [],
    loading: true,
    placeholder: "Loading options...",
  },
};

export const WithSearch: Story = {
  args: {
    options: userOptions,
    showSearch: true,
    placeholder: "Search and select users",
    filterOption: (input, option) =>
      (option?.label ?? "").toLowerCase().includes(input.toLowerCase()),
  },
};

export const Large: Story = {
  args: {
    options: sampleOptions,
    size: "large",
    placeholder: "Large size select",
  },
};

export const Small: Story = {
  args: {
    options: sampleOptions,
    size: "small",
    placeholder: "Small size select",
  },
};

export const NoSearch: Story = {
  args: {
    options: sampleOptions,
    showSearch: false,
    placeholder: "Select without search",
  },
};

export const NoClear: Story = {
  args: {
    options: sampleOptions,
    allowClear: false,
    placeholder: "Select without clear button",
    defaultValue: "apple",
  },
};

export const WithMaxTags: Story = {
  args: {
    options: sampleOptions,
    multiple: true,
    maxTagCount: 2,
    placeholder: "Max 2 tags visible",
    defaultValue: ["apple", "banana", "cherry"],
  },
};

export const CustomNotFound: Story = {
  args: {
    options: [],
    notFoundContent: "🍎 No fruits available",
    placeholder: "No options to select",
  },
};