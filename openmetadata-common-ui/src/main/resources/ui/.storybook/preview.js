import "../src/components/common/RichTextEditor/rich-text-editor-previewerV1.less";
import "../src/styles/antd-master.less";

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
