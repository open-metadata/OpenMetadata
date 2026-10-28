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

import {
  getHtmlStringFromMarkdownString,
  isDescriptionContentEmpty,
} from '../../../utils/BlockEditorPureUtils';

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'UL',
  'OL',
  'BLOCKQUOTE',
  'PRE',
  'TABLE',
  'HR',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

const getPlainText = (element: Element) => {
  element.querySelectorAll('br').forEach((br) => br.replaceWith(' '));

  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/**
 * A tier description is a summary block followed by its details. Seeded tiers
 * store markdown and UI-created ones store editor HTML, so both are read as
 * HTML: the first block is the summary text, the rest are the details.
 */
export const splitTierDescription = (description = '') => {
  const { body } = new DOMParser().parseFromString(
    getHtmlStringFromMarkdownString(description),
    'text/html'
  );
  const nodes = Array.from(body.childNodes);
  const isBlockStructured = nodes.every((node) =>
    node.nodeType === Node.ELEMENT_NODE
      ? BLOCK_TAGS.has((node as Element).tagName)
      : !node.textContent?.trim()
  );

  // Inline-only content (text or <strong> at the top level) is one summary.
  if (!isBlockStructured) {
    return { summary: getPlainText(body), details: '' };
  }

  // The editor saves stray empty paragraphs; they are neither summary nor
  // details. Image-only blocks are not empty and stay in the details.
  const [first, ...rest] = Array.from(body.children).filter(
    (element) => !isDescriptionContentEmpty(element.outerHTML)
  );

  return {
    summary: first ? getPlainText(first) : '',
    details: rest.map((element) => element.outerHTML).join(''),
  };
};
