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
import type { KeyboardEvent } from 'react';
import type { ComboBoxState } from 'react-stately';

/**
 * react-aria commits the option the list has focused when Tab leaves a combobox. In a field that
 * holds several values that adds one nobody picked, so a Tab first forgets the focused option and
 * leaving the field adds nothing. Bound in the capture phase: react-aria commits before the
 * input's own key handler runs. ADR:2026-10-20-leaving-a-multi-select-with-tab-adds-nothing
 */
export const forgetFocusedOptionOnTab = (
  state: ComboBoxState<unknown> | null,
  event: KeyboardEvent
) => {
  if (event.key === 'Tab') {
    state?.selectionManager.setFocusedKey(null);
  }
};
