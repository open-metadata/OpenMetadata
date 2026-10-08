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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import React, { lazy, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import '../../../../pages/CustomizeDetailsPage/customize-details-page.less';
import {
  getCustomizePageCategories,
  getCustomizePageOptions,
} from '../../../../utils/Persona/PersonaUtils';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import {
  CustomizePageChrome,
  CustomizePageChromeContext,
  CUSTOMIZE_CHROME_BACK_ID,
} from '../../../MyData/CustomizableComponents/CustomizablePageHeader/CustomizePageChrome.context';
import {
  hashSubPathToView,
  isFullscreenPersonaHash,
} from '../Profile/tabs/personas/Personas.utils';

const PersonaCustomizeView = withSuspenseFallback(
  lazy(() => import('../Profile/tabs/personas/customize/PersonaCustomizeView'))
);

const HASH_TAB = 'personas';

/**
 * Full-page persona customize view (home page, entity pages). AppShell hides
 * its own layout while this renders, so it sits in normal document flow and
 * every modal / popover / toast it opens stacks above it without z-index
 * overrides. Hash drives visibility; leaving restores the hash and re-opens the
 * personal-space modal over the untouched page underneath.
 */
const PersonaFullscreenPortal: React.FC = () => {
  const { t } = useTranslation();
  const { state: hashState, setHash } = useSettingsHash();
  const openModal = usePersonalSpaceStore((state) => state.open);
  const [personaName, setPersonaName] = useState('');

  const isVisible = isFullscreenPersonaHash(hashState.tab, hashState.subPath);
  const view = hashSubPathToView(hashState.subPath);
  const fqn = isVisible && view.type === 'customize' ? view.fqn : '';
  const category = isVisible && view.type === 'customize' ? view.category : '';
  const [baseCategory, entityKey] = category.split('/', 2);

  const goToModal = useCallback(
    (subPath?: string) => {
      setHash(HASH_TAB, subPath);
      openModal('profile');
    },
    [setHash, openModal]
  );

  const handleBack = useCallback(
    () => goToModal(entityKey ? `${fqn}/customize/${baseCategory}` : fqn),
    [goToModal, fqn, baseCategory, entityKey]
  );

  const chrome = useMemo<CustomizePageChrome>(() => {
    const categories = getCustomizePageCategories();
    const parentLabel = categories.find((c) => c.key === baseCategory)?.label;
    const currentLabel = entityKey
      ? getCustomizePageOptions(baseCategory).find((c) => c.key === entityKey)
          ?.label
      : parentLabel;

    const breadcrumbs: BreadcrumbItemType[] = [
      { id: 'settings', label: t('label.setting-plural') },
      { id: 'personas', label: t('label.persona-plural') },
      { id: 'persona', label: personaName || fqn },
      ...(entityKey
        ? [{ id: 'parent', label: parentLabel ?? baseCategory }]
        : []),
      { id: 'current', label: currentLabel ?? category },
    ];

    const onNavigate = (id: string) => {
      switch (id) {
        case 'settings':
        case 'personas':
          goToModal();

          break;
        case 'persona':
          goToModal(fqn);

          break;
        case 'parent':
        case CUSTOMIZE_CHROME_BACK_ID:
          handleBack();

          break;
        default:
          break;
      }
    };

    return { breadcrumbs, onNavigate };
  }, [
    t,
    personaName,
    fqn,
    category,
    baseCategory,
    entityKey,
    goToModal,
    handleBack,
  ]);

  if (!isVisible) {
    return null;
  }

  return (
    <CustomizePageChromeContext.Provider value={chrome}>
      <div
        className="persona-settings-overlay tw:h-dvh tw:overflow-y-auto"
        data-testid="persona-fullscreen-view">
        <PersonaCustomizeView
          category={category}
          personaFqn={fqn}
          onBack={handleBack}
          onHeaderActionsChange={() => undefined}
          onRename={setPersonaName}
        />
      </div>
    </CustomizePageChromeContext.Provider>
  );
};

export default PersonaFullscreenPortal;
