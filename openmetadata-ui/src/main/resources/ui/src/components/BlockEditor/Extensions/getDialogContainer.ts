/*
 *  Copyright 2023 Collate.
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
import { EditorView } from '@tiptap/pm/view';

/**
 * Mount editor popups (tippy content) inside the editor's nearest
 * focus-trapping dialog (e.g. React Aria's SlideoutMenu) so it does not get
 * marked inert or swallow their clicks. antd modals/drawers don't trap focus
 * from a body-portalled popup, and their transforms would misposition it, so
 * fall back to document.body for those (and when not inside a dialog at all).
 */
export const getDialogContainer = (view: EditorView): HTMLElement => {
  const dialog = view.dom.closest('[role="dialog"]');

  return dialog && !dialog.closest('.ant-modal, .ant-drawer')
    ? (dialog as HTMLElement)
    : document.body;
};
