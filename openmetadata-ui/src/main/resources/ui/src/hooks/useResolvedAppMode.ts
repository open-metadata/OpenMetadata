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
import { useEffect, useState } from 'react';
import { AI_APP_MODE, DEFAULT_APP_MODE } from '../constants/appMode.constants';
import { EntityType } from '../enums/entity.enum';
import { Document } from '../generated/entity/docStore/document';
import {
  PersonaPreferences,
  UICustomization,
} from '../generated/system/ui/uiCustomization';
import { AppMode } from '../generated/type/personaPreferences';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { useCurrentUserPreferences } from './currentUserStore/useCurrentUserStore';
import { useApplicationStore } from './useApplicationStore';
import {
  clearAppModeSessionOnly,
  isAppModeHintFresh,
  readAppModeHint,
  readAppModeSession,
  writeAppMode,
} from './useAppMode';
import { useAppRoutesRegistry } from './useAppRoutesRegistry';

const PERSONA_APP_MODE_QUERY_KEY = 'persona-app-mode-doc';

/**
 * Translate the admin-facing `AppMode` enum stored on a persona into the
 * runtime mode string consumed by `useAppMode` and by
 * `useAppRoutesRegistry`. Core has always used the string `"default"` for
 * Classic; the Collate plugin registers routes under `"ai"`. The enum
 * exists so the admin editor UI can display readable, stable labels
 * independent of whatever key plugins pick.
 */
const APP_MODE_ENUM_TO_RUNTIME: Record<AppMode, string> = {
  [AppMode.Classic]: DEFAULT_APP_MODE,
  [AppMode.AI]: AI_APP_MODE,
};

const resolvePersonaAppMode = (
  doc: Document | undefined,
  personaId: string | undefined
): string | null => {
  if (!doc || !personaId) {
    return null;
  }
  const preferences = (doc.data as UICustomization | undefined)
    ?.personaPreferences;
  const entry = preferences?.find(
    (p: PersonaPreferences) => p.personaId === personaId
  );

  return entry?.appMode ? APP_MODE_ENUM_TO_RUNTIME[entry.appMode] : null;
};

/**
 * Single source of truth for resolving the active app mode at boot.
 *
 * Precedence (top wins):
 *   1. Desktop app — handled outside this hook; the desktop shell calls
 *      `writeAppMode(AI_APP_MODE)` directly and the resolver bails on the
 *      relevant state (no persona to fetch, sessionStorage tuple always
 *      present after that write).
 *   2. Current session tuple whose `personaAppMode` matches what the
 *      persona currently says → keep it. Refreshes and same-persona
 *      re-runs leave the user's chosen mode alone.
 *   3. Persona's `appMode` if set.
 *   4. User preference (`usePersistentStorage[user].appMode`).
 *   5. `DEFAULT_APP_MODE`.
 *
 * The install gate is applied on top of the candidate: if a non-default
 * candidate is not registered in `useAppRoutesRegistry`, the resolver
 * does NOT write. When the route registers later (e.g. AskCollate finishes
 * loading, or an install becomes visible in another session), the resolver
 * re-runs and applies the candidate.
 *
 * Stale-mode cleanup: if the session tuple's `mode` is a non-default
 * mode that is not (or no longer) registered, the tuple is cleared and
 * the resolver falls through to compute a fresh candidate.
 *
 * Consumers should invoke this hook exactly once, high in the tree
 * (e.g. `AppRoot`). It has no return value — its effects are `writeAppMode`
 * / `clearAppMode` calls.
 */
export const useResolvedAppMode = (): void => {
  const defaultPersonaId = useApplicationStore(
    (state) => state.currentUser?.defaultPersona?.id
  );
  const defaultPersonaName = useApplicationStore(
    (state) => state.currentUser?.defaultPersona?.name
  );
  const currentUser = useApplicationStore((state) => state.currentUser);
  const isAuthenticated = useApplicationStore((state) => state.isAuthenticated);
  // `applicationsLoaded` alone is NOT safe as the "give up on the
  // session's mode" signal: the route-registration effect (in the
  // downstream Collate plugin's `App.tsx`) lives on a parent
  // component. React flushes effects child-first, so on the commit
  // where `applicationsLoaded` flips true the resolver's effect fires
  // BEFORE the parent's `registerRoutes(AI_APP_MODE, ...)` call. In
  // that window a genuinely-installed AI mode looks unregistered, and
  // clearing here would strand a manually-switched AI tab in Classic
  // on refresh.
  //
  // Instead we track a `registrySettled` flag that flips true one
  // effect-flush tick AFTER `applicationsLoaded` — long enough for
  // the parent's registerRoutes call to run and the resulting Zustand
  // update to propagate through a follow-up render. Only then is a
  // still-missing mode treated as genuinely uninstalled.
  const applicationsLoaded = useApplicationStore(
    (state) => state.applicationsLoaded
  );
  const registeredRoutes = useAppRoutesRegistry((state) => state.routes);
  const { preferences } = useCurrentUserPreferences();

  const [registrySettled, setRegistrySettled] = useState(false);
  useEffect(() => {
    if (!applicationsLoaded) {
      setRegistrySettled(false);

      return;
    }
    // setTimeout(0) — not queueMicrotask — because we need to land
    // AFTER React's current effect flush completes (peer components'
    // useEffects run in the same synchronous microtask batch and
    // then Zustand's subscribers get notified). setTimeout re-enters
    // through the task queue, guaranteeing the parent's
    // registerRoutes has taken effect before we set the flag.
    const id = setTimeout(() => setRegistrySettled(true), 0);

    return () => clearTimeout(id);
  }, [applicationsLoaded]);

  const hasDefaultPersona = Boolean(defaultPersonaId && defaultPersonaName);

  // Persona docs are edited server-side (admin UI). If we cached forever,
  // an admin flipping the persona's appMode wouldn't take effect until the
  // user closed and re-opened the tab. A 5-min stale window + refetch on
  // window focus keeps edits reasonably fresh without turning the resolver
  // into a chatty consumer.
  const { data: personaDoc, isPending: isPersonaPending } = useQuery({
    queryKey: [PERSONA_APP_MODE_QUERY_KEY, defaultPersonaName],
    queryFn: () =>
      getDocumentByFQN(`${EntityType.PERSONA}.${defaultPersonaName}`),
    enabled: hasDefaultPersona,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (!isAuthenticated || !currentUser?.name) {
      return;
    }
    // If the user has a default persona, wait for the persona doc fetch
    // to settle (success or error) before resolving. Persona takes
    // precedence over the user pref / default, so acting before it
    // resolves would risk overwriting the correct answer momentarily.
    if (hasDefaultPersona && isPersonaPending) {
      return;
    }

    const currentPersonaAppMode = resolvePersonaAppMode(
      personaDoc,
      defaultPersonaId
    );
    const session = readAppModeSession();
    const isModeRegistered = (mode: string): boolean =>
      mode === DEFAULT_APP_MODE || mode in registeredRoutes;

    // If the session refers to a mode that isn't in the registry:
    //   - Until `registrySettled` flips true (one effect-flush tick
    //     after applicationsLoaded), WAIT — the parent's
    //     `registerRoutes(...)` may not have run yet (child-first
    //     effect flush order). Clearing here would revert a valid AI
    //     session to Classic on every reload.
    //   - Once settled and the mode still isn't registered, the
    //     plugin owning the mode is truly uninstalled. Clear ONLY
    //     this tab's session tuple (not the shared hint — sibling
    //     tabs might legitimately be using it) and fall through.
    const validSession =
      session && isModeRegistered(session.mode) ? session : null;
    if (session && !validSession) {
      if (!registrySettled) {
        return;
      }
      clearAppModeSessionOnly();
    }

    if (validSession && validSession.personaAppMode === currentPersonaAppMode) {
      return;
    }

    // Cross-tab hint: when this tab has no session (fresh open, e.g. a
    // cmd+click from a sibling AI tab), adopt the hint before falling
    // through to persona / user pref. The hint represents the user's
    // most-recent active choice across any tab of this browser and
    // should trump both persona and pref within its TTL, matching the
    // sessionStorage-tuple's "manual switch survives until close" rule.
    const hint = validSession ? null : readAppModeHint();
    if (isAppModeHintFresh(hint) && hint) {
      if (isModeRegistered(hint.mode)) {
        writeAppMode(hint.mode, currentPersonaAppMode);

        return;
      }

      // Hint mode isn't registered. Wait until `registrySettled` (see
      // above) to distinguish "route registration hasn't run yet"
      // from "the plugin is genuinely uninstalled." Once settled and
      // the hint's mode still isn't registered, fall through to
      // persona / pref / default. Note that falling through here
      // calls writeAppMode(DEFAULT) which also updates the hint —
      // that's correct in this branch because the old hint pointed
      // at a mode that isn't installed for this user.
      if (!registrySettled) {
        return;
      }
    }

    const preferredMode = preferences.appMode ?? null;
    const candidate =
      currentPersonaAppMode ?? preferredMode ?? DEFAULT_APP_MODE;

    // Install gate: refuse to write a non-default mode that isn't
    // registered yet. When the route registers later, this effect
    // re-runs (registeredRoutes is a dep) and the candidate is applied.
    if (candidate !== DEFAULT_APP_MODE && !isModeRegistered(candidate)) {
      return;
    }

    writeAppMode(candidate, currentPersonaAppMode);
  }, [
    isAuthenticated,
    currentUser?.name,
    hasDefaultPersona,
    isPersonaPending,
    personaDoc,
    defaultPersonaId,
    preferences.appMode,
    registeredRoutes,
    registrySettled,
  ]);
};
