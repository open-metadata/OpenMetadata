/*
 *  Copyright 2022 Collate.
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

import LTRIcon from '../../../assets/svg/ic-ltr.svg';
import RTLIcon from '../../../assets/svg/ic-rtl.svg';
import MarkdownIcon from '../../../assets/svg/markdown.svg';
import i18n from '../../../utils/i18next/LocalUtil';

/**
 * Read more : https://nhn.github.io/tui.editor/latest/tutorial-example15-customizing-toolbar-buttons
 * @returns HTMLElement for toolbar
 */
const markdownButton = (): HTMLButtonElement => {
  const button = document.createElement('button');

  button.className = 'toastui-editor-toolbar-icons markdown-icon';
  button.style.backgroundImage = 'none';
  button.type = 'button';
  button.style.margin = '0';
  button.style.marginTop = '4px';
  button.innerHTML = `
  <a
    href="https://www.markdownguide.org/cheat-sheet/"
    rel="noreferrer"
    target="_blank">
    <img
      alt="markdown-icon"
      className="svg-icon"
      height="16px"
      src=${MarkdownIcon} />
  </a>`;

  return button;
};

const getRTLButtonIcon = (mode: 'rtl' | 'ltr') => `
  <img
    alt="rtl-icon"
    class="svg-icon"
    height="24px"
    width="24px"
    src="${mode === 'rtl' ? RTLIcon : LTRIcon}" />`;

const toggleEditorDirection = (button: HTMLButtonElement) => {
  const editorElement = document.querySelector(
    '.toastui-editor.md-mode.active'
  );

  if (editorElement) {
    const editorElementDir = editorElement.getAttribute('dir');
    const newDir = editorElementDir === 'rtl' ? 'ltr' : 'rtl';
    const textAlign = newDir === 'rtl' ? 'right' : 'left';

    editorElement.setAttribute('dir', newDir);
    editorElement.setAttribute('style', `text-align: ${textAlign};`);
    button.innerHTML = getRTLButtonIcon(newDir === 'rtl' ? 'ltr' : 'rtl');
  }
};

const rtlButton = (): HTMLButtonElement => {
  const button = document.createElement('button');

  button.onclick = () => toggleEditorDirection(button);

  button.className = 'toastui-editor-toolbar-icons rtl-icon';
  button.id = 'rtl-button';
  button.style.cssText = 'background-image: none; margin: 0; margin-top: 4px;';
  button.type = 'button';
  button.innerHTML = getRTLButtonIcon('rtl');

  return button;
};

const rtlButtonUpdateHandler = (toolbarState: {
  active: boolean;
  disabled?: boolean;
}) => {
  const rtlButtonElement = document.getElementById('rtl-button');
  if (rtlButtonElement) {
    (rtlButtonElement as HTMLButtonElement).disabled =
      toolbarState.disabled || false;
  }
};

export const EDITOR_TOOLBAR_ITEMS = [
  'heading',
  'bold',
  'italic',
  'strike',
  'ul',
  'ol',
  'link',
  'hr',
  'quote',
  'code',
  'codeblock',
  {
    name: i18n.t('label.rtl-ltr-direction'),
    el: rtlButton(),
    tooltip: i18n.t('label.rtl-ltr-direction'),
    onUpdated: rtlButtonUpdateHandler,
  },
  {
    name: i18n.t('label.markdown-guide'),
    el: markdownButton(),
    tooltip: i18n.t('label.markdown-guide'),
  },
];
