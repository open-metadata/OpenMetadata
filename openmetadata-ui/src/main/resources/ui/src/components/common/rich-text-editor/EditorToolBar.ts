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

import { t } from 'i18next';
import MarkdownIcon from '../../../assets/svg/markdown.svg';

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
      src=${MarkdownIcon} />
  </a>`;

  return button;
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
    name: t('label.markdown-guide'),
    el: markdownButton(),
    tooltip: t('label.markdown-guide'),
  },
];
