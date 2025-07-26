import type { Meta, StoryObj } from "@storybook/react";
import RichTextEditorPreviewerV1 from "./RichTextEditorPreviewerV1";

const meta: Meta<typeof RichTextEditorPreviewerV1> = {
  title: "Components/RichTextEditor/RichTextEditorPreviewerV1",
  component: RichTextEditorPreviewerV1,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    markdown: {
      control: "text",
      description: "HTML content to display",
    },
    className: {
      control: "text",
      description: "Additional CSS class name",
    },
    enableSeeMoreVariant: {
      control: "boolean",
      description: "Enable see more/less functionality",
    },
    textVariant: {
      control: "select",
      options: ["black", "white"],
      description: "Text color variant",
    },
    showReadMoreBtn: {
      control: "boolean",
      description: "Show read more button",
    },
    maxLength: {
      control: "number",
      description: "Maximum length before truncating",
    },
    isDescriptionExpanded: {
      control: "boolean",
      description: "Initial expanded state",
    },
    reducePreviewLineClass: {
      control: "text",
      description: "CSS class for reduced preview lines",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    markdown:
      "<p><strong>This is a demo description.</strong></p><p></p><p><code>This is a code block.</code></p>",
  },
};

export const LongContent: Story = {
  args: {
    markdown:
      "<p>This is a very long piece of content that will be truncated by the component. It contains multiple sentences and should demonstrate the read more functionality. The content should be long enough to trigger the truncation behavior and show the read more button. This allows users to expand and collapse the content as needed.</p>",
    maxLength: 100,
    enableSeeMoreVariant: true,
    showReadMoreBtn: true,
  },
};

export const ShortContent: Story = {
  args: {
    markdown: "<p>Short content that will not be truncated.</p>",
    maxLength: 150,
    enableSeeMoreVariant: true,
    showReadMoreBtn: true,
  },
};

export const NoReadMoreButton: Story = {
  args: {
    markdown:
      "<p>This content is long but the read more button is disabled.</p>",
    maxLength: 50,
    enableSeeMoreVariant: true,
    showReadMoreBtn: false,
  },
};

export const DisabledSeeMoreVariant: Story = {
  args: {
    markdown:
      "<p>This content will not be truncated even if it is long, because the see more variant is disabled.</p>",
    maxLength: 50,
    enableSeeMoreVariant: false,
    showReadMoreBtn: true,
  },
};

export const WhiteTextVariant: Story = {
  args: {
    markdown: "<p>This text uses the white variant.</p>",
    textVariant: "white",
  },
};

export const ExpandedState: Story = {
  args: {
    markdown:
      "<p>This content starts in an expanded state. It contains multiple sentences and should demonstrate the read more functionality. The content should be long enough to trigger the truncation behavior and show the read more button.</p>",
    maxLength: 100,
    enableSeeMoreVariant: true,
    showReadMoreBtn: true,
    isDescriptionExpanded: true,
  },
};

export const EmptyContent: Story = {
  args: {
    markdown: "",
  },
};

export const WithCustomClassName: Story = {
  args: {
    markdown: "<p>Content with custom CSS class applied.</p>",
    className: "custom-previewer-class",
  },
};

export const WithReducedPreviewLines: Story = {
  args: {
    markdown:
      "<p>This content uses the reduced preview lines class for a more compact display.</p>",
    reducePreviewLineClass: "reduce-preview-lines",
  },
};

export const ComplexHTMLContent: Story = {
  args: {
    markdown:
      "<p><strong>This is a demo description.</strong></p><p></p><p><code>This is a code block.</code></p><p>This contains <em>italic text</em> and <a href='https://example.com'>a link</a>.</p>",
  },
};
