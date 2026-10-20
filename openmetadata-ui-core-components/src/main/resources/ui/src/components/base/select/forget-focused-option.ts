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
