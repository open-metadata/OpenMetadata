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

import { Toggle } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/UntitledUIThemeProvider/theme-provider';

interface ThemeModeSwitcherProps {
  className?: string;
}

const ThemeModeSwitcher = ({ className }: ThemeModeSwitcherProps) => {
  const { setTheme, theme } = useTheme();
  const { t } = useTranslation();

  return (
    <Toggle
      className={classNames(
        'tw:w-full tw:flex-row-reverse tw:items-center tw:justify-between',
        className
      )}
      isSelected={theme === 'dark'}
      label={t('label.dark-mode')}
      onChange={(isDarkMode) => setTheme(isDarkMode ? 'dark' : 'light')}
    />
  );
};

export default ThemeModeSwitcher;
