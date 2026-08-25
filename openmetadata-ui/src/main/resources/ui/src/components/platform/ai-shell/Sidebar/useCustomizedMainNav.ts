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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FQN_SEPARATOR_CHAR } from '../../../../constants/char.constants';
import { ClientErrors } from '../../../../enums/Axios.enum';
import { EntityType } from '../../../../enums/entity.enum';
import { NavigationItem } from '../../../../generated/system/ui/uiCustomization';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getDocumentByFQN } from '../../../../rest/DocStoreAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
  APP_MODE_SIDEBAR_CUSTOMIZATION_KEY,
  APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT,
} from './appModeSidebar.constants';
import { MainNavItem } from './navConfig';
import { applySidebarCustomization, MainNavNode } from './sidebarCustomization';

export interface CustomizedMainNav {
  /** Ordered top-level render nodes; the "More" group sits at its own index. */
  nodes: MainNavNode[];
}

/**
 * Applies the selected persona's stored sidebar customization (order +
 * visibility + top-level/More split) to the live, module-derived nav items,
 * returning the ordered render nodes.
 *
 * No persona selected (or no stored customization / fetch failure) → the
 * default split (top `APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT` visible, rest in
 * More). The customization document is re-fetched when the persona changes
 * and when the customize-sidebar editor dispatches its "changed" event, so
 * the live sidebar reflects a save without a reload.
 */
export const useCustomizedMainNav = (
  items: MainNavItem[]
): CustomizedMainNav => {
  const { selectedPersona } = useApplicationStore();
  const [customization, setCustomization] = useState<NavigationItem[] | null>(
    null
  );

  const personaFqn = selectedPersona?.fullyQualifiedName;

  const fetchCustomization = useCallback(() => {
    if (!personaFqn) {
      setCustomization(null);

      return undefined;
    }

    let cancelled = false;

    getDocumentByFQN(`${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${personaFqn}`)
      .then((doc) => {
        if (!cancelled) {
          setCustomization(
            doc.data?.[APP_MODE_SIDEBAR_CUSTOMIZATION_KEY] ?? null
          );
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        // No persona document yet — fall back to the default nav silently.
        // Any other failure (auth/network/server) still falls back, but is
        // surfaced so it isn't mistaken for "no customization saved".
        if ((error as AxiosError).response?.status !== ClientErrors.NOT_FOUND) {
          showErrorToast(error as AxiosError);
        }
        setCustomization(null);
      });

    return () => {
      cancelled = true;
    };
  }, [personaFqn]);

  // Shared across both trigger paths (persona change and the
  // customization-changed event) so a fetch kicked off by one can't outlive a
  // fetch (or unmount) triggered by the other — starting a new fetch always
  // cancels whatever was still in flight first.
  const cancelPendingRef = useRef<(() => void) | undefined>(undefined);

  const triggerFetch = useCallback(() => {
    cancelPendingRef.current?.();
    cancelPendingRef.current = fetchCustomization();
  }, [fetchCustomization]);

  useEffect(() => {
    triggerFetch();

    return () => cancelPendingRef.current?.();
  }, [triggerFetch]);

  useEffect(() => {
    window.addEventListener(
      APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
      triggerFetch
    );

    return () => {
      window.removeEventListener(
        APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
        triggerFetch
      );
    };
  }, [triggerFetch]);

  return useMemo(
    () => ({
      nodes: applySidebarCustomization(
        items,
        customization,
        APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT
      ),
    }),
    [items, customization]
  );
};
