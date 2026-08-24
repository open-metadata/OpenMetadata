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
import { useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { I18nextProvider } from 'react-i18next';
import type { Preview, StoryFn, StoryContext } from '@storybook/react';
import { CORE_LOCALES } from '../src/locale';
import '../src/styles/storybook.css';
import i18n from './i18n';
import './index.css';

type ThemeMode = 'light' | 'dark' | 'both';

const RTL_LOCALES = new Set(['ar-SA', 'he-HE', 'pr-PR']);

// Wrap the useEffect + JSX in a real component so the hook lives inside a
// standard React render, not directly in the decorator function body.
// Storybook decorators are plain functions that may be called outside React's
// render path, so calling `useEffect` directly there risks "Invalid hook call".
const StoryWithLocale = ({
  Story,
  theme,
  dir,
  locale,
}: {
  Story: StoryFn;
  theme: ThemeMode;
  dir: 'ltr' | 'rtl';
  locale: string;
}) => {
  useEffect(() => {
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
  }, [locale]);

  if (theme === 'both') {
    return (
      <div className="tw:grid tw:grid-cols-1 tw:gap-4">
        {renderInTheme(Story, 'light', dir)}
        {renderInTheme(Story, 'dark', dir)}
      </div>
    );
  }

  return renderInTheme(Story, theme, dir);
};

const renderInTheme = (
  Story: StoryFn,
  mode: 'light' | 'dark',
  dir: 'ltr' | 'rtl'
) => {
  const className =
    mode === 'dark' ? 'dark-mode tw:bg-primary' : 'tw:bg-primary';

  return (
    <div className={className} dir={dir}>
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
    locale: {
      name: 'Locale',
      description: 'i18n language for library strings',
      defaultValue: 'en-US',
      toolbar: {
        icon: 'globe',
        items: CORE_LOCALES.map((code) => ({
          value: code,
          title: RTL_LOCALES.has(code) ? `${code} (RTL)` : code,
        })),
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story: StoryFn, ctx: StoryContext) => {
      const parameterTheme = ctx.parameters?.theme as ThemeMode | undefined;
      const globalTheme = ctx.globals.theme as ThemeMode;
      const theme: ThemeMode = parameterTheme ?? globalTheme;
      const locale = ctx.globals.locale as string;
      const dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

      return (
        <HelmetProvider>
          <I18nextProvider i18n={i18n}>
            <StoryWithLocale
              Story={Story}
              dir={dir}
              locale={locale}
              theme={theme}
            />
          </I18nextProvider>
        </HelmetProvider>
      );
    },
  ],
};

export default preview;
