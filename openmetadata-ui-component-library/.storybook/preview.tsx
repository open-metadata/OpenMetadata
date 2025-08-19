import type { Preview } from '@storybook/react';
import React from 'react';
import { ThemeProvider } from '../src/theme';
import '../src/index.css'; // For Tailwind CSS

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div className="p-4">
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default preview;