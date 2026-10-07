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

import React, { lazy, useCallback, useMemo, useState } from 'react';
import { PageType } from '../../../../generated/system/ui/page';
import { usePersonalSpaceStore } from '../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../hooks/useSettingsHash';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { hashSubPathToView } from '../Profile/tabs/personas/Personas.utils';

const PersonaCustomizeView = withSuspenseFallback(
  lazy(() => import('../Profile/tabs/personas/customize/PersonaCustomizeView'))
);

/** Categories whose editor opens a full-screen overlay outside the modal. */
const FULLSCREEN_CATEGORIES = new Set<string>([
  'homepage',
  PageType.LandingPage as string,
  PageType.DataMarketplace as string,
]);

function isFullscreenCategory(category: string): boolean {
  if (FULLSCREEN_CATEGORIES.has(category)) {
    return true;
  }
  // Entity-level customization (e.g. 'governance/Domain', 'data-assets/Table')
  return category.includes('/');
}

/**
 * Mounted at the app-shell level (sibling of PersonalSpaceModal).
 * When the hash describes a fullscreen persona customize view, renders it here
 * so PersonalSpaceModal can be closed (removing its backdrop and focus trap)
 * without unmounting the overlay.
 *
 * Hash drives visibility; back navigation updates the hash and re-opens the modal.
 */
const PersonaFullscreenPortal: React.FC = () => {
  const { state: hashState, setHash } = useSettingsHash();
  const openModal = usePersonalSpaceStore((state) => state.open);
  const [, setResolvedName] = useState('');

  const view = hashSubPathToView(hashState.subPath ?? '');

  const isVisible =
    hashState.tab === 'personas' &&
    view.type === 'customize' &&
    isFullscreenCategory(view.category);

  // Derive stable values used by hooks — must be computed before any hook.
  const fqn = isVisible && view.type === 'customize' ? view.fqn : '';
  const category =
    isVisible && view.type === 'customize' ? view.category : '';

  const baseCategory = useMemo(
    () => (category.includes('/') ? category.split('/', 1)[0] : undefined),
    [category]
  );

  const handleBack = useCallback(() => {
    const previousSubPath = baseCategory
      ? `${fqn}/customize/${baseCategory}`
      : fqn;
    setHash('personas', previousSubPath);
    openModal('profile');
  }, [fqn, baseCategory, setHash, openModal]);

  const handleNavigateToEntity = useCallback(
    (entityCategory: string) => {
      setHash('personas', `${fqn}/customize/${entityCategory}`);
    },
    [fqn, setHash]
  );

  if (!isVisible) {
    return null;
  }

  return (
    <PersonaCustomizeView
      category={category}
      personaFqn={fqn}
      onBack={handleBack}
      onHeaderActionsChange={() => undefined}
      onNavigateToEntity={handleNavigateToEntity}
      onRename={setResolvedName}
    />
  );
};

export default PersonaFullscreenPortal;
