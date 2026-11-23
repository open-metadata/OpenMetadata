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

import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { useResolvedTheme } from '../../../../context/UntitledUIThemeProvider/theme-provider';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';
import BrandImage from '../../../common/BrandImage/BrandImage';

export interface SidebarBrandProps {
  /**
   * Which sidebar surface hosts the brand. `panel` (default) is the expanded
   * MainPanel header; `rail` is the collapsed 32px rail, where the button must
   * center a square monogram rather than stretch a wide logo.
   */
  variant?: 'panel' | 'rail';
}

/**
 * Brand chrome for the AI sidebar header. Uses `brandClassBase`, which a
 * downstream build overrides via the class-replacement plugin — so this shows
 * the OpenMetadata mark by default and the Collate mark in Collate, always (no
 * plugin-install gate). The expanded panel shows the full wordmark
 * (`getSidebarLogo()`); the collapsed 32px rail shows the compact monogram
 * (`getSidebarMonogram()`). These sidebar-specific getters let a build swap
 * the sidebar brand without touching the NavBar/login logo.
 *
 * An admin-set custom logo (Platform Settings → Theme) wins over the build's
 * mark; `BrandImage` then picks its light or dark variant for the active theme.
 */
const SidebarBrand: React.FC<SidebarBrandProps> = ({ variant = 'panel' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { applicationConfig } = useApplicationStore();
  const Logo = brandClassBase.getSidebarLogo().svg;
  const Monogram = brandClassBase.getSidebarMonogram().svg;
  const isRail = variant === 'rail';
  const {
    customLogoUrlPath,
    customLogoDarkUrlPath,
    customMonogramUrlPath,
    customMonogramDarkUrlPath,
  } = applicationConfig?.customLogoConfig ?? {};
  const isDark = useResolvedTheme() === 'dark';
  const [lightUrl, darkUrl] = isRail
    ? [customMonogramUrlPath, customMonogramDarkUrlPath]
    : [customLogoUrlPath, customLogoDarkUrlPath];
  // Same choice BrandImage makes; when it resolves to nothing, keep the build's
  // sidebar mark rather than BrandImage's generic default.
  const hasCustomLogo = Boolean((isDark && darkUrl) || lightUrl);

  const renderBrand = () => {
    if (hasCustomLogo) {
      return (
        <BrandImage
          className={classNames('tw:w-auto tw:max-w-full tw:object-contain', {
            'tw:h-7': isRail,
            'tw:h-10': !isRail,
          })}
          height={isRail ? 28 : 40}
          isMonoGram={isRail}
          width="auto"
        />
      );
    }

    // Collapsed rail: the compact monogram, kept to its 53x64 aspect so it
    // doesn't squish into an oval. Expanded panel: the full wordmark; the
    // `__logo-btn svg` rule height-constrains it and width follows its aspect.
    return isRail ? <Monogram height={28} width={23} /> : <Logo />;
  };

  return (
    <button
      aria-label={t('label.home')}
      className={classNames('ask-logo-btn', {
        'ask-main-panel__logo-btn': !isRail,
        'ask-rail__logo-btn': isRail,
      })}
      data-testid="ask-logo-btn"
      type="button"
      // Home is `/`, the landing page. `/my-data` is the personal-space My Data
      // page in app mode, which the user menu opens.
      onClick={() => navigate(ROUTES.HOME)}>
      {renderBrand()}
    </button>
  );
};

export default SidebarBrand;
