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

// Views whose purpose is to edit or create something: leaving one (Save,
// Cancel, a redirect away from a form the user may not open) replaces history,
// so Back never reopens a submitted form.
const FORM_VIEW_TYPE =
  /(^|-)(add|edit|new|configure|create|import|rule|install)$/;
// A contributed section's own sub-page, e.g. `templates/add`, `edit/<fqn>`.
const FORM_SUB_PATH = /(^|\/)(add|edit|configure)(\/|$)/;

export interface SettingsHistoryView {
  type: string;
  subPath?: string;
}

export const isSettingsFormView = (view: SettingsHistoryView): boolean =>
  FORM_VIEW_TYPE.test(view.type) ||
  Boolean(view.subPath && FORM_SUB_PATH.test(view.subPath));

/**
 * Whether moving between two settings-modal views pushes a history entry:
 * opening a view does, leaving a form for a non-form view does not
 * (ADR:2026-11-12-settings-modal-views-push-history-only-when-the-user-opens-them).
 */
export const pushesSettingsView = (
  current: SettingsHistoryView,
  next: SettingsHistoryView
): boolean => !isSettingsFormView(current) || isSettingsFormView(next);

/**
 * `replace` is for redirects and for returning to a list after a delete: Back
 * must not land on a view that no longer resolves.
 */
export interface SettingsNavigateOptions {
  replace?: boolean;
}

/** The `setHash` options for moving from `current` to `next`. */
export const settingsHashOptions = (
  current: SettingsHistoryView,
  next: SettingsHistoryView,
  options?: SettingsNavigateOptions
) => ({
  push: !options?.replace && pushesSettingsView(current, next),
});
