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

/**
 * Whether an app-mode (AI) session is currently active — the user entered the
 * AI experience (e.g. via an AI-only deep link) and has not left it yet. When
 * true, `AppRouter` renders the app-mode shell (`AppModeRoutes` /
 * `AssistantLayout`) even though the stored `useAppMode()` is still the default,
 * and — crucially — keeps rendering it across in-app navigation to shared routes
 * (`/explore`, …). The shell is torn down only when the session itself ends
 * (leaving the experience), not per-route: navigating from `/conversations` to
 * `/explore` must not flip back to the classic shell.
 *
 * The predicate is owned by the downstream app (the plugin that manages the
 * session) and registered synchronously at boot; it defaults to "no session"
 * so a build without a downstream session simply follows the stored mode.
 */
let appModeSessionPredicate: () => boolean = () => false;

export const registerAppModeSessionPredicate = (
  predicate: () => boolean
): void => {
  appModeSessionPredicate = predicate;
};

export const isAppModeSessionActive = (): boolean => appModeSessionPredicate();
