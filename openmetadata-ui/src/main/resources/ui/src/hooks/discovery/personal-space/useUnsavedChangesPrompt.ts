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
import { useUnsavedExitGuard } from './useUnsavedExitGuard';

/**
 * The unsaved-changes guard for a settings form. Render
 * `<UnsavedChangesPrompt {...promptProps} />` once, and send in-form exits
 * (Cancel, Back) through `runGuarded`. Esc, Close, the sidebar and breadcrumbs
 * are held by the modal itself. `onSave` offers "Save & go"; it resolves `true`
 * once saved, so a failed save keeps the user on the form with their edits.
 */
export const useUnsavedChangesPrompt = (
  isDirty: boolean,
  onSave?: () => Promise<boolean>
) => {
  const { isPromptOpen, anchorRef, runGuarded, confirmExit, cancelExit } =
    useUnsavedExitGuard(isDirty);

  return {
    runGuarded,
    promptProps: {
      isOpen: isPromptOpen,
      triggerRef: anchorRef,
      onCancel: cancelExit,
      onDiscard: confirmExit,
      onSave: onSave
        ? async () => {
            if (await onSave()) {
              confirmExit();
            }
          }
        : undefined,
    },
  };
};
