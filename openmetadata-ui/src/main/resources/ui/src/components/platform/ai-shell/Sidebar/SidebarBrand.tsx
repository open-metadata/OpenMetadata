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
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';

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
 */
const SidebarBrand: React.FC<SidebarBrandProps> = ({ variant = 'panel' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const Logo = brandClassBase.getSidebarLogo().svg;
  const Monogram = brandClassBase.getSidebarMonogram().svg;

  return (
    <button
      aria-label={t('label.home')}
      className={classNames('ask-logo-btn', {
        'ask-main-panel__logo-btn': variant === 'panel',
        'ask-rail__logo-btn': variant === 'rail',
      })}
      data-testid="ask-logo-btn"
      type="button"
      onClick={() => navigate(ROUTES.MY_DATA)}>
      {variant === 'rail' ? (
        // Collapsed rail: the compact monogram, kept to its 53x64 aspect so it
        // doesn't squish into an oval.
        <Monogram height={28} width={23} />
      ) : (
        // Expanded panel: the full wordmark. The `__logo-btn svg` rule height-
        // constrains it; width follows the logo's own aspect.
        <Logo />
      )}
    </button>
  );
};

export default SidebarBrand;
