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

import { useEffect } from 'react';
import { EntityType } from '../enums/entity.enum';
import { Document } from '../generated/entity/docStore/document';
import {
  PersonaPreferences,
  UICustomization,
} from '../generated/system/ui/uiCustomization';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { useApplicationStore } from './useApplicationStore';
import { writeAppMode } from './useAppMode';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';

const resolveAppMode = (
  doc: Document | undefined,
  personaId: string
): string | undefined => {
  const preferences = (doc?.data as UICustomization | undefined)
    ?.personaPreferences;

  return preferences?.find(
    (entry: PersonaPreferences) => entry.personaId === personaId
  )?.appMode;
};

/**
 * On login (and whenever the user's default persona changes), fetch that
 * persona's UICustomization document and, if it defines an `appMode`, force
 * that mode into `useAppModeStore` via `writeAppMode`. When the persona has
 * no `appMode`, the store keeps its persisted localStorage value (which
 * itself defaults to DEFAULT_APP_MODE).
 *
 * No-ops when no non-default app mode is registered in `useAppRoutesRegistry`
 * — OM core stays mode-agnostic and only offers this pathway when a plugin
 * (e.g. Collate) registers additional routes.
 */
export const useSyncAppModeFromPersona = (): void => {
  const defaultPersonaId = useApplicationStore(
    (state) => state.currentUser?.defaultPersona?.id
  );
  const defaultPersonaName = useApplicationStore(
    (state) => state.currentUser?.defaultPersona?.name
  );
  const hasNonDefaultMode = useAppRoutesRegistry(
    (state) => Object.keys(state.routes).length > 0
  );

  useEffect(() => {
    if (!hasNonDefaultMode || !defaultPersonaId || !defaultPersonaName) {
      return;
    }

    let cancelled = false;

    const sync = async () => {
      try {
        const doc = await getDocumentByFQN(
          `${EntityType.PERSONA}.${defaultPersonaName}`
        );
        if (cancelled) {
          return;
        }
        const mode = resolveAppMode(doc, defaultPersonaId);
        if (mode) {
          writeAppMode(mode);
        }
      } catch {
        // Fetch failure is non-fatal: fall back to the existing
        // localStorage-backed mode. Do not toast here — this runs on
        // every login and would surface as noise for users without
        // customization docs.
      }
    };

    void sync();

    return () => {
      cancelled = true;
    };
  }, [defaultPersonaId, defaultPersonaName, hasNonDefaultMode]);
};
