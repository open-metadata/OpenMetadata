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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import brandClassBase from '../../../../utils/BrandData/BrandClassBase';

/**
 * Default brand chrome for the ClassicV1 sidebar header — the OpenMetadata
 * monogram, navigating home on click. Rendered by `MainPanel`/`Rail` only when
 * no plugin contributes an `app-mode.sidebar.header` slot, so a downstream
 * (Collate) brand still overrides it. Uses `brandClassBase.getMonogram()` so it
 * honours white-label branding, the same source the classic NavBar logo uses.
 */
const SidebarBrand: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const Monogram = brandClassBase.getMonogram().svg;

  return (
    <button
      aria-label={t('label.home')}
      className="ask-logo-btn ask-main-panel__logo-btn"
      data-testid="ask-logo-btn"
      type="button"
      onClick={() => navigate(ROUTES.MY_DATA)}>
      <Monogram height={24} width={24} />
    </button>
  );
};

export default SidebarBrand;
