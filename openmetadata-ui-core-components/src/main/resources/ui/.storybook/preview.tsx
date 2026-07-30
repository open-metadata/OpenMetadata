/*
 *  Copyright 2026 Collate.
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

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import type { Preview, StoryFn, StoryContext } from '@storybook/react';
import '../src/styles/storybook.css';
import './index.css';

type ThemeMode = 'light' | 'dark' | 'both';

const renderInTheme = (Story: StoryFn, mode: 'light' | 'dark') => {
  const className = mode === 'dark' ? 'dark-mode tw:bg-primary' : 'tw:bg-primary';

  return (
    <div className={className}>
      <div className="tw:p-6">
        <Story />
      </div>
    </div>
  );
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light / Dark / Side-by-side',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'both', title: 'Side-by-side' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story: StoryFn, ctx: StoryContext) => {
      const parameterTheme = (ctx.parameters?.theme as ThemeMode | undefined);
      const globalTheme = ctx.globals.theme as ThemeMode;
      const theme: ThemeMode = parameterTheme ?? globalTheme;

      if (theme === 'both') {
        return (
          <div className="tw:grid tw:grid-cols-1 tw:gap-4">
            {renderInTheme(Story, 'light')}
            {renderInTheme(Story, 'dark')}
          </div>
        );
      }

      return renderInTheme(Story, theme);
    },
  ],
};

export default preview;
