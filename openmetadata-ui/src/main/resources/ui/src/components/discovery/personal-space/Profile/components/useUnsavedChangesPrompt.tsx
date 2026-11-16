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
import { useUnsavedExitGuard } from '../../../../../hooks/discovery/personal-space/useUnsavedExitGuard';
import UnsavedChangesPrompt from './UnsavedChangesPrompt';

/**
 * The unsaved-changes guard plus its prompt, for a settings form: render
 * `prompt` once, and send in-form exits (Cancel, Back) through `runGuarded`.
 * Esc, Close, the sidebar and breadcrumbs are held by the modal itself.
 */
export const useUnsavedChangesPrompt = (isDirty: boolean) => {
  const { isPromptOpen, anchorRef, runGuarded, confirmExit, cancelExit } =
    useUnsavedExitGuard(isDirty);

  return {
    runGuarded,
    prompt: (
      <UnsavedChangesPrompt
        isOpen={isPromptOpen}
        triggerRef={anchorRef}
        onCancel={cancelExit}
        onDiscard={confirmExit}
      />
    ),
  };
};
