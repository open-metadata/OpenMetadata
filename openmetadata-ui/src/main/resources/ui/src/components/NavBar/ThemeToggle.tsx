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

import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ThemeMode } from '../../hooks/currentUserStore/useCurrentUserStore';

interface ThemeToggleProps {
  themeMode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

const SunIcon = () => (
  <svg
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
    width="20">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

const MoonIcon = () => (
  <svg
    fill="none"
    height="20"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
    width="20">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const ThemeToggle = ({ themeMode, onChange }: ThemeToggleProps) => {
  const { t } = useTranslation();
  const isDark = themeMode === 'dark';

  return (
    <Tooltip
      title={
        isDark
          ? t('label.switch-to-light-mode')
          : t('label.switch-to-dark-mode')
      }>
      <Button
        className="flex-center"
        data-testid="theme-toggle"
        icon={isDark ? <SunIcon /> : <MoonIcon />}
        type="text"
        onClick={() => onChange(isDark ? 'light' : 'dark')}
      />
    </Tooltip>
  );
};

export default ThemeToggle;
