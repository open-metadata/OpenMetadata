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
 * Default brand chrome for the ClassicV1 sidebar header — the OpenMetadata
 * monogram, navigating home on click. Rendered by `MainPanel`/`Rail` only when
 * no plugin contributes an `app-mode.sidebar.header` slot, so a downstream
 * (Collate) brand still overrides it. Uses `brandClassBase.getMonogram()` so it
 * honours white-label branding, the same source the classic NavBar logo uses.
 */
const SidebarBrand: React.FC<SidebarBrandProps> = ({ variant = 'panel' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const Monogram = brandClassBase.getMonogram().svg;

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
      {/* Monogram viewBox is 53x64 (the database-cylinder mark, taller than
          wide) — keep that aspect so it isn't squished into an oval, and size
          it to fill the header so the cylinder body reads, not just the top. */}
      <Monogram height={28} width={23} />
    </button>
  );
};

export default SidebarBrand;
