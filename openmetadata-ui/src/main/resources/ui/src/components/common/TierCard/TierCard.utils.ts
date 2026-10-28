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

import { getHtmlStringFromMarkdownString } from '../../../utils/BlockEditorPureUtils';

/**
 * A tier description is a summary block followed by its details. Seeded tiers
 * store markdown and UI-created ones store editor HTML, so both are read as
 * HTML: the first block is the summary text, the rest are the details.
 */
export const splitTierDescription = (description = '') => {
  const doc = new DOMParser().parseFromString(
    getHtmlStringFromMarkdownString(description),
    'text/html'
  );
  const [first, ...rest] = Array.from(doc.body.children);

  if (!first) {
    return { summary: doc.body.textContent?.trim() ?? '', details: '' };
  }

  return {
    summary: first.textContent?.trim() ?? '',
    details: rest.map((element) => element.outerHTML).join(''),
  };
};
