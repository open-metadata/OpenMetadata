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

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AI_APP_MODE, DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { EntityType } from '../enums/entity.enum';
import { Document } from '../generated/entity/docStore/document';
import {
  PersonaPreferences,
  UICustomization,
} from '../generated/system/ui/uiCustomization';
import { AppMode } from '../generated/type/personaPreferences';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { useApplicationStore } from './useApplicationStore';
import { writeAppMode } from './useAppMode';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';

const PERSONA_APP_MODE_QUERY_KEY = 'persona-app-mode-doc';

/**
 * Translate the admin-facing `AppMode` enum stored on a persona into the
 * runtime mode string consumed by `useAppModeStore` and by
 * `useAppRoutesRegistry`. Core has always used the string `"default"` for
 * Classic; the Collate plugin registers routes under `"ai"`. The enum
 * exists so the admin editor UI can display readable, stable labels
 * independent of whatever key plugins pick.
 */
const APP_MODE_ENUM_TO_RUNTIME: Record<AppMode, string> = {
  [AppMode.Classic]: DEFAULT_APP_MODE,
  [AppMode.AI]: AI_APP_MODE,
};

const resolveAppMode = (
  doc: Document | undefined,
  personaId: string
): AppMode | undefined => {
  const preferences = (doc?.data as UICustomization | undefined)
    ?.personaPreferences;

  return preferences?.find(
    (entry: PersonaPreferences) => entry.personaId === personaId
  )?.appMode;
};

/**
 * On login (and whenever the user's default persona changes), fetch that
 * persona's UICustomization document and — if it defines an `appMode` —
 * force the corresponding runtime mode into `useAppModeStore` via
 * `writeAppMode`. When the persona has no `appMode`, the store keeps its
 * persisted localStorage value (which itself defaults to
 * `DEFAULT_APP_MODE`).
 *
 * The fetch is memoized by React Query with `staleTime: Infinity`, so a
 * navigating user never re-fetches the same persona doc: at most one HTTP
 * call per persona per session. Fetch failures do NOT toast — they run on
 * every login and would surface as noise for users without customization
 * docs; the store simply falls back to its persisted value.
 *
 * No-ops entirely when no non-default app mode is registered in
 * `useAppRoutesRegistry` — OM core stays mode-agnostic and only offers this
 * pathway when a plugin (e.g. Collate) has registered additional routes.
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

  const enabled =
    hasNonDefaultMode &&
    Boolean(defaultPersonaId) &&
    Boolean(defaultPersonaName);

  const { data: personaDoc } = useQuery({
    queryKey: [PERSONA_APP_MODE_QUERY_KEY, defaultPersonaName],
    queryFn: () =>
      getDocumentByFQN(`${EntityType.PERSONA}.${defaultPersonaName}`),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!enabled || !personaDoc || !defaultPersonaId) {
      return;
    }
    const personaAppMode = resolveAppMode(personaDoc, defaultPersonaId);
    if (personaAppMode) {
      writeAppMode(APP_MODE_ENUM_TO_RUNTIME[personaAppMode]);
    }
  }, [enabled, personaDoc, defaultPersonaId]);
};
